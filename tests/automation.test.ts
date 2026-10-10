import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contacts, events, jobs, links, messages, rules } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import { flowPayload } from "@/lib/flows/types";
import { drainQueue } from "@/lib/queue/worker";
import { GET as clickLink } from "@/app/r/[code]/route";
import { GET as verifyWebhook, POST as receiveWebhook } from "@/app/api/webhooks/meta/route";
import { createRule, resetDatabase, singleStep, startMockGraph, TWO_STEP_FLOW, type GraphCall } from "./helpers";
import { fbComment, fbDm, fbRead, igComment, igDm, igRead, postback } from "./fixtures";

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

function sentMessages(): GraphCall[] {
  return graph.calls.filter((c) => c.path === "/PAGE1/messages");
}

type ButtonTemplate = { template_type: string; text: string; buttons: { type: string; title: string; payload?: string; url?: string }[] };
function templateOf(call: GraphCall): ButtonTemplate {
  return (call.body!.message as { attachment: { payload: ButtonTemplate } }).attachment.payload;
}

describe("คอมเมนต์ → ตอบคอมเมนต์ + ส่ง DM ที่มีปุ่ม", () => {
  it("Facebook: ตอบคอมเมนต์ และส่ง Private Reply พร้อมปุ่ม 'ส่งข้อความถัดไป'", async () => {
    const rule = await createRule();
    await deliver(fbComment({ text: "สนใจค่ะ ขอราคา" }));

    const [dm] = sentMessages();
    expect(dm.body).toMatchObject({ recipient: { comment_id: "POST1_C1" }, messaging_type: "RESPONSE" });
    expect(templateOf(dm)).toEqual({
      template_type: "button",
      text: "สวัสดีค่ะ Somchai สนใจรับรายละเอียดไหมคะ",
      buttons: [{ type: "postback", title: "ใช่ ฉันสนใจ", payload: flowPayload(rule.id, "s1", "b1") }],
    });
    expect(dm.query.appsecret_proof).toBeTruthy();

    const reply = graph.calls.find((c) => c.path === "/POST1_C1/comments")!;
    expect(reply.body).toEqual({ message: "ส่งรายละเอียดให้ทาง DM แล้วนะคะ Somchai" });

    expect(await eventTypes()).toEqual(["comment_received", "rule_triggered", "public_reply_sent", "dm_sent"]);
    const [contact] = await db.select().from(contacts);
    expect(contact).toMatchObject({ platform: "facebook", platformUserId: "PSID_FROM_POST1_C1", name: "Somchai" });
    const [msg] = await db.select().from(messages);
    expect(msg).toMatchObject({ status: "sent", ruleId: rule.id, stepId: "s1", contactId: contact.id, source: "comment" });
    // ข้อความแรกไม่มีปุ่มลิงก์ จึงยังไม่มีลิงก์ติดตาม
    expect(await db.select().from(links)).toHaveLength(0);
  });

  it("ลูกค้ากดปุ่ม → ส่งข้อความถัดไปพร้อมปุ่มลิงก์ที่นับคลิกได้", async () => {
    const rule = await createRule();
    await deliver(fbComment());
    graph.reset();

    await deliver(postback("facebook", flowPayload(rule.id, "s1", "b1"), { senderId: "PSID_FROM_POST1_C1" }));

    const [dm] = sentMessages();
    expect(dm.body).toMatchObject({ recipient: { id: "PSID_FROM_POST1_C1" } });
    const tpl = templateOf(dm);
    expect(tpl.text).toBe("ขอบคุณค่ะ Somchai รายละเอียดอยู่ด้านล่าง");
    expect(tpl.buttons).toHaveLength(1);
    expect(tpl.buttons[0]).toMatchObject({ type: "web_url", title: "ดูรายละเอียด" });
    expect(tpl.buttons[0].url).toMatch(/^https:\/\/dm\.example\.com\/r\/[A-Za-z0-9]{8}$/);

    const [contact] = await db.select().from(contacts);
    const [link] = await db.select().from(links);
    expect(link).toMatchObject({
      ruleId: rule.id,
      stepId: "s2",
      buttonId: "b2",
      contactId: contact.id,
      targetUrl: "https://shop.example.com/product",
    });
    const tap = (await db.select().from(events).where(eq(events.type, "button_clicked")))[0];
    expect(tap).toMatchObject({ ruleId: rule.id, contactId: contact.id });
    expect(tap.meta).toMatchObject({ stepId: "s1", buttonId: "b1" });
    const second = (await db.select().from(messages).where(eq(messages.stepId, "s2")))[0];
    expect(second).toMatchObject({ source: "button", status: "sent" });
  });

  it("การกดปุ่มไม่ถูกนำไปจับ keyword ของกฎ DM (ไม่ส่งข้อความซ้อน)", async () => {
    const commentRule = await createRule();
    await createRule({ name: "DM", trigger: "dm", keywords: ["สนใจ"], steps: singleStep("ตอบจากกฎ DM") });
    await deliver(fbComment());
    graph.reset();
    await deliver(postback("facebook", flowPayload(commentRule.id, "s1", "b1"), { senderId: "PSID_FROM_POST1_C1", title: "ใช่ ฉันสนใจ" }));
    expect(sentMessages()).toHaveLength(1);
    expect(templateOf(sentMessages()[0]).text).toContain("รายละเอียดอยู่ด้านล่าง");
    expect(await eventTypes()).not.toContain("dm_received");
  });

  it("ปุ่มจากข้อความเก่าที่ถูกลบไปแล้ว → บันทึกการกดแต่ไม่ส่งอะไร", async () => {
    const rule = await createRule();
    await db.update(rules).set({ steps: singleStep("ข้อความใหม่") }).where(eq(rules.id, rule.id));
    await deliver(postback("facebook", flowPayload(rule.id, "s1", "b1")));
    expect(sentMessages()).toHaveLength(0);
    expect(await eventTypes()).toEqual(["button_clicked"]);
  });

  it("กฎที่ปิดอยู่ไม่ส่งข้อความถัดไป", async () => {
    const rule = await createRule({ active: false });
    await deliver(postback("instagram", flowPayload(rule.id, "s1", "b1")));
    expect(sentMessages()).toHaveLength(0);
    expect(await eventTypes()).toEqual(["button_clicked", "skipped"]);
  });

  it("ข้อความที่ไม่มีปุ่มส่งเป็นข้อความธรรมดา", async () => {
    await createRule({ steps: singleStep("หวัดดี @{name}"), publicReplies: [] });
    await deliver(igComment({ text: "สนใจ" }));
    expect(sentMessages()[0].body).toMatchObject({ recipient: { comment_id: "IGC1" }, message: { text: "หวัดดี @mint.shop" } });
  });

  it("Instagram: ใช้ /replies สำหรับตอบคอมเมนต์", async () => {
    await createRule();
    await deliver(igComment({ text: "สนใจ" }));
    expect(graph.calls.find((c) => c.path === "/IGC1/replies")).toBeTruthy();
    expect(templateOf(sentMessages()[0]).text).toBe("สวัสดีค่ะ mint.shop สนใจรับรายละเอียดไหมคะ");
  });

  it("ไม่ทำอะไรถ้าไม่ตรง keyword หรือไม่ใช่โพสต์ที่เลือกไว้", async () => {
    await createRule({ postScope: "specific", postIds: ["OTHERPOST"] });
    await deliver(fbComment({ text: "สนใจ" }));
    await deliver(fbComment({ text: "สวยมาก", commentId: "C2" }));
    expect(graph.calls).toHaveLength(0);
    expect(await eventTypes()).toEqual(["comment_received", "comment_received"]);
  });

  it("webhook ซ้ำ (Meta ส่งมาสองรอบ) ประมวลผลครั้งเดียว", async () => {
    await createRule();
    await deliver(fbComment());
    await deliver(fbComment());
    expect(sentMessages()).toHaveLength(1);
  });

  it("คนเดิมคอมเมนต์ซ้ำในโพสต์เดิม → ส่งแค่ครั้งแรก (oncePerUser)", async () => {
    await createRule();
    await deliver(fbComment({ commentId: "C1" }));
    await deliver(fbComment({ commentId: "C2" }));
    expect(sentMessages()).toHaveLength(1);
    expect((await eventTypes()).at(-1)).toBe("skipped");
  });

  it("ถ้าปิด oncePerUser จะส่งทุกครั้ง", async () => {
    await createRule({ oncePerUser: false, publicReplies: [] });
    await deliver(fbComment({ commentId: "C1" }));
    await deliver(fbComment({ commentId: "C2" }));
    expect(sentMessages()).toHaveLength(2);
  });
});

describe("DM keyword → ตอบกลับอัตโนมัติ", () => {
  it("ตอบตาม keyword และดึงชื่อโปรไฟล์มาใช้", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("สวัสดี {name} ราคา 990 บาท") });
    await deliver(fbDm({ text: "ขอราคาหน่อย" }));

    const [dm] = sentMessages();
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
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
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
    await createRule({ steps: singleStep("ดูได้ที่ปุ่มด้านล่าง", [{ id: "b9", title: "ดูสินค้า", type: "link", url: "https://shop.example.com/product" }]) });
    await deliver(fbComment());
    const [link] = await db.select().from(links);
    expect(link).toMatchObject({ stepId: "s1", buttonId: "b9" });
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
  it("error ถาวร → บันทึกว่าส่งไม่สำเร็จ ไม่ลองใหม่ และลบลิงก์ที่สร้างไว้", async () => {
    await createRule({
      steps: singleStep("FAIL_PERMANENT", [{ id: "b1", title: "ลิงก์", type: "link", url: "https://shop.example.com" }]),
      publicReplies: [],
    });
    await deliver(fbComment());
    const [msg] = await db.select().from(messages);
    expect(msg.status).toBe("failed");
    expect(msg.error).toContain("isn't available");
    expect((await eventTypes()).at(-1)).toBe("dm_failed");
    expect(await db.select().from(jobs).where(eq(jobs.status, "pending"))).toHaveLength(0);
    expect(await db.select().from(links)).toHaveLength(0);
  });

  it("error ชั่วคราว → เก็บไว้ลองใหม่ภายหลัง โดยใช้ลิงก์เดิม", async () => {
    await createRule({
      steps: singleStep("FAIL_TRANSIENT", [{ id: "b1", title: "ลิงก์", type: "link", url: "https://shop.example.com" }]),
      publicReplies: [],
    });
    await deliver(fbComment());
    const [job] = await db.select().from(jobs).where(eq(jobs.type, "send_dm"));
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(1);
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now());
    expect(await db.select().from(messages)).toHaveLength(0);
    const [link] = await db.select().from(links);
    expect((job.payload as { linkCodes: Record<string, string> }).linkCodes).toEqual({ b1: link.code });
  });

  it("ข้อความถูกลบออกจากกฎระหว่างรอส่ง → บันทึกว่าส่งไม่สำเร็จ", async () => {
    const rule = await createRule({ publicReplies: [] });
    await ingestWebhook(db, fbComment());
    // ประมวลผลคอมเมนต์ (สร้างงานส่ง DM) แต่แก้กฎก่อนที่งานส่งจะถูกทำ
    const { claimJobs } = await import("@/lib/queue/queue");
    const { processJob } = await import("@/lib/queue/worker");
    const [commentJob] = await claimJobs(db, 1);
    await processJob(db, commentJob);
    await db.update(rules).set({ steps: [{ ...TWO_STEP_FLOW[1], id: "other" }] }).where(eq(rules.id, rule.id));
    await drainQueue(db);
    expect(sentMessages()).toHaveLength(0);
    expect((await eventTypes()).at(-1)).toBe("dm_failed");
  });

  it("งานส่ง DM ที่เข้าคิวไว้ก่อนอัปเดต (ไม่มี stepId) → ส่งข้อความแรก และลบลิงก์แบบเก่าทิ้ง", async () => {
    const rule = await createRule({ publicReplies: [] });
    await db.insert(links).values({ code: "legacy01", targetUrl: "https://old.example.com", ruleId: rule.id });
    const { enqueue } = await import("@/lib/queue/queue");
    await enqueue(db, "send_dm", {
      type: "send_dm",
      platform: "facebook",
      pageId: "PAGE1",
      ruleId: rule.id,
      source: "comment",
      recipient: { comment_id: "C9" },
      actorId: "U9",
      actorName: "Nok",
      postId: null,
      linkCode: "legacy01",
    });
    await drainQueue(db);
    expect(templateOf(sentMessages()[0]).text).toBe("สวัสดีค่ะ Nok สนใจรับรายละเอียดไหมคะ");
    expect(await db.select().from(links).where(eq(links.code, "legacy01"))).toHaveLength(0);
  });

  it("ชื่อลูกค้ายาวจนข้อความเกิน 640 ตัวอักษร → ตัดให้พอดีก่อนส่ง (ไม่โดน Meta ปฏิเสธ)", async () => {
    await createRule({
      publicReplies: [],
      steps: singleStep("ก".repeat(635) + " {name}", [{ id: "b1", title: "ดู", type: "link", url: "https://shop.example.com" }]),
    });
    await deliver(igComment({ text: "สนใจ" }));
    const text = templateOf(sentMessages()[0]).text;
    expect(text.length).toBeLessThanOrEqual(640);
    expect(text.endsWith("…")).toBe(true);
  });

  it("Instagram ครบลิมิตต่อชั่วโมง → เลื่อนเวลาส่ง ไม่ทิ้งข้อความ", async () => {
    process.env.INSTAGRAM_DM_PER_HOUR = "1";
    await createRule({ oncePerUser: false, publicReplies: [] });
    await deliver(igComment({ commentId: "A" }));
    await deliver(igComment({ commentId: "B" }));
    expect(sentMessages()).toHaveLength(1);
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

describe("กฎแบบ 'โพสต์/รีลถัดไป' (ภาพรวม — รายละเอียดอยู่ใน next-post.test.ts)", () => {
  beforeEach(async () => {
    graph.resetAll();
    const { clearNextPostCache } = await import("@/lib/rules/next-post");
    clearNextPostCache();
  });
  afterAll(() => graph.resetAll());

  it("ลงเนื้อหาเดียวกันทั้ง Facebook และ Instagram → กฎผูกโพสต์แรกของแต่ละที่ และตอบเฉพาะโพสต์นั้น", async () => {
    const since = new Date(Date.now() - 10 * 60_000);
    const after = (min: number) => new Date(since.getTime() + min * 60_000).toISOString();
    graph.setPosts([
      { id: "PAGE1_OLD", platform: "facebook", createdAt: new Date(since.getTime() - 60_000).toISOString() },
      { id: "PAGE1_NEW", platform: "facebook", createdAt: after(1) },
      { id: "IGNEW", platform: "instagram", createdAt: after(2) },
    ]);
    const rule = await createRule({ postScope: "next", nextPostSince: since, publicReplies: [] });

    await deliver(fbComment({ postId: "PAGE1_OLD", commentId: "C0" }));
    await deliver(fbComment({ postId: "PAGE1_NEW", commentId: "C1" }));
    await deliver(igComment({ mediaId: "IGNEW", commentId: "IGC1" }));

    expect(sentMessages().map((c) => c.body!.recipient)).toEqual([{ comment_id: "C1" }, { comment_id: "IGC1" }]);
    const row = (await db.select().from(rules).where(eq(rules.id, rule.id)))[0];
    expect(row.boundPosts.facebook?.id).toBe("PAGE1_NEW");
    expect(row.boundPosts.instagram?.id).toBe("IGNEW");
    expect((await eventTypes()).filter((t) => t === "post_bound")).toHaveLength(2);
  });
});
