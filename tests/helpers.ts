import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { instagramAccounts, rules, type GraphApi, type NewRule } from "@/db/schema";
import type { FlowStep } from "@/lib/flows/types";
import {
  getInstagramAccount,
  INSTAGRAM_TOKEN_TTL_MS,
  saveInstagramAccount,
  type InstagramAccount,
  type SaveInstagramAccountInput,
} from "@/lib/instagram/accounts";
import { savePage } from "@/lib/pages";

export interface GraphCall {
  method: string;
  /** path ที่ตัดเวอร์ชัน (/v23.0) ออกแล้ว เช่น /PAGE1/messages */
  path: string;
  query: Record<string, string>;
  body: Record<string, unknown> | null;
  /** ยิงไป graph.facebook.com ("facebook") หรือ graph.instagram.com ("instagram" = path ขึ้นต้นด้วย /ig) */
  api: GraphApi;
  /** path หลังตัด /ig ออก แต่ยังไม่ตัดเวอร์ชัน (ใช้ตรวจ endpoint ที่ไม่มีเวอร์ชัน เช่น /refresh_access_token) */
  rawPath: string;
  /** header Authorization (null = ไม่ได้ส่งมา) */
  authorization: string | null;
}

/** ผลของ GET /me บน Instagram Login (ค่าเริ่มต้น = บัญชี IG1 ที่ผูกกับเพจ PAGE1 ด้วย) */
export const DEFAULT_INSTAGRAM_ME: Record<string, unknown> = {
  id: "APPSCOPED1",
  user_id: "IG1",
  username: "test.shop",
  name: "ร้านทดสอบ",
  account_type: "Business",
};

/** โพสต์/รีลในเพจปลอม (Facebook id แบบ "PAGE1_xxx", Instagram id ของ media) */
export interface MockPost {
  id: string;
  platform: "facebook" | "instagram";
  /** ISO เช่น new Date().toISOString() — mock จะส่งกลับในรูปแบบของ Meta ("+0000") */
  createdAt: string;
  caption?: string;
  /** true = ดูรายละเอียดได้ แต่ยังไม่โผล่ในรายการโพสต์ล่าสุด (เช่น เพิ่งลง) */
  hidden?: boolean;
  /** Facebook: id ของคนที่ลงโพสต์ (ค่าเริ่มต้น = เพจ "PAGE1") ใช้จำลองโพสต์ของคนอื่นบนหน้าเพจ */
  from?: string;
}

/** ห้องแชท Messenger ของเพจปลอม (GET /{page-id}/conversations) — name ไม่กำหนด = Meta ไม่ส่งชื่อมา */
export interface MockConversation {
  userId: string;
  name?: string;
  /** ค่าเริ่มต้น "PAGE1" */
  pageId?: string;
}

/** เวลาในรูปแบบที่ Meta ส่งมา เช่น 2026-10-10T08:00:00+0000 */
function metaTime(iso: string): string {
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, "+0000");
}

/**
 * Graph API ปลอม สำหรับเทสโดยไม่ต้องยิงไปที่ Meta จริง
 * - ข้อความที่มีคำว่า FAIL_PERMANENT → error ถาวร
 * - ข้อความที่มีคำว่า FAIL_TRANSIENT → error ชั่วคราว (ควรลองใหม่)
 * - setPosts() กำหนดโพสต์ของเพจ (GET /{post-id}, /PAGE1/posts, /IG1/media)
 * - failWhen() ให้ request ที่ตรงเงื่อนไขตอบ error
 * - setProfiles() กำหนดผลของ GET /{user-id} (โปรไฟล์ลูกค้า) รายคน — ไม่กำหนด = Mint Chan / mint.ig
 * - setConversations() กำหนดห้องแชท Messenger ของเพจ (GET /{page-id}/conversations?user_id=...&fields=participants)
 * - Instagram Login (graph.instagram.com) อยู่ใต้ /ig ของเซิร์ฟเวอร์เดียวกัน:
 *   GET /me (token ขึ้นต้น EAA → code 3, IG_EXPIRED → code 190, ไม่งั้นตอบ setInstagramMe()),
 *   POST/DELETE /me/subscribed_apps, GET /access_token (ไม่มีเวอร์ชัน; token ขึ้นต้น IGSHORT เท่านั้นที่แลกได้),
 *   GET /refresh_access_token (ไม่มีเวอร์ชัน)
 */
export async function startMockGraph() {
  const calls: GraphCall[] = [];
  let counter = 0;
  let posts: MockPost[] = [];
  let failWhen: ((call: GraphCall) => boolean) | null = null;
  let instagramMe: Record<string, unknown> = { ...DEFAULT_INSTAGRAM_ME };
  let wrapInstagramMe = false;
  let profiles: Record<string, Record<string, unknown>> = {};
  let conversations: MockConversation[] = [];
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const isInstagram = url.pathname === "/ig" || url.pathname.startsWith("/ig/");
      const api: GraphApi = isInstagram ? "instagram" : "facebook";
      const rawPath = isInstagram ? url.pathname.slice("/ig".length) || "/" : url.pathname;
      const path = rawPath.replace(/^\/v\d+\.\d+/, "");
      const body = raw ? JSON.parse(raw) : null;
      const authorization = req.headers.authorization ?? null;
      calls.push({
        method: req.method ?? "GET",
        path,
        query: Object.fromEntries(url.searchParams),
        body,
        api,
        rawPath,
        authorization,
      });

      const send = (status: number, json: unknown) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(json));
      };

      if (failWhen?.(calls[calls.length - 1])) {
        return send(500, { error: { message: "mock: Graph API ล่ม", code: 1, is_transient: true } });
      }

      const text: string = body?.message?.text ?? body?.message?.attachment?.payload?.text ?? "";
      if (text.includes("FAIL_PERMANENT")) {
        return send(400, { error: { message: "(#551) This person isn't available right now.", code: 551 } });
      }
      if (text.includes("FAIL_TRANSIENT")) {
        return send(500, { error: { message: "An unexpected error has occurred.", code: 2, is_transient: true } });
      }

      if (api === "instagram") {
        const token = url.searchParams.get("access_token") ?? authorization?.replace(/^Bearer\s+/i, "") ?? "";
        const invalidToken = () =>
          send(400, {
            error: { message: "Invalid OAuth access token - Cannot parse access token", type: "OAuthException", code: 190 },
          });
        if (req.method === "GET" && path === "/me") {
          if (token.startsWith("EAA")) {
            return send(400, {
              error: { message: "(#3) Application does not have the capability to make this API call.", code: 3 },
            });
          }
          if (token.startsWith("IG_EXPIRED")) {
            return send(400, {
              error: { message: "Error validating access token: Session has expired.", type: "OAuthException", code: 190 },
            });
          }
          return send(200, wrapInstagramMe ? { data: [instagramMe] } : instagramMe);
        }
        if ((req.method === "POST" || req.method === "DELETE") && path === "/me/subscribed_apps") {
          return send(200, { success: true });
        }
        if (req.method === "GET" && rawPath === "/access_token") {
          if (!token.startsWith("IGSHORT")) return invalidToken();
          return send(200, { access_token: `IG_LONG_${++counter}`, token_type: "bearer", expires_in: 5183944 });
        }
        if (req.method === "GET" && rawPath === "/refresh_access_token") {
          return send(200, { access_token: `IG_REFRESHED_${++counter}`, token_type: "bearer", expires_in: 5184000 });
        }
        if (path === "/access_token" || path === "/refresh_access_token") {
          // Meta ระบุว่า endpoint นี้ไม่มีเวอร์ชัน — ตอบ error ให้เทสจับได้ถ้าเผลอใส่เวอร์ชัน
          return send(404, { error: { message: `mock: ${path} ต้องเรียกแบบไม่มีเวอร์ชัน`, code: 803 } });
        }
      }

      if (req.method === "POST" && path.endsWith("/messages")) {
        counter++;
        const r = body.recipient as { id?: string; comment_id?: string };
        const recipientId = r.id ?? `PSID_FROM_${r.comment_id}`;
        return send(200, { recipient_id: recipientId, message_id: `m_${counter}` });
      }
      if (req.method === "POST" && (path.endsWith("/comments") || path.endsWith("/replies"))) {
        return send(200, { id: `reply_${++counter}` });
      }
      const conversationsOf = api === "facebook" && req.method === "GET" ? /^\/([^/]+)\/conversations$/.exec(path) : null;
      if (conversationsOf) {
        const pageId = conversationsOf[1];
        const userId = url.searchParams.get("user_id");
        const list = conversations.filter((c) => (c.pageId ?? "PAGE1") === pageId && (!userId || c.userId === userId));
        return send(200, {
          data: list.map((c) => ({
            id: `t_${c.userId}`,
            participants: {
              data: [
                { id: c.userId, ...(c.name !== undefined && { name: c.name }), email: `${c.userId}@facebook.com` },
                { id: pageId, name: "ร้านทดสอบ", email: `${pageId}@facebook.com` },
              ],
            },
          })),
        });
      }
      if (req.method === "GET" && /^\/[^/]+\/(posts|media)$/.test(path)) {
        const platform = path.endsWith("/media") ? "instagram" : "facebook";
        const list = posts
          .filter((p) => p.platform === platform && !p.hidden)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, Number(url.searchParams.get("limit") ?? 25));
        return send(200, {
          data: list.map((p) =>
            platform === "instagram"
              ? { id: p.id, caption: p.caption, media_type: "VIDEO", timestamp: metaTime(p.createdAt), permalink: `https://ig/${p.id}` }
              : { id: p.id, message: p.caption, created_time: metaTime(p.createdAt), permalink_url: `https://fb/${p.id}` },
          ),
        });
      }
      const post = req.method === "GET" ? posts.find((p) => path === `/${p.id}`) : undefined;
      if (post) {
        return send(
          200,
          post.platform === "instagram"
            ? { id: post.id, caption: post.caption, timestamp: metaTime(post.createdAt), permalink: `https://ig/${post.id}` }
            : {
                id: post.id,
                message: post.caption,
                created_time: metaTime(post.createdAt),
                permalink_url: `https://fb/${post.id}`,
                from: { id: post.from ?? "PAGE1" },
              },
        );
      }
      if (req.method === "GET" && /^\/[^/]+$/.test(path)) {
        const profile = profiles[path.slice(1)];
        if (profile) return send(200, profile);
        return send(200, { first_name: "Mint", last_name: "Chan", name: "Mint Chan", username: "mint.ig" });
      }
      return send(404, { error: { message: `mock: unknown ${req.method} ${path}`, code: 803 } });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.GRAPH_API_BASE = `http://127.0.0.1:${port}`;
  process.env.INSTAGRAM_GRAPH_API_BASE = `http://127.0.0.1:${port}/ig`;
  return {
    calls,
    /** ล้างรายการ request ที่บันทึกไว้ (โพสต์และ failWhen ยังอยู่) */
    reset: () => calls.splice(0, calls.length),
    /** ล้างทุกอย่าง: request, โพสต์, failWhen, ผลของ /me (Instagram Login) */
    resetAll: () => {
      calls.splice(0, calls.length);
      posts = [];
      failWhen = null;
      instagramMe = { ...DEFAULT_INSTAGRAM_ME };
      wrapInstagramMe = false;
      profiles = {};
      conversations = [];
    },
    setPosts: (list: MockPost[]) => {
      posts = [...list];
    },
    failWhen: (fn: ((call: GraphCall) => boolean) | null) => {
      failWhen = fn;
    },
    /** ผลของ GET /{user-id} รายคน เช่น { PSID1: { id: "PSID1" } } = ดึงโปรไฟล์ได้แต่ไม่มีชื่อ */
    setProfiles: (map: Record<string, Record<string, unknown>>) => {
      profiles = { ...map };
    },
    /** ห้องแชท Messenger ของเพจ (ผู้ร่วมสนทนาคือลูกค้า userId และเพจเอง) */
    setConversations: (list: MockConversation[]) => {
      conversations = [...list];
    },
    /** กำหนดผลของ GET /me บน Instagram Login (wrap = ตอบแบบ {data:[me]}) */
    setInstagramMe: (me: Record<string, unknown>, o: { wrap?: boolean } = {}) => {
      instagramMe = { ...me };
      wrapInstagramMe = Boolean(o.wrap);
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export async function resetDatabase() {
  const db = getDb();
  await runMigrations();
  await db.execute(sql`
    TRUNCATE pages, instagram_accounts, rules, contacts, messages, links, events, inbox_items, link_checks, jobs, dedup_keys, webhook_logs, settings
    RESTART IDENTITY
  `);
  await savePage(db, { id: "PAGE1", name: "ร้านทดสอบ", token: "PAGE_TOKEN", igUserId: "IG1", igUsername: "test.shop" });
  return db;
}

/**
 * เชื่อมบัญชี Instagram ผ่าน Instagram Login (ไม่ยิง Meta) — ค่าเริ่มต้นคือ IG1 ตัวเดียวกับที่ผูกกับเพจ PAGE1
 * ดังนั้นหลังเรียกฟังก์ชันนี้ งานของ IG1 จะวิ่งผ่าน graph.instagram.com
 */
export async function seedInstagramAccount(
  db: Db,
  o: Partial<
    SaveInstagramAccountInput & {
      subscribed: boolean;
      tokenRefreshedAt: Date;
      lastCommentWebhookAt: Date | null;
      lastMessagingWebhookAt: Date | null;
    }
  > = {},
): Promise<InstagramAccount> {
  const id = o.id ?? "IG1";
  await saveInstagramAccount(db, {
    id,
    appScopedId: o.appScopedId === undefined ? "APPSCOPED1" : o.appScopedId,
    username: o.username ?? "test.shop",
    name: o.name === undefined ? "ร้านทดสอบ" : o.name,
    accountType: o.accountType === undefined ? "Business" : o.accountType,
    token: o.token ?? "IG_TOKEN",
    tokenExpiresAt: o.tokenExpiresAt ?? new Date(Date.now() + INSTAGRAM_TOKEN_TTL_MS),
    tokenExpiryEstimated: o.tokenExpiryEstimated ?? false,
  });
  await db
    .update(instagramAccounts)
    .set({
      subscribed: o.subscribed ?? true,
      ...(o.tokenRefreshedAt !== undefined && { tokenRefreshedAt: o.tokenRefreshedAt }),
      ...(o.lastCommentWebhookAt !== undefined && { lastCommentWebhookAt: o.lastCommentWebhookAt }),
      ...(o.lastMessagingWebhookAt !== undefined && { lastMessagingWebhookAt: o.lastMessagingWebhookAt }),
    })
    .where(eq(instagramAccounts.id, id));
  const account = await getInstagramAccount(db, id);
  if (!account) throw new Error(`seedInstagramAccount: ไม่พบบัญชี ${id}`);
  return account;
}

/** request POST ที่ลงลายเซ็นแบบเดียวกับ Meta (X-Hub-Signature-256) ด้วย secret ที่กำหนด */
export function signedPost(url: string, body: string, secret: string): NextRequest {
  const signature = "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return new NextRequest(url, {
    method: "POST",
    body,
    headers: { "content-type": "application/json", "x-hub-signature-256": signature },
  });
}

/** flow แบบเดียวกับ ManyChat: ข้อความแรกมีปุ่ม "ใช่ ฉันสนใจ" → ข้อความที่ 2 มีปุ่มเปิดลิงก์ */
export const TWO_STEP_FLOW: FlowStep[] = [
  {
    id: "s1",
    text: "สวัสดีค่ะ {name} สนใจรับรายละเอียดไหมคะ",
    buttons: [{ id: "b1", title: "ใช่ ฉันสนใจ", type: "next", nextStepId: "s2" }],
  },
  {
    id: "s2",
    text: "ขอบคุณค่ะ {name} รายละเอียดอยู่ด้านล่าง",
    buttons: [{ id: "b2", title: "ดูรายละเอียด", type: "link", url: "https://shop.example.com/product" }],
  },
];

/** ข้อความเดียว (มีหรือไม่มีปุ่มก็ได้) */
export function singleStep(text: string, buttons: FlowStep["buttons"] = []): FlowStep[] {
  return [{ id: "s1", text, buttons }];
}

export async function createRule(overrides: Partial<NewRule> = {}) {
  const [row] = await getDb()
    .insert(rules)
    .values({
      name: "ทดสอบ",
      trigger: "comment",
      platforms: ["facebook", "instagram"],
      matchType: "contains",
      keywords: ["สนใจ"],
      publicReplies: ["ส่งรายละเอียดให้ทาง DM แล้วนะคะ {name}"],
      steps: TWO_STEP_FLOW,
      ...overrides,
    })
    .returning();
  return row;
}
