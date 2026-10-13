import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  contacts,
  events,
  instagramAccounts,
  jobs,
  links,
  messages,
  settings,
  webhookLogs,
  type WebhookVia,
} from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import { matchWebhookSignature } from "@/lib/automation/receive";
import { getSetupStatus } from "@/lib/config";
import { flowPayload } from "@/lib/flows/types";
import { getInstagramAccount } from "@/lib/instagram/accounts";
import { enqueue } from "@/lib/queue/queue";
import { drainQueue } from "@/lib/queue/worker";
import { clearNextPostCache } from "@/lib/rules/next-post";
import { GET as verifyMeta, POST as receiveMeta } from "@/app/api/webhooks/meta/route";
import { GET as verifyInstagram, POST as receiveInstagram } from "@/app/api/webhooks/instagram/route";
import {
  createRule,
  resetDatabase,
  seedInstagramAccount,
  signedPost,
  singleStep,
  startMockGraph,
  TWO_STEP_FLOW,
  type GraphCall,
} from "./helpers";
import { fbDm, igComment, igDm, igQuickReply, postback } from "./fixtures";

/*
 * Instagram Login (graph.instagram.com) — รับ webhook, เลือกช่องทาง, กันตอบซ้ำ
 * ค่าเริ่มต้นของเทส: เพจ PAGE1 ผูกกับ IG1 (@test.shop) — ถ้า seedInstagramAccount() ด้วย IG1 งานของ IG1 จะวิ่งผ่าน Instagram Login
 */

let graph: Awaited<ReturnType<typeof startMockGraph>>;
let db: Db;

beforeAll(async () => {
  graph = await startMockGraph();
});
afterAll(async () => {
  await graph.close();
});
beforeEach(async () => {
  process.env.INSTAGRAM_DM_PER_HOUR = "180";
  db = await resetDatabase();
  graph.resetAll();
  clearNextPostCache();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const IG_TOKEN_MESSAGE = "token ของ Instagram ใช้ไม่ได้ — ไปที่ ตั้งค่า → บัญชี Instagram แล้ววาง token ใหม่";
const DAY = 24 * 60 * 60_000;

async function deliver(payload: unknown, via?: WebhookVia) {
  await ingestWebhook(db, payload, { via });
  await drainQueue(db);
}

async function eventRows() {
  return db.select().from(events).orderBy(events.id);
}

async function eventTypes() {
  return (await eventRows()).map((e) => e.type);
}

/** ข้อความที่ส่งออก (ทั้ง DM และ Private Reply) ไม่ว่าจะผ่าน API ไหน */
function sends(): GraphCall[] {
  return graph.calls.filter((c) => c.method === "POST" && c.path.endsWith("/messages"));
}

type ButtonTemplate = { template_type: string; text: string; buttons: { type: string; title: string; payload?: string; url?: string }[] };
function templateOf(call: GraphCall): ButtonTemplate {
  return (call.body!.message as { attachment: { payload: ButtonTemplate } }).attachment.payload;
}

async function setting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return row?.value ?? null;
}

describe("Webhook: ตรวจลายเซ็นด้วย secret ทุกตัว แล้วจำว่ามาทางไหน", () => {
  it("matchWebhookSignature คืน via ของ secret ตัวแรกที่ตรง", async () => {
    const body = JSON.stringify(igComment());
    const sig = (secret: string) => signedPost("https://x", body, secret).headers.get("x-hub-signature-256");
    const secrets = [
      { secret: "fb-secret", via: "facebook_login" as const },
      { secret: "ig-secret", via: "instagram_login" as const },
    ];
    expect(matchWebhookSignature(body, sig("fb-secret"), secrets)).toBe("facebook_login");
    expect(matchWebhookSignature(body, sig("ig-secret"), secrets)).toBe("instagram_login");
    expect(matchWebhookSignature(body, sig("other"), secrets)).toBeNull();
    expect(matchWebhookSignature(body, null, secrets)).toBeNull();
    expect(matchWebhookSignature(body, sig("ig-secret"), [])).toBeNull();
  });

  it("/api/webhooks/meta ที่ลงลายเซ็นด้วย Instagram app secret → รับ และบันทึกว่ามาทาง Instagram Login", async () => {
    const body = JSON.stringify(igComment());
    const res = await receiveMeta(signedPost("https://x/api/webhooks/meta", body, "test-ig-app-secret"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("EVENT_RECEIVED");

    const [log] = await db.select().from(webhookLogs);
    expect(log).toMatchObject({ object: "instagram", source: "instagram_login" });
    const queued = await db.select().from(jobs);
    expect(queued).toHaveLength(1);
    expect(queued[0].payload).toMatchObject({ type: "comment", commentId: "IGC1", via: "instagram_login" });
  });

  it("ลงลายเซ็นด้วย App Secret ของ Facebook → มาทาง Facebook Login (ทั้งสอง URL)", async () => {
    const body = JSON.stringify(igComment());
    expect((await receiveMeta(signedPost("https://x/api/webhooks/meta", body, "test-app-secret"))).status).toBe(200);
    // ใส่ URL สลับกันก็ไม่ทำให้ข้อมูลหาย
    expect((await receiveInstagram(signedPost("https://x/api/webhooks/instagram", body, "test-app-secret"))).status).toBe(200);

    const logs = await db.select().from(webhookLogs).orderBy(webhookLogs.id);
    expect(logs.map((l) => l.source)).toEqual(["facebook_login", "facebook_login"]);
    const queued = await db.select().from(jobs);
    expect(queued.map((j) => (j.payload as { via?: string }).via)).toEqual(["facebook_login", "facebook_login"]);
  });

  it("/api/webhooks/instagram ที่ลงลายเซ็นด้วย Instagram app secret → instagram_login", async () => {
    const body = JSON.stringify(igDm());
    const res = await receiveInstagram(signedPost("https://x/api/webhooks/instagram", body, "test-ig-app-secret"));
    expect(res.status).toBe(200);
    const [log] = await db.select().from(webhookLogs);
    expect(log.source).toBe("instagram_login");
    const [job] = await db.select().from(jobs);
    expect(job.payload).toMatchObject({ type: "dm", via: "instagram_login" });
  });

  it("ลายเซ็นไม่ตรงที่ /api/webhooks/meta → 401 และขึ้นคำเตือนของ Facebook เท่านั้น", async () => {
    const res = await receiveMeta(signedPost("https://x/api/webhooks/meta", JSON.stringify(igComment()), "wrong-secret"));
    expect(res.status).toBe(401);
    expect(await db.select().from(jobs)).toHaveLength(0);
    expect(await db.select().from(webhookLogs)).toHaveLength(0);
    expect(await setting("webhook_bad_signature_at")).not.toBeNull();
    expect(await setting("instagram_webhook_bad_signature_at")).toBeNull();
  });

  it("ลายเซ็นไม่ตรงที่ /api/webhooks/instagram → 401 และขึ้นคำเตือนของ Instagram เท่านั้น", async () => {
    const res = await receiveInstagram(
      signedPost("https://x/api/webhooks/instagram", JSON.stringify(igComment()), "wrong-secret"),
    );
    expect(res.status).toBe(401);
    expect(await db.select().from(jobs)).toHaveLength(0);
    expect(await setting("instagram_webhook_bad_signature_at")).not.toBeNull();
    expect(await setting("webhook_bad_signature_at")).toBeNull();
    const status = await getSetupStatus(db);
    expect(status.instagram.badSignatureAt).not.toBeNull();
    expect(status.badSignatureAt).toBeNull();
  });

  it("ไม่มีลายเซ็น / JSON เสีย", async () => {
    const noHeader = new NextRequest("https://x/api/webhooks/instagram", { method: "POST", body: "{}" });
    expect((await receiveInstagram(noHeader)).status).toBe(401);
    const bad = await receiveInstagram(signedPost("https://x/api/webhooks/instagram", "{not json", "test-ig-app-secret"));
    expect(bad.status).toBe(400);
    expect(await db.select().from(webhookLogs)).toHaveLength(0);
  });

  it("POST มั่วๆ ที่ /api/webhooks/instagram (ไม่น่าใช่ Meta) → 401 และไม่ขึ้นคำเตือนว่า secret ผิด", async () => {
    const url = "https://x/api/webhooks/instagram";
    const raw = (body: string, headers: Record<string, string> = {}) =>
      receiveInstagram(new NextRequest(url, { method: "POST", body, headers }));
    expect((await raw("hello")).status).toBe(401);
    expect((await raw("hello", { "x-hub-signature-256": "sha256=zz" })).status).toBe(401);
    expect((await raw(JSON.stringify(igComment()), { "x-hub-signature-256": `sha256=${"0".repeat(64)}x` })).status).toBe(401);
    // ลายเซ็นรูปแบบถูก แต่ไม่ใช่ JSON ของ Meta / ไม่ใช่บัญชีที่เชื่อมไว้
    expect((await receiveInstagram(signedPost(url, "hello", "attacker"))).status).toBe(401);
    expect((await receiveInstagram(signedPost(url, JSON.stringify({ object: "instagram" }), "attacker"))).status).toBe(401);
    const stranger = JSON.parse(JSON.stringify(igComment())) as { entry: { id: string }[] };
    stranger.entry[0].id = "IG_NOT_CONNECTED";
    expect((await receiveInstagram(signedPost(url, JSON.stringify(stranger), "attacker"))).status).toBe(401);

    expect(await setting("instagram_webhook_bad_signature_at")).toBeNull();
    expect(await setting("webhook_bad_signature_at")).toBeNull();
    expect((await getSetupStatus(db)).instagram.badSignatureAt).toBeNull();
    expect(await db.select().from(jobs)).toHaveLength(0);

    // บัญชีที่เชื่อมผ่าน Instagram Login (จับคู่ด้วย app_scoped_id ก็ได้) + ลายเซ็นไม่ตรง → เตือนตามปกติ
    await seedInstagramAccount(db, { id: "IG9", appScopedId: "APPSCOPED9", username: "nine.shop" });
    const scoped = JSON.parse(JSON.stringify(igComment())) as { entry: { id: string }[] };
    scoped.entry[0].id = "APPSCOPED9";
    expect((await receiveInstagram(signedPost(url, JSON.stringify(scoped), "wrong-secret"))).status).toBe(401);
    expect(await setting("instagram_webhook_bad_signature_at")).not.toBeNull();
  });

  it("GET /api/webhooks/instagram ยืนยัน URL → 200 และจำว่า Instagram ยืนยันแล้ว (ไม่แตะสถานะของ Facebook)", async () => {
    const url = "https://x/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=ig123";
    const ok = await verifyInstagram(new NextRequest(url));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("ig123");

    const status = await getSetupStatus(db);
    expect(status.instagram.webhookVerifiedAt).not.toBeNull();
    expect(status.webhookVerifiedAt).toBeNull();

    const bad = await verifyInstagram(new NextRequest(url.replace("test-verify-token", "wrong")));
    expect(bad.status).toBe(403);
  });

  it("GET /api/webhooks/meta ยังจำสถานะของ Facebook เหมือนเดิม", async () => {
    const ok = await verifyMeta(
      new NextRequest("https://x/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=fb1"),
    );
    expect(ok.status).toBe(200);
    const status = await getSetupStatus(db);
    expect(status.webhookVerifiedAt).not.toBeNull();
    expect(status.instagram.webhookVerifiedAt).toBeNull();
  });

  it("ยังไม่ได้ใส่ secret เลยสักตัว → 503", async () => {
    const saved = {
      META_APP_SECRET: process.env.META_APP_SECRET,
      INSTAGRAM_APP_SECRET: process.env.INSTAGRAM_APP_SECRET,
      INSTAGRAM_META_APP_SECRET: process.env.INSTAGRAM_META_APP_SECRET,
    };
    delete process.env.META_APP_SECRET;
    delete process.env.INSTAGRAM_APP_SECRET;
    delete process.env.INSTAGRAM_META_APP_SECRET;
    try {
      const body = JSON.stringify(igComment());
      expect((await receiveMeta(signedPost("https://x/api/webhooks/meta", body, "test-app-secret"))).status).toBe(503);
      expect((await receiveInstagram(signedPost("https://x/api/webhooks/instagram", body, "x"))).status).toBe(503);
      expect(await db.select().from(jobs)).toHaveLength(0);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});

describe("เลือกช่องทางตามฐานข้อมูล: บัญชีที่เชื่อม Instagram Login ใช้ graph.instagram.com ทุกครั้ง", () => {
  it("คอมเมนต์ → Private Reply และตอบคอมเมนต์ผ่าน Instagram Login ด้วย token ของ Instagram", async () => {
    await seedInstagramAccount(db);
    const rule = await createRule();
    await deliver(igComment({ text: "สนใจ" }), "instagram_login");

    const [dm] = sends();
    expect(dm).toMatchObject({ api: "instagram", path: "/IG1/messages", authorization: null });
    expect(dm.query.access_token).toBe("IG_TOKEN");
    expect(dm.query.appsecret_proof).toBeUndefined();
    expect(dm.body).toMatchObject({ recipient: { comment_id: "IGC1" }, messaging_type: "RESPONSE" });
    expect(templateOf(dm)).toEqual({
      template_type: "button",
      text: "สวัสดีค่ะ mint.shop สนใจรับรายละเอียดไหมคะ",
      buttons: [{ type: "postback", title: "ใช่ ฉันสนใจ", payload: flowPayload(rule.id, "s1", "b1") }],
    });

    const reply = graph.calls.find((c) => c.path === "/IGC1/replies")!;
    expect(reply).toMatchObject({ api: "instagram", method: "POST" });
    expect(reply.query.access_token).toBe("IG_TOKEN");
    expect(graph.calls.filter((c) => c.api === "facebook")).toHaveLength(0);

    const rows = await eventRows();
    expect(rows.map((e) => e.type)).toEqual(["comment_received", "rule_triggered", "public_reply_sent", "dm_sent"]);
    expect(rows.every((e) => e.pageId === "IG1")).toBe(true);
    expect(rows[0].meta).toMatchObject({ via: "instagram_login", commentId: "IGC1" });
    expect(rows[1].meta).toMatchObject({ via: "instagram_login", trigger: "comment" });

    const [msg] = await db.select().from(messages);
    expect(msg).toMatchObject({ pageId: "IG1", platform: "instagram", status: "sent" });
    const [job] = await db.select().from(jobs).where(eq(jobs.type, "send_dm"));
    expect(job.payload).toMatchObject({ pageId: "IG1", api: "instagram" });
  });

  it("ไม่ได้เชื่อม Instagram Login → ใช้เพจเหมือนเดิม (/PAGE1/messages บน graph.facebook.com)", async () => {
    await createRule();
    await deliver(igComment({ text: "สนใจ" }), "facebook_login");

    const [dm] = sends();
    expect(dm).toMatchObject({ api: "facebook", path: "/PAGE1/messages" });
    expect(dm.query.appsecret_proof).toBeTruthy();
    expect(graph.calls.find((c) => c.path === "/IGC1/replies")?.api).toBe("facebook");
    expect(graph.calls.filter((c) => c.api === "instagram")).toHaveLength(0);
    expect((await eventRows()).every((e) => e.pageId === "PAGE1")).toBe(true);
    const [job] = await db.select().from(jobs).where(eq(jobs.type, "send_dm"));
    expect(job.payload).toMatchObject({ pageId: "PAGE1", api: "facebook" });
  });

  it("webhook ที่ entry.id เป็น app-scoped id ก็หาบัญชีเจอ", async () => {
    await seedInstagramAccount(db);
    await createRule({ publicReplies: [] });
    const payload = igComment();
    payload.entry[0].id = "APPSCOPED1";
    await deliver(payload, "instagram_login");
    expect(sends().map((c) => [c.api, c.path])).toEqual([["instagram", "/IG1/messages"]]);
  });
});

describe("DM และปุ่มผ่าน Instagram Login", () => {
  it("ดึงโปรไฟล์ ส่งข้อความที่มีปุ่ม แล้วกดปุ่ม (postback และ quick reply) → ส่งข้อความถัดไปพร้อมลิงก์ติดตาม", async () => {
    await seedInstagramAccount(db);
    const rule = await createRule({ trigger: "dm", keywords: ["สนใจ"], steps: TWO_STEP_FLOW });
    await deliver(igDm({ text: "สนใจค่ะ" }), "instagram_login");

    const profile = graph.calls.find((c) => c.method === "GET" && c.path === "/IGSID1")!;
    expect(profile).toMatchObject({ api: "instagram" });
    expect(profile.query).toMatchObject({ fields: "name,username", access_token: "IG_TOKEN" });

    const [first] = sends();
    expect(first).toMatchObject({ api: "instagram", path: "/IG1/messages" });
    expect(first.body).toMatchObject({ recipient: { id: "IGSID1" } });
    expect(templateOf(first).text).toBe("สวัสดีค่ะ mint.ig สนใจรับรายละเอียดไหมคะ");
    expect(templateOf(first).buttons[0]).toEqual({
      type: "postback",
      title: "ใช่ ฉันสนใจ",
      payload: flowPayload(rule.id, "s1", "b1"),
    });

    const [contact] = await db.select().from(contacts);
    expect(contact).toMatchObject({ platform: "instagram", pageId: "IG1", username: "mint.ig" });

    graph.reset();
    await deliver(postback("instagram", flowPayload(rule.id, "s1", "b1")), "instagram_login");
    const [second] = sends();
    expect(second).toMatchObject({ api: "instagram", path: "/IG1/messages" });
    const tpl = templateOf(second);
    expect(tpl.text).toBe("ขอบคุณค่ะ mint.ig รายละเอียดอยู่ด้านล่าง");
    expect(tpl.buttons).toHaveLength(1);
    expect(tpl.buttons[0]).toMatchObject({ type: "web_url", title: "ดูรายละเอียด" });
    expect(tpl.buttons[0].url).toMatch(/^https:\/\/dm\.example\.com\/r\/[A-Za-z0-9]{8}$/);
    const [link] = await db.select().from(links);
    expect(link).toMatchObject({ ruleId: rule.id, stepId: "s2", contactId: contact.id, platform: "instagram" });

    const tap = (await db.select().from(events).where(eq(events.type, "button_clicked")))[0];
    expect(tap).toMatchObject({ pageId: "IG1", ruleId: rule.id, contactId: contact.id });
    expect(tap.meta).toMatchObject({ stepId: "s1", buttonId: "b1", via: "instagram_login" });

    // กด quick reply (ถ้าใช้แทนปุ่ม) ก็พาไปข้อความถัดไปเหมือนกัน
    graph.reset();
    await deliver(igQuickReply(flowPayload(rule.id, "s1", "b1"), { mid: "igqr.9" }), "instagram_login");
    const [third] = sends();
    expect(third).toMatchObject({ api: "instagram", path: "/IG1/messages" });
    expect(templateOf(third).text).toBe("ขอบคุณค่ะ mint.ig รายละเอียดอยู่ด้านล่าง");
    expect(graph.calls.filter((c) => c.api === "facebook")).toHaveLength(0);

    const types = await eventTypes();
    expect(types.filter((t) => t === "button_clicked")).toHaveLength(2);
    expect(types.filter((t) => t === "dm_sent")).toHaveLength(3);
    const received = (await db.select().from(events).where(eq(events.type, "dm_received")))[0];
    expect(received.meta).toMatchObject({ via: "instagram_login" });
    const account = await getInstagramAccount(db, "IG1");
    expect(account?.lastMessagingWebhookAt).not.toBeNull();
    expect(account?.lastCommentWebhookAt).toBeNull();
  });
});

describe("กันตอบซ้ำเมื่อ Meta ส่งเหตุการณ์เดียวกันมาทั้งสองช่องทาง", () => {
  it("มาทาง Facebook Login ก่อน แล้วตามด้วย Instagram Login → ส่งครั้งเดียว", async () => {
    await seedInstagramAccount(db);
    await createRule();
    await deliver(igComment(), "facebook_login");
    await deliver(igComment(), "instagram_login");

    expect(sends()).toHaveLength(1);
    expect(sends()[0].api).toBe("instagram");
    expect(graph.calls.filter((c) => c.path === "/IGC1/replies")).toHaveLength(1);
    expect((await eventTypes()).filter((t) => t === "comment_received")).toHaveLength(1);
    // ช่องทาง Instagram Login ส่งมาแล้ว → จำไว้
    expect((await getInstagramAccount(db, "IG1"))?.lastCommentWebhookAt).not.toBeNull();
  });

  it("มาทาง Instagram Login ก่อน แล้วตามด้วย Facebook Login → ส่งครั้งเดียว", async () => {
    await seedInstagramAccount(db);
    await createRule();
    await deliver(igComment(), "instagram_login");
    await deliver(igComment(), "facebook_login");

    expect(sends()).toHaveLength(1);
    expect(graph.calls.filter((c) => c.path === "/IGC1/replies")).toHaveLength(1);
    expect((await eventTypes()).filter((t) => t === "comment_received")).toHaveLength(1);
  });
});

describe("คอมเมนต์ที่มาทาง Facebook Login ไม่ถูกข้ามตามเวลา (comment id เดียวกันทั้งสองช่องทาง กันซ้ำด้วยคีย์)", () => {
  it("Instagram Login เพิ่งส่งคอมเมนต์มา → คอมเมนต์ที่มาทาง Facebook Login ยังประมวลผล และสำเนาจาก Instagram Login ไม่ตอบซ้ำ", async () => {
    await seedInstagramAccount(db, { lastCommentWebhookAt: new Date() });
    await createRule();
    await deliver(igComment({ commentId: "IGC7" }), "facebook_login");
    expect(sends().map((c) => [c.api, c.path])).toEqual([["instagram", "/IG1/messages"]]);
    const [received] = await eventRows();
    expect(received).toMatchObject({ type: "comment_received", pageId: "IG1" });
    expect(received.meta).toMatchObject({ via: "facebook_login" });

    // สำเนาจาก Instagram Login ของคอมเมนต์เดียวกัน → ไม่ตอบซ้ำ
    graph.reset();
    await deliver(igComment({ commentId: "IGC7" }), "instagram_login");
    expect(graph.calls).toHaveLength(0);
    expect((await eventTypes()).filter((t) => t === "comment_received")).toHaveLength(1);
  });

  it("คอมเมนต์ของร้านเองที่มาทาง Instagram Login → ข้าม และไม่จดว่าช่องทางนี้ส่งคอมเมนต์มาแล้ว", async () => {
    await seedInstagramAccount(db);
    await createRule();
    // from.id เป็น ID แบบ scoped (ไม่มี self_ig_scoped_id) จับได้จากชื่อผู้ใช้อย่างเดียว
    await deliver(igComment({ fromId: "IGSID_OF_SHOP", fromUsername: "test.shop", commentId: "OWN1" }), "instagram_login");
    expect(graph.calls).toHaveLength(0);
    expect(await eventTypes()).toEqual([]);
    expect((await getInstagramAccount(db, "IG1"))?.lastCommentWebhookAt).toBeNull();

    // คอมเมนต์ลูกค้าที่ตามมาทาง Facebook Login ต้องได้รับการตอบตามปกติ
    await deliver(igComment({ fromId: "CUSTOMER", commentId: "C2" }), "facebook_login");
    expect(sends().map((c) => [c.api, c.path])).toEqual([["instagram", "/IG1/messages"]]);
    expect(graph.calls.filter((c) => c.path === "/C2/replies")).toHaveLength(1);
    expect(await eventTypes()).toContain("comment_received");
  });

  it("คนที่มีชื่อในแอปคอมเมนต์ผ่าน Instagram Login แล้ว → คอมเมนต์ลูกค้าทาง Facebook Login ยังได้รับการตอบ", async () => {
    await seedInstagramAccount(db);
    await createRule();
    await deliver(igComment({ fromId: "TESTER1", fromUsername: "friend.tester", commentId: "T1" }), "instagram_login");
    expect((await getInstagramAccount(db, "IG1"))?.lastCommentWebhookAt).not.toBeNull();
    expect(sends()).toHaveLength(1);

    graph.reset();
    await deliver(igComment({ fromId: "CUSTOMER", fromUsername: "customer.ig", commentId: "C3" }), "facebook_login");
    expect(sends().map((c) => [c.api, c.path])).toEqual([["instagram", "/IG1/messages"]]);
    expect((await eventTypes()).filter((t) => t === "comment_received")).toHaveLength(2);
  });
});

describe("ข้าม DM ที่มาทาง Facebook Login เมื่อช่องทาง Instagram Login ส่ง DM มาแล้ว (ภายใน 7 วัน)", () => {
  it("งาน DM ที่เข้าคิวไว้ก่อนมี via → ถือว่ามาทาง Facebook Login (ข้ามเมื่อ Instagram Login ส่ง DM มาแล้ว)", async () => {
    await seedInstagramAccount(db, { lastMessagingWebhookAt: new Date() });
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    await enqueue(db, "dm", {
      type: "dm",
      platform: "instagram",
      accountId: "IG1",
      senderId: "IGSID1",
      mid: "OLDMID1",
      text: "ราคา",
      payload: null,
    });
    await drainQueue(db);
    expect(graph.calls).toHaveLength(0);
    expect(await eventTypes()).toEqual([]);
  });

  it("Instagram Login ส่ง DM ล่าสุดเมื่อ 8 วันก่อน → ใช้ DM จาก Facebook Login (ส่งออกทาง Instagram Login)", async () => {
    await seedInstagramAccount(db, { lastMessagingWebhookAt: new Date(Date.now() - 8 * DAY) });
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    await deliver(igDm({ text: "ราคา" }), "facebook_login");
    expect(sends().map((c) => [c.api, c.path])).toEqual([["instagram", "/IG1/messages"]]);
    const [received] = await eventRows();
    expect(received).toMatchObject({ type: "dm_received", pageId: "IG1" });
    expect(received.meta).toMatchObject({ via: "facebook_login" });
  });

  it("Instagram Login ยังไม่เคยส่ง DM มา → DM ที่มาทาง Facebook Login ประมวลผล (ส่งออกทาง Instagram Login)", async () => {
    // คอมเมนต์ผ่าน Instagram Login ได้แล้ว แต่ DM ยังไม่เคยมา → นับแยกกัน
    await seedInstagramAccount(db, { lastCommentWebhookAt: new Date(), lastMessagingWebhookAt: null });
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    await deliver(igDm({ text: "ราคา" }), "facebook_login");

    expect(sends().map((c) => [c.api, c.path])).toEqual([["instagram", "/IG1/messages"]]);
    expect(graph.calls.find((c) => c.path === "/IGSID1")?.api).toBe("instagram");
    expect(await eventTypes()).toEqual(["dm_received", "rule_triggered", "dm_sent"]);
    expect((await getInstagramAccount(db, "IG1"))?.lastMessagingWebhookAt).toBeNull();
  });

  it("หลังได้รับ DM ทาง Instagram Login แล้ว DM ที่มาทาง Facebook Login ถูกข้าม", async () => {
    await seedInstagramAccount(db);
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    await deliver(igDm({ text: "ราคา", mid: "igmid.A" }), "instagram_login");
    expect(sends()).toHaveLength(1);
    expect((await getInstagramAccount(db, "IG1"))?.lastMessagingWebhookAt).not.toBeNull();

    const before = await eventTypes();
    graph.reset();
    await deliver(igDm({ text: "ราคา", mid: "igmid.B", senderId: "IGSID2" }), "facebook_login");
    expect(graph.calls).toHaveLength(0);
    expect(await eventTypes()).toEqual(before);
    expect(await db.select().from(contacts)).toHaveLength(1);
  });
});

describe("กรณีอื่นๆ", () => {
  it("งาน send_dm แบบเก่า (pageId = PAGE1 ไม่มี api) → ส่งผ่าน Instagram Login ถ้าเชื่อมไว้", async () => {
    await seedInstagramAccount(db);
    const rule = await createRule({ publicReplies: [] });
    await enqueue(db, "send_dm", {
      type: "send_dm",
      platform: "instagram",
      pageId: "PAGE1",
      ruleId: rule.id,
      stepId: "s1",
      source: "comment",
      recipient: { comment_id: "IGC9" },
      actorId: "IGUSER9",
      actorName: "nok.shop",
      postId: null,
    });
    await drainQueue(db);

    expect(sends().map((c) => [c.api, c.path])).toEqual([["instagram", "/IG1/messages"]]);
    expect(sends()[0].query.access_token).toBe("IG_TOKEN");
    expect(graph.calls.filter((c) => c.api === "facebook")).toHaveLength(0);
    const [msg] = await db.select().from(messages);
    expect(msg).toMatchObject({ pageId: "IG1", status: "sent" });
  });

  it("งาน send_dm ที่ระบุ api instagram แต่ยกเลิก Instagram Login ไปแล้ว → กลับไปส่งผ่านเพจ", async () => {
    const rule = await createRule({ publicReplies: [] });
    await enqueue(db, "send_dm", {
      type: "send_dm",
      platform: "instagram",
      pageId: "IG1",
      api: "instagram",
      ruleId: rule.id,
      stepId: "s1",
      source: "comment",
      recipient: { comment_id: "IGC9" },
      actorId: "IGUSER9",
      actorName: "nok.shop",
      postId: null,
    });
    await drainQueue(db);
    expect(sends().map((c) => [c.api, c.path])).toEqual([["facebook", "/PAGE1/messages"]]);
  });

  it("token ของ Instagram ถอดรหัสไม่ได้ → dm_failed พร้อมบอกให้วาง token ใหม่", async () => {
    await seedInstagramAccount(db);
    await db.update(instagramAccounts).set({ accessToken: "not-encrypted" }).where(eq(instagramAccounts.id, "IG1"));
    await createRule();
    await deliver(igComment(), "instagram_login");

    expect(graph.calls).toHaveLength(0);
    const rows = await eventRows();
    expect(rows.map((e) => e.type)).toEqual(["comment_received", "dm_failed"]);
    expect(rows[1]).toMatchObject({ pageId: "IG1", platform: "instagram" });
    expect(rows[1].meta).toEqual({ api: "instagram", error: { message: IG_TOKEN_MESSAGE } });
  });

  it("Instagram ตอบ code 190 (token ใช้ไม่ได้) → บันทึก error ที่บัญชี และ dm_failed บอกว่าส่งผ่าน API ไหน", async () => {
    await seedInstagramAccount(db);
    await createRule({ publicReplies: [] });
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname.startsWith("/ig/") && url.pathname.endsWith("/messages")) {
        return new Response(
          JSON.stringify({
            error: { message: "Error validating access token: The session has been invalidated.", type: "OAuthException", code: 190 },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      return realFetch(input, init);
    });
    await deliver(igComment(), "instagram_login");

    const failed = (await db.select().from(events).where(eq(events.type, "dm_failed")))[0];
    expect(failed).toMatchObject({ pageId: "IG1", platform: "instagram" });
    expect(failed.meta).toMatchObject({ api: "instagram", source: "comment", error: { code: 190 } });
    expect(await db.select().from(jobs).where(eq(jobs.status, "pending"))).toHaveLength(0);
    expect((await getInstagramAccount(db, "IG1"))?.lastError).toBe(IG_TOKEN_MESSAGE);
  });

  it("error อื่นที่ไม่ใช่เรื่อง token ไม่แตะสถานะบัญชี", async () => {
    await seedInstagramAccount(db);
    await createRule({ publicReplies: [], steps: singleStep("FAIL_PERMANENT") });
    await deliver(igComment(), "instagram_login");
    expect((await eventTypes()).at(-1)).toBe("dm_failed");
    expect((await getInstagramAccount(db, "IG1"))?.lastError).toBeNull();
  });

  it("คอมเมนต์จาก @test.shop (บัญชีร้านเอง) → ข้าม", async () => {
    await seedInstagramAccount(db);
    await createRule();
    await deliver(igComment({ fromUsername: "test.shop", fromId: "IGSCOPED_X", commentId: "SELF1" }), "instagram_login");
    await deliver(igComment({ fromUsername: "Test.Shop", fromId: "IGSCOPED_Y", commentId: "SELF2" }), "instagram_login");
    // entry.id เป็น app-scoped id แต่ from.id เป็น IG account ID ของร้าน
    const own = igComment({ fromUsername: "renamed", fromId: "IG1", commentId: "SELF3" });
    own.entry[0].id = "APPSCOPED1";
    await deliver(own, "instagram_login");
    expect(graph.calls).toHaveLength(0);
    expect(await eventTypes()).toEqual([]);

    // คอมเมนต์ของคนอื่นยังตอบตามปกติ
    await deliver(igComment({ commentId: "OTHER1" }), "instagram_login");
    expect(sends()).toHaveLength(1);
  });

  it("คอมเมนต์จาก @test.shop ที่มาทางเพจ (ไม่ได้เชื่อม Instagram Login) → ข้ามเหมือนกัน", async () => {
    await createRule();
    await deliver(igComment({ fromUsername: "test.shop", fromId: "IGSCOPED_X" }));
    expect(graph.calls).toHaveLength(0);
    expect(await eventTypes()).toEqual([]);
  });

  it("ข้อความธรรมดาภาษาไทย 600 ตัวอักษรผ่าน Instagram Login → ตัดให้ไม่เกิน 1000 ไบต์ ส่วน Facebook ไม่ตัด", async () => {
    await seedInstagramAccount(db);
    const long = "ก".repeat(600);
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep(long) });

    await deliver(igDm({ text: "ราคา" }), "instagram_login");
    const ig = sends().find((c) => c.api === "instagram")!;
    const igText = (ig.body!.message as { text: string }).text;
    expect(Buffer.byteLength(igText, "utf8")).toBeLessThanOrEqual(1000);
    expect(igText.endsWith("…")).toBe(true);
    expect(igText.startsWith("กกกก")).toBe(true);
    expect(igText.length).toBeGreaterThan(300);

    await deliver(fbDm({ text: "ราคา" }));
    const fb = sends().find((c) => c.api === "facebook")!;
    expect(fb.path).toBe("/PAGE1/messages");
    expect((fb.body!.message as { text: string }).text).toBe(long);
  });
});
