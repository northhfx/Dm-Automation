import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { rules, type NewRule } from "@/db/schema";
import type { FlowStep } from "@/lib/flows/types";
import { savePage } from "@/lib/pages";

export interface GraphCall {
  method: string;
  path: string;
  query: Record<string, string>;
  body: Record<string, unknown> | null;
}

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
 */
export async function startMockGraph() {
  const calls: GraphCall[] = [];
  let counter = 0;
  let posts: MockPost[] = [];
  let failWhen: ((call: GraphCall) => boolean) | null = null;
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname.replace(/^\/v\d+\.\d+/, "");
      const body = raw ? JSON.parse(raw) : null;
      calls.push({ method: req.method ?? "GET", path, query: Object.fromEntries(url.searchParams), body });

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

      if (req.method === "POST" && path.endsWith("/messages")) {
        counter++;
        const r = body.recipient as { id?: string; comment_id?: string };
        const recipientId = r.id ?? `PSID_FROM_${r.comment_id}`;
        return send(200, { recipient_id: recipientId, message_id: `m_${counter}` });
      }
      if (req.method === "POST" && (path.endsWith("/comments") || path.endsWith("/replies"))) {
        return send(200, { id: `reply_${++counter}` });
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
        return send(200, { first_name: "Mint", last_name: "Chan", name: "Mint Chan", username: "mint.ig" });
      }
      return send(404, { error: { message: `mock: unknown ${req.method} ${path}`, code: 803 } });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.GRAPH_API_BASE = `http://127.0.0.1:${port}`;
  return {
    calls,
    /** ล้างรายการ request ที่บันทึกไว้ (โพสต์และ failWhen ยังอยู่) */
    reset: () => calls.splice(0, calls.length),
    /** ล้างทุกอย่าง: request, โพสต์, failWhen */
    resetAll: () => {
      calls.splice(0, calls.length);
      posts = [];
      failWhen = null;
    },
    setPosts: (list: MockPost[]) => {
      posts = [...list];
    },
    failWhen: (fn: ((call: GraphCall) => boolean) | null) => {
      failWhen = fn;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export async function resetDatabase() {
  const db = getDb();
  await runMigrations();
  await db.execute(sql`
    TRUNCATE pages, rules, contacts, messages, links, events, jobs, dedup_keys, webhook_logs, settings RESTART IDENTITY
  `);
  await savePage(db, { id: "PAGE1", name: "ร้านทดสอบ", token: "PAGE_TOKEN", igUserId: "IG1", igUsername: "test.shop" });
  return db;
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
