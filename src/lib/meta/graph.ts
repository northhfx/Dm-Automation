import { getDb } from "@/db/client";
import type { GraphApi, Platform } from "@/db/schema";
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
  /** "facebook" (ค่าเริ่มต้น) = graph.facebook.com + Page token, "instagram" = graph.instagram.com + token ของ Instagram Login */
  api?: GraphApi;
  /** false = ไม่ใส่เวอร์ชันใน URL (endpoint ที่ Meta กำหนดว่าไม่มีเวอร์ชัน เช่น /refresh_access_token) */
  versioned?: boolean;
}

function graphUrl(path: string, api: GraphApi, versioned: boolean): URL {
  const base = api === "instagram" ? env.instagramGraphApiBase : env.graphApiBase;
  const version = api === "instagram" ? env.instagramGraphApiVersion : env.graphApiVersion;
  return new URL(`${base}${versioned ? `/${version}` : ""}${path.startsWith("/") ? path : `/${path}`}`);
}

export async function graphRequest<T = Record<string, unknown>>(path: string, opts: RequestOptions = {}): Promise<T> {
  const api = opts.api ?? "facebook";
  const url = graphUrl(path, api, opts.versioned ?? true);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {};
  if (opts.token && api === "instagram") {
    // graph.instagram.com: ส่ง token ทาง query และห้ามแนบ appsecret_proof (proof จาก App Secret ของ Facebook ทำให้ทุก request พัง)
    url.searchParams.set("access_token", opts.token);
  } else if (opts.token) {
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
    json = text ? JSON.parse(api === "instagram" ? quoteLongIds(text) : text) : {};
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

/**
 * id ของ Instagram (17841…) ยาวเกินกว่าที่ number ใน JS เก็บได้แม่นยำ
 * ถ้า graph.instagram.com ส่ง id มาเป็นตัวเลข (ไม่มีเครื่องหมายคำพูด) ให้แปลงเป็นข้อความก่อน parse
 */
function quoteLongIds(text: string): string {
  return text.replace(/("[A-Za-z_]*id"\s*:\s*)(\d{16,})(?=\s*[,}\]])/g, '$1"$2"');
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
 * ส่ง DM: senderId = Page ID (Messenger และ Instagram ที่ผูกกับเพจ, api "facebook")
 * หรือ IG account ID (Instagram Login, api "instagram")
 * recipient = { comment_id } คือ "Private Reply" ตอบคอมเมนต์ทาง DM (ส่งได้ 1 ครั้งต่อคอมเมนต์ ภายใน 7 วัน)
 */
export function sendMessage(
  senderId: string,
  token: string,
  recipient: Recipient,
  message: OutgoingMessage,
  api?: GraphApi,
): Promise<SendResult> {
  return graphRequest<SendResult>(`/${senderId}/messages`, {
    method: "POST",
    token,
    body: { recipient, messaging_type: "RESPONSE", message },
    api,
  });
}

/** ตอบคอมเมนต์แบบสาธารณะ (ให้คนอื่นเห็นว่าเราตอบแล้ว) */
export function replyToComment(
  platform: Platform,
  commentId: string,
  token: string,
  message: string,
  api?: GraphApi,
): Promise<{ id: string }> {
  const path = platform === "instagram" ? `/${commentId}/replies` : `/${commentId}/comments`;
  return graphRequest<{ id: string }>(path, { method: "POST", token, body: { message }, api });
}

/** ดึงชื่อของคนที่ทักมา (ถ้าดึงไม่ได้ก็ไม่เป็นไร) */
export async function fetchProfile(
  platform: Platform,
  userId: string,
  token: string,
  api?: GraphApi,
): Promise<{ name: string | null; username: string | null }> {
  const fields = platform === "instagram" ? "name,username" : "first_name,last_name,name";
  const data = await graphRequest<{ name?: string; username?: string; first_name?: string; last_name?: string }>(
    `/${userId}`,
    { token, query: { fields }, api },
  );
  const name = data.name ?? ([data.first_name, data.last_name].filter(Boolean).join(" ") || null);
  return { name, username: data.username ?? null };
}

interface ConversationParticipant {
  id?: string | number;
  name?: string;
}

/**
 * ชื่อลูกค้า Facebook จากห้องแชท Messenger ของเพจ (ใช้แทนเมื่อ fetchProfile ไม่ได้ชื่อ —
 * Meta ไม่ให้ดูโปรไฟล์ของคนที่ไม่มีบทบาทในแอป ถ้ายังไม่ได้ Advanced Access ของ "Business Asset User Profile Access")
 * GET /{pageId}/conversations?platform=messenger&user_id={psid}&fields=participants → ผู้ร่วมสนทนาที่ id ตรงกับ PSID
 * ไม่เจอห้องแชท/ไม่มีชื่อ → null, Meta ตอบ error → throw GraphApiError
 */
export async function fetchMessengerParticipantName(pageId: string, psid: string, token: string): Promise<string | null> {
  const data = await graphRequest<{ data?: { participants?: { data?: ConversationParticipant[] } }[] }>(
    `/${pageId}/conversations`,
    { token, query: { platform: "messenger", user_id: psid, fields: "participants" } },
  );
  for (const conversation of data.data ?? []) {
    const person = (conversation.participants?.data ?? []).find((p) => String(p.id) === psid);
    const name = person?.name?.trim();
    if (name) return name;
  }
  return null;
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
  /** Instagram: IMAGE | VIDEO | CAROUSEL_ALBUM (วิดีโอ/รีลเป็น VIDEO), Facebook: null */
  mediaType: string | null;
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
    mediaType: null,
  }));
}

interface InstagramMediaData {
  id: string;
  caption?: string;
  permalink?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
}

/**
 * Instagram Login: เอกสารของ Meta ระบุว่า field caption ใช้ได้เฉพาะ Facebook Login
 * → ขอ caption ก่อน ถ้า error ลองใหม่ 1 ครั้งโดยไม่ขอ caption (ช่องเลือกโพสต์จะได้ไม่พังทั้งหน้า)
 * api "facebook" (ผ่านเพจ) เรียกครั้งเดียวเหมือนเดิม
 */
async function withoutCaptionFallback<T>(api: GraphApi | undefined, fields: string, call: (fields: string) => Promise<T>): Promise<T> {
  if (api !== "instagram") return call(fields);
  try {
    return await call(fields);
  } catch (err) {
    if (!(err instanceof GraphApiError)) throw err;
    const withoutCaption = fields
      .split(",")
      .filter((f) => f !== "caption")
      .join(",");
    return call(withoutCaption);
  }
}

export async function listRecentInstagramPosts(
  igUserId: string,
  token: string,
  limit = 12,
  api?: GraphApi,
): Promise<RecentPost[]> {
  const data = await withoutCaptionFallback(api, "id,caption,permalink,media_type,media_url,thumbnail_url,timestamp", (fields) =>
    graphRequest<{ data: InstagramMediaData[] }>(`/${igUserId}/media`, { token, query: { fields, limit }, api }),
  );
  return (data.data ?? []).map((p) => ({
    id: p.id,
    platform: "instagram",
    caption: p.caption ?? "",
    permalink: p.permalink ?? null,
    imageUrl: (p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url) ?? null,
    createdAt: p.timestamp ?? null,
    mediaType: p.media_type ?? null,
  }));
}

export interface PostInfo {
  id: string;
  /** เวลาที่ลงโพสต์ (รูปแบบของ Meta เช่น 2026-10-10T08:00:00+0000) */
  createdAt: string | null;
  caption: string;
  permalink: string | null;
  /** Facebook: ใครเป็นคนลงโพสต์ (id ของเพจ หรือของคนที่มาโพสต์บนหน้าเพจ) — Instagram เป็น null */
  fromId: string | null;
}

/** ดูว่าโพสต์/รีลนี้ลงเมื่อไหร่ (ใช้กับกฎแบบ "โพสต์ถัดไป") */
export async function getPostInfo(platform: Platform, postId: string, token: string, api?: GraphApi): Promise<PostInfo> {
  if (platform === "instagram") {
    const data = await withoutCaptionFallback(api, "id,timestamp,caption,permalink", (fields) =>
      graphRequest<{ id?: string; timestamp?: string; caption?: string; permalink?: string }>(`/${postId}`, {
        token,
        query: { fields },
        api,
      }),
    );
    return {
      id: data.id ?? postId,
      createdAt: data.timestamp ?? null,
      caption: data.caption ?? "",
      permalink: data.permalink ?? null,
      fromId: null,
    };
  }
  const data = await graphRequest<{
    id?: string;
    created_time?: string;
    message?: string;
    permalink_url?: string;
    from?: { id?: string };
  }>(`/${postId}`, {
    token,
    query: { fields: "id,created_time,message,permalink_url,from" },
    api,
  });
  return {
    id: data.id ?? postId,
    createdAt: data.created_time ?? null,
    caption: data.message ?? "",
    permalink: data.permalink_url ?? null,
    fromId: data.from?.id ?? null,
  };
}

// ---------- Instagram Login (graph.instagram.com) ----------

/** Meta ตอบได้ทั้งแบบ object ตรง ๆ และแบบ { data: [object] } */
function firstObject(json: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(json.data)) {
    const first = json.data[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : {};
  }
  return json;
}

function textOrNull(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : typeof v === "number" ? String(v) : null;
}

export interface InstagramMe {
  /** user_id = IG account ID (17841…) ที่อยู่ใน entry.id ของ webhook และใช้ใน /{IG_ID}/messages */
  userId: string;
  /** id = app-scoped ID (ห้ามใช้ส่งข้อความ เก็บไว้จับคู่ webhook เท่านั้น) */
  appScopedId: string | null;
  username: string;
  name: string | null;
  /** Business | Media_Creator */
  accountType: string | null;
}

/** บัญชีเจ้าของ token (ใช้ user_id ไม่ใช่ id) */
export async function getInstagramMe(token: string): Promise<InstagramMe> {
  const json = await graphRequest("/me", {
    token,
    query: { fields: "id,user_id,username,name,account_type" },
    api: "instagram",
  });
  const o = firstObject(json);
  const userId = textOrNull(o.user_id);
  if (!userId) throw new Error("Instagram ไม่ได้บอก user_id ของบัญชีนี้");
  return {
    userId,
    appScopedId: textOrNull(o.id),
    username: textOrNull(o.username) ?? "",
    name: textOrNull(o.name),
    accountType: textOrNull(o.account_type),
  };
}

/** ให้บัญชี Instagram ส่ง webhook มาที่แอป (ต้องทำทุกบัญชี ตั้ง Callback URL อย่างเดียวไม่พอ) */
export async function subscribeInstagramAccount(token: string, fields: readonly string[]): Promise<void> {
  const res = await graphRequest<{ success?: boolean }>("/me/subscribed_apps", {
    method: "POST",
    token,
    query: { subscribed_fields: fields.join(",") },
    api: "instagram",
  });
  if (res.success !== true) throw new Error("Instagram ไม่ยืนยันการรับ webhook");
}

export async function unsubscribeInstagramAccount(token: string): Promise<void> {
  await graphRequest("/me/subscribed_apps", { method: "DELETE", token, api: "instagram" });
}

export interface InstagramTokenGrant {
  token: string;
  /** อายุ token เป็นวินาที (null = Meta ไม่ได้บอก) */
  expiresInSec: number | null;
}

function tokenGrant(json: Record<string, unknown>): InstagramTokenGrant {
  const o = firstObject(json);
  const token = textOrNull(o.access_token);
  if (!token) throw new Error("Instagram ไม่ได้ส่ง access token กลับมา");
  const expiresIn = Number(o.expires_in);
  return { token, expiresInSec: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : null };
}

/** แลก token อายุสั้นเป็น long-lived (60 วัน) — endpoint นี้ไม่มีเวอร์ชัน และใช้ Instagram app secret */
export async function exchangeInstagramToken(token: string, appSecret: string): Promise<InstagramTokenGrant> {
  const json = await graphRequest("/access_token", {
    token,
    query: { grant_type: "ig_exchange_token", client_secret: appSecret },
    api: "instagram",
    versioned: false,
  });
  return tokenGrant(json);
}

/** ต่ออายุ long-lived token อีก 60 วัน (token ต้องมีอายุ ≥ 24 ชม. และยังไม่หมดอายุ) — endpoint นี้ไม่มีเวอร์ชัน */
export async function refreshInstagramToken(token: string): Promise<InstagramTokenGrant> {
  const json = await graphRequest("/refresh_access_token", {
    token,
    query: { grant_type: "ig_refresh_token" },
    api: "instagram",
    versioned: false,
  });
  return tokenGrant(json);
}

/** แปลงเวลาที่ Meta ส่งมา ("+0000" ไม่มีโคลอน) เป็น ms — อ่านไม่ออกคืน null */
export function parseGraphTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(ms) ? null : ms;
}

/** รายละเอียด error สำหรับเก็บใน events.meta (หน้ากิจกรรมใช้แสดงสาเหตุ) */
export function errorInfo(err: unknown): Record<string, unknown> {
  if (err instanceof GraphApiError) return { message: err.message, code: err.code, subcode: err.subcode, status: err.status };
  return { message: (err as Error)?.message ?? String(err) };
}
