import { getDb } from "@/db/client";
import { getMetaConfig } from "@/lib/config";
import { appSecretProof } from "@/lib/crypto";
import { env } from "@/lib/env";

/** error จาก Graph API พร้อมบอกว่าควรลองใหม่หรือไม่ */
export class GraphApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
    readonly transient = false,
  ) {
    super(message);
    this.name = "GraphApiError";
  }

  /** error ชั่วคราว (เซิร์ฟเวอร์ล่ม, ยิงถี่เกิน) → ควรลองใหม่ภายหลัง */
  get retryable(): boolean {
    if (this.transient || this.status >= 500 || this.status === 0) return true;
    return this.code !== undefined && RETRYABLE_CODES.has(this.code);
  }
}

// 1,2 = API ขัดข้องชั่วคราว, 4/17/32/613 = ยิงถี่เกินกำหนด, 341 = ใช้งานเกินลิมิตของแอป
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);

type Query = Record<string, string | number | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  token?: string;
  query?: Query;
  body?: unknown;
}

export async function graphRequest<T = Record<string, unknown>>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${env.graphApiBase}/${env.graphApiVersion}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {};
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
    const { appSecret } = await getMetaConfig(getDb());
    if (appSecret) url.searchParams.set("appsecret_proof", appSecretProof(opts.token, appSecret));
  }
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new GraphApiError(`เชื่อมต่อ Graph API ไม่ได้: ${(err as Error).message}`, 0, undefined, undefined, true);
  }

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // ไม่ใช่ JSON (เช่นหน้า error ของ proxy)
  }
  if (!res.ok || json.error) {
    const e = (json.error ?? {}) as { message?: string; code?: number; error_subcode?: number; is_transient?: boolean };
    throw new GraphApiError(
      e.message ?? `Graph API ตอบกลับสถานะ ${res.status}`,
      res.status,
      e.code,
      e.error_subcode,
      e.is_transient ?? false,
    );
  }
  return json as T;
}

// ---------- การส่งข้อความ ----------

export type Recipient = { id: string } | { comment_id: string };

export interface SendResult {
  recipient_id: string;
  message_id: string;
}

export type GraphButton =
  | { type: "postback"; title: string; payload: string }
  | { type: "web_url"; title: string; url: string };

/** ข้อความธรรมดา หรือข้อความที่มีปุ่มอยู่ด้านล่าง (button template) */
export type OutgoingMessage =
  | { text: string }
  | { attachment: { type: "template"; payload: { template_type: "button"; text: string; buttons: GraphButton[] } } };

export function buildMessage(text: string, buttons: GraphButton[]): OutgoingMessage {
  if (buttons.length === 0) return { text };
  return { attachment: { type: "template", payload: { template_type: "button", text, buttons } } };
}

/**
 * ส่ง DM ผ่าน Page (ใช้ได้ทั้ง Messenger และ Instagram ที่ผูกกับเพจ)
 * recipient = { comment_id } คือ "Private Reply" ตอบคอมเมนต์ทาง DM (ส่งได้ 1 ครั้งต่อคอมเมนต์ ภายใน 7 วัน)
 */
export function sendMessage(pageId: string, token: string, recipient: Recipient, message: OutgoingMessage) {
  return graphRequest<SendResult>(`/${pageId}/messages`, {
    method: "POST",
    token,
    body: { recipient, messaging_type: "RESPONSE", message },
  });
}

/** ตอบคอมเมนต์แบบสาธารณะ (ให้คนอื่นเห็นว่าเราตอบแล้ว) */
export function replyToComment(platform: "facebook" | "instagram", commentId: string, token: string, message: string) {
  const path = platform === "instagram" ? `/${commentId}/replies` : `/${commentId}/comments`;
  return graphRequest<{ id: string }>(path, { method: "POST", token, body: { message } });
}

/** ดึงชื่อของคนที่ทักมา (ถ้าดึงไม่ได้ก็ไม่เป็นไร) */
export async function fetchProfile(
  platform: "facebook" | "instagram",
  userId: string,
  token: string,
): Promise<{ name: string | null; username: string | null }> {
  const fields = platform === "instagram" ? "name,username" : "first_name,last_name,name";
  const data = await graphRequest<{ name?: string; username?: string; first_name?: string; last_name?: string }>(
    `/${userId}`,
    { token, query: { fields } },
  );
  const name = data.name ?? ([data.first_name, data.last_name].filter(Boolean).join(" ") || null);
  return { name, username: data.username ?? null };
}

// ---------- การเชื่อมต่อเพจ ----------

export async function exchangeForLongLivedUserToken(shortLivedToken: string): Promise<string> {
  const { appId, appSecret } = await getMetaConfig(getDb());
  if (!appId || !appSecret) throw new Error("ยังไม่ได้ใส่ App ID / App Secret ของ Meta App");
  const data = await graphRequest<{ access_token: string }>("/oauth/access_token", {
    query: {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    },
  });
  return data.access_token;
}

export interface ManagedPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
}

/** รายชื่อเพจที่ผู้ใช้เป็นแอดมิน พร้อม Page Access Token (ไม่หมดอายุ ถ้าได้มาจาก long-lived user token) */
export async function listManagedPages(userToken: string): Promise<ManagedPage[]> {
  const data = await graphRequest<{ data: ManagedPage[] }>("/me/accounts", {
    token: userToken,
    query: { fields: "id,name,access_token,instagram_business_account{id,username}", limit: 100 },
  });
  return data.data ?? [];
}

export const PAGE_WEBHOOK_FIELDS = ["feed", "messages", "messaging_postbacks", "message_reads"];

/** ให้เพจส่ง webhook มาที่แอปของเรา */
export function subscribePageToApp(pageId: string, pageToken: string) {
  return graphRequest<{ success: boolean }>(`/${pageId}/subscribed_apps`, {
    method: "POST",
    token: pageToken,
    query: { subscribed_fields: PAGE_WEBHOOK_FIELDS.join(",") },
  });
}

// ---------- โพสต์ล่าสุด (ใช้เลือกโพสต์ในหน้าตั้งกฎ) ----------

export interface RecentPost {
  id: string;
  platform: "facebook" | "instagram";
  caption: string;
  permalink: string | null;
  imageUrl: string | null;
  createdAt: string | null;
}

export async function listRecentFacebookPosts(pageId: string, token: string, limit = 12): Promise<RecentPost[]> {
  const data = await graphRequest<{
    data: { id: string; message?: string; permalink_url?: string; full_picture?: string; created_time?: string }[];
  }>(`/${pageId}/posts`, {
    token,
    query: { fields: "id,message,permalink_url,full_picture,created_time", limit },
  });
  return (data.data ?? []).map((p) => ({
    id: p.id,
    platform: "facebook",
    caption: p.message ?? "",
    permalink: p.permalink_url ?? null,
    imageUrl: p.full_picture ?? null,
    createdAt: p.created_time ?? null,
  }));
}

export async function listRecentInstagramPosts(igUserId: string, token: string, limit = 12): Promise<RecentPost[]> {
  const data = await graphRequest<{
    data: {
      id: string;
      caption?: string;
      permalink?: string;
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      timestamp?: string;
    }[];
  }>(`/${igUserId}/media`, {
    token,
    query: { fields: "id,caption,permalink,media_type,media_url,thumbnail_url,timestamp", limit },
  });
  return (data.data ?? []).map((p) => ({
    id: p.id,
    platform: "instagram",
    caption: p.caption ?? "",
    permalink: p.permalink ?? null,
    imageUrl: (p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url) ?? null,
    createdAt: p.timestamp ?? null,
  }));
}
