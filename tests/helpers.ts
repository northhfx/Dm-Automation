import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { rules, type NewRule } from "@/db/schema";
import { savePage } from "@/lib/pages";

export interface GraphCall {
  method: string;
  path: string;
  query: Record<string, string>;
  body: Record<string, unknown> | null;
}

/**
 * Graph API ปลอม สำหรับเทสโดยไม่ต้องยิงไปที่ Meta จริง
 * - ข้อความที่มีคำว่า FAIL_PERMANENT → error ถาวร
 * - ข้อความที่มีคำว่า FAIL_TRANSIENT → error ชั่วคราว (ควรลองใหม่)
 */
export async function startMockGraph() {
  const calls: GraphCall[] = [];
  let counter = 0;
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

      const text: string = body?.message?.text ?? "";
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
    reset: () => calls.splice(0, calls.length),
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
      dmText: "สวัสดีค่ะ {name} รายละเอียดอยู่ที่ {link}",
      linkUrl: "https://shop.example.com/product",
      ...overrides,
    })
    .returning();
  return row;
}
