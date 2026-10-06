import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contacts, events, jobs, links, messages } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import { drainQueue } from "@/lib/queue/worker";
import { GET as clickLink } from "@/app/r/[code]/route";
import { GET as verifyWebhook, POST as receiveWebhook } from "@/app/api/webhooks/meta/route";
import { createRule, resetDatabase, startMockGraph } from "./helpers";
import { fbComment, fbDm, fbRead, igComment, igDm, igRead } from "./fixtures";

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
  graph.reset();
});

async function deliver(payload: unknown) {
  await ingestWebhook(db, payload);
  await drainQueue(db);
}

async function eventTypes() {
  const rows = await db.select({ type: events.type }).from(events).orderBy(events.id);
  return rows.map((r) => r.type);
}

describe("คอมเมนต์ → ตอบคอมเมนต์ + ส่ง DM", () => {
  it("Facebook: ตอบคอมเมนต์สาธารณะและส่ง Private Reply พร้อมลิงก์ติดตาม", async () => {
    const rule = await createRule();
    await deliver(fbComment({ text: "สนใจค่ะ ขอราคา" }));

    const dm = graph.calls.find((c) => c.path === "/PAGE1/messages")!;
    expect(dm.body).toMatchObject({ recipient: { comment_id: "POST1_C1" }, messaging_type: "RESPONSE" });
    const text = (dm.body!.message as { text: string }).text;
    expect(text).toMatch(/^สวัสดีค่ะ Somchai รายละเอียดอยู่ที่ https:\/\/dm\.example\.com\/r\/[A-Za-z0-9]{8}$/);
    expect(dm.query.appsecret_proof).toBeTruthy();

    const reply = graph.calls.find((c) => c.path === "/POST1_C1/comments")!;
    expect(reply.body).toEqual({ message: "ส่งรายละเอียดให้ทาง DM แล้วนะคะ Somchai" });

    expect(await eventTypes()).toEqual(["comment_received", "rule_triggered", "public_reply_sent", "dm_sent"]);

    const [contact] = await db.select().from(contacts);
    expect(contact).toMatchObject({ platform: "facebook", platformUserId: "PSID_FROM_POST1_C1", name: "Somchai" });
    const [msg] = await db.select().from(messages);
    expect(msg).toMatchObject({ status: "sent", ruleId: rule.id, contactId: contact.id, mid: expect.stringMatching(/^m_/), source: "comment" });
    const [link] = await db.select().from(links);
    expect(link).toMatchObject({ ruleId: rule.id, contactId: contact.id, targetUrl: "https://shop.example.com/product" });
  });

  it("Instagram: ใช้ /replies สำหรับตอบคอมเมนต์ และใช้ username แทนชื่อ", async () => {
    await createRule({ linkUrl: null, dmText: "หวัดดี @{name}" });
    await deliver(igComment({ text: "สนใจ" }));

    expect(graph.calls.find((c) => c.path === "/IGC1/replies")).toBeTruthy();
    const dm = graph.calls.find((c) => c.path === "/PAGE1/messages")!;
    expect(dm.body).toMatchObject({ recipient: { comment_id: "IGC1" }, message: { text: "หวัดดี @mint.shop" } });
  });

  it("ไม่ทำอะไรถ้าไม่ตรง keyword หรือไม่ใช่โพสต์ที่เลือกไว้", async () => {
    await createRule({ postIds: ["OTHERPOST"] });
    await deliver(fbComment({ text: "สนใจ" }));
    await deliver(fbComment({ text: "สวยมาก", commentId: "C2" }));
    expect(graph.calls).toHaveLength(0);
    expect(await eventTypes()).toEqual(["comment_received", "comment_received"]);
  });

  it("webhook ซ้ำ (Meta ส่งมาสองรอบ) ประมวลผลครั้งเดียว", async () => {
    await createRule();
    await deliver(fbComment());
    await deliver(fbComment());
    expect(graph.calls.filter((c) => c.path === "/PAGE1/messages")).toHaveLength(1);
  });

  it("คนเดิมคอมเมนต์ซ้ำในโพสต์เดิม → ส่งแค่ครั้งแรก (oncePerUser)", async () => {
    await createRule();
    await deliver(fbComment({ commentId: "C1" }));
    await deliver(fbComment({ commentId: "C2" }));
    expect(graph.calls.filter((c) => c.path === "/PAGE1/messages")).toHaveLength(1);
    expect((await eventTypes()).at(-1)).toBe("skipped");
  });

  it("ถ้าปิด oncePerUser จะส่งทุกครั้ง", async () => {
    await createRule({ oncePerUser: false, publicReplies: [] });
    await deliver(fbComment({ commentId: "C1" }));
    await deliver(fbComment({ commentId: "C2" }));
    expect(graph.calls.filter((c) => c.path === "/PAGE1/messages")).toHaveLength(2);
  });
});

describe("DM keyword → ตอบกลับอัตโนมัติ", () => {
  it("ตอบตาม keyword และดึงชื่อโปรไฟล์มาใช้", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], dmText: "สวัสดี {name} ราคา 990 บาท", linkUrl: null });
    await deliver(fbDm({ text: "ขอราคาหน่อย" }));

    const dm = graph.calls.find((c) => c.path === "/PAGE1/messages")!;
    expect(dm.body).toMatchObject({ recipient: { id: "PSID1" }, message: { text: "สวัสดี Mint ราคา 990 บาท" } });
    const [contact] = await db.select().from(contacts);
    expect(contact.name).toBe("Mint Chan");
    expect(contact.lastInboundAt).not.toBeNull();
    expect(await eventTypes()).toEqual(["dm_received", "rule_triggered", "dm_sent"]);
  });

  it("ข้อความที่ไม่ตรง keyword ถูกบันทึกแต่ไม่ตอบ", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"] });
    await deliver(igDm({ text: "สวัสดี" }));
    expect(graph.calls.filter((c) => c.method === "POST")).toHaveLength(0);
    expect(await eventTypes()).toEqual(["dm_received"]);
  });
});

describe("สถิติ: อ่านแล้ว / คลิกลิงก์", () => {
  it("read receipt ของ Facebook (watermark) และ Instagram (mid)", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], linkUrl: null });
    await deliver(fbDm({ text: "ราคา" }));
    await deliver(fbRead(Date.now() + 1000));
    await deliver(igDm({ text: "ราคา" }));
    const igMsg = (await db.select().from(messages).where(eq(messages.platform, "instagram")))[0];
    await deliver(igRead(igMsg.mid!));

    const rows = await db.select().from(messages);
    expect(rows).toHaveLength(2);
    expect(rows.every((m) => m.readAt !== null)).toBe(true);
  });

  it("กดลิงก์ → นับคลิกแล้ว redirect แต่ไม่นับ bot ที่ทำ link preview", async () => {
    await createRule();
    await deliver(fbComment());
    const [link] = await db.select().from(links);
    const url = `https://dm.example.com/r/${link.code}`;
    const ctx = { params: Promise.resolve({ code: link.code }) };

    const bot = await clickLink(new NextRequest(url, { headers: { "user-agent": "facebookexternalhit/1.1" } }), ctx);
    expect(bot.status).toBe(302);
    const human = await clickLink(new NextRequest(url, { headers: { "user-agent": "Mozilla/5.0 Instagram 300.0" } }), ctx);
    expect(human.headers.get("location")).toBe("https://shop.example.com/product");

    const [after] = await db.select().from(links);
    expect(after.clicks).toBe(1);
    expect(after.firstClickedAt).not.toBeNull();
    expect((await eventTypes()).at(-1)).toBe("link_clicked");
  });
});

describe("ข้อผิดพลาดและลิมิต", () => {
  it("error ถาวร → บันทึกว่าส่งไม่สำเร็จ ไม่ลองใหม่", async () => {
    await createRule({ dmText: "FAIL_PERMANENT", publicReplies: [] });
    await deliver(fbComment());
    const [msg] = await db.select().from(messages);
    expect(msg.status).toBe("failed");
    expect(msg.error).toContain("isn't available");
    expect((await eventTypes()).at(-1)).toBe("dm_failed");
    const pending = await db.select().from(jobs).where(eq(jobs.status, "pending"));
    expect(pending).toHaveLength(0);
  });

  it("error ชั่วคราว → เก็บไว้ลองใหม่ภายหลัง", async () => {
    await createRule({ dmText: "FAIL_TRANSIENT", publicReplies: [] });
    await deliver(fbComment());
    const [job] = await db.select().from(jobs).where(eq(jobs.type, "send_dm"));
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(1);
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now());
    expect(await db.select().from(messages)).toHaveLength(0);
  });

  it("Instagram ครบลิมิตต่อชั่วโมง → เลื่อนเวลาส่ง ไม่ทิ้งข้อความ", async () => {
    process.env.INSTAGRAM_DM_PER_HOUR = "1";
    await createRule({ oncePerUser: false, publicReplies: [] });
    await deliver(igComment({ commentId: "A" }));
    await deliver(igComment({ commentId: "B" }));
    expect(graph.calls.filter((c) => c.path === "/PAGE1/messages")).toHaveLength(1);
    const [job] = await db.select().from(jobs).where(eq(jobs.status, "pending"));
    expect(job.type).toBe("send_dm");
    expect(job.attempts).toBe(0);
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now() + 59 * 60_000);
  });
});

describe("Webhook endpoint", () => {
  it("ยืนยัน URL กับ Meta ด้วย verify token", async () => {
    const ok = await verifyWebhook(
      new NextRequest("https://x/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=abc"),
    );
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("abc");
    const bad = await verifyWebhook(
      new NextRequest("https://x/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc"),
    );
    expect(bad.status).toBe(403);
  });

  it("รับเฉพาะ webhook ที่ลายเซ็นถูกต้อง", async () => {
    const body = JSON.stringify(fbComment());
    const sig = "sha256=" + createHmac("sha256", "test-app-secret").update(body).digest("hex");
    const post = (signature: string) =>
      receiveWebhook(
        new NextRequest("https://x/api/webhooks/meta", { method: "POST", body, headers: { "x-hub-signature-256": signature } }),
      );

    expect((await post("sha256=deadbeef")).status).toBe(401);
    expect(await db.select().from(jobs)).toHaveLength(0);

    expect((await post(sig)).status).toBe(200);
    const queued = await db.select().from(jobs);
    expect(queued.map((j) => j.type)).toEqual(["comment"]);
  });
});
