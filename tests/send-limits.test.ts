import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { events, jobs, links, messages, type MessageSource, type Platform, type WebhookVia } from "@/db/schema";
import { isRateLimitError, RATE_LIMIT_MAX_WAITS, rateLimitDelayMs, type SendDmJob } from "@/lib/automation/handlers";
import { ingestWebhook } from "@/lib/automation/ingest";
import { env } from "@/lib/env";
import { GraphApiError } from "@/lib/meta/graph";
import { claimJobs } from "@/lib/queue/queue";
import { drainQueue, processJob } from "@/lib/queue/worker";
import { createRule, resetDatabase, seedInstagramAccount, singleStep, startMockGraph } from "./helpers";
import { fbComment, igComment, igDm } from "./fixtures";

/*
 * จังหวะการส่งตามลิมิตที่ Meta ประกาศ:
 * - Private Reply (DM แรกที่ตอบคอมเมนต์) มีโควตาแยก: Instagram 720/ชม. (Meta ให้ 750), Facebook ไม่จำกัด
 * - DM ทั่วไปไม่จำกัดรายชั่วโมง เว้นแต่ตั้ง *_DM_PER_HOUR เอง
 * - Meta ตอบว่า "ถี่เกิน" → เลื่อนงานแบบรอนานขึ้นเรื่อยๆ (1 → 15 นาที) ไม่ทิ้งข้อความ แต่ไม่ลองไปตลอดกาล
 */

const LIMIT_ENV = [
  "INSTAGRAM_PRIVATE_REPLY_PER_HOUR",
  "FACEBOOK_PRIVATE_REPLY_PER_HOUR",
  "INSTAGRAM_DM_PER_HOUR",
  "FACEBOOK_DM_PER_HOUR",
] as const;
const MINUTE = 60_000;
const LINK_STEP = singleStep("สวัสดีค่ะ {name}", [{ id: "b1", title: "ดูสินค้า", type: "link", url: "https://shop.example.com" }]);

let graph: Awaited<ReturnType<typeof startMockGraph>>;
let db: Db;

/** ให้ POST .../messages ตอบ error "ถี่เกิน" ตามรหัสนี้ (null = ส่งไปที่ Graph API ปลอมตามปกติ) */
let throttle: { code?: number; subcode?: number } | null = null;
/** จำนวนครั้งที่ยิง POST .../messages แล้วโดนตอบว่าถี่เกิน */
let throttledCalls = 0;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  graph = await startMockGraph();
});
afterAll(async () => {
  await graph.close();
});
beforeEach(async () => {
  for (const name of LIMIT_ENV) delete process.env[name];
  db = await resetDatabase();
  graph.resetAll();
  throttle = null;
  throttledCalls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (throttle && init?.method === "POST" && url.pathname.endsWith("/messages")) {
      throttledCalls++;
      return new Response(
        JSON.stringify({
          error: {
            message: "(#613) Calls to this api have exceeded the rate limit.",
            type: "OAuthException",
            code: throttle.code,
            error_subcode: throttle.subcode,
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return realFetch(input, init);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function deliver(payload: unknown, via?: WebhookVia) {
  await ingestWebhook(db, payload, { via });
  await drainQueue(db);
}

/** request ส่ง DM ที่ไปถึง Graph API ปลอม (ไม่รวมครั้งที่โดนตอบว่าถี่เกิน) */
function sentDms() {
  return graph.calls.filter((c) => c.method === "POST" && c.path.endsWith("/messages"));
}

/** ใส่ประวัติการส่งย้อนหลัง (เหมือนระบบเพิ่งส่งไปเมื่อ minutesAgo นาทีก่อน) */
async function seedHistory(o: {
  platform: Platform;
  pageId: string;
  source: MessageSource;
  count: number;
  minutesAgo: number;
  status?: "sent" | "failed";
}) {
  const sentAt = new Date(Date.now() - o.minutesAgo * MINUTE);
  await db.insert(messages).values(
    Array.from({ length: o.count }, () => ({
      platform: o.platform,
      pageId: o.pageId,
      source: o.source,
      status: o.status ?? ("sent" as const),
      sentAt,
    })),
  );
}

async function sendJobs() {
  return db.select().from(jobs).where(eq(jobs.type, "send_dm")).orderBy(jobs.id);
}

async function pendingSendJobs() {
  return db
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, "send_dm"), eq(jobs.status, "pending")))
    .orderBy(jobs.id);
}

/** ให้งานที่รอคิวอยู่ถึงเวลาทำทันที (แทนการรอจริง) */
async function makePendingDue() {
  await db.update(jobs).set({ runAt: new Date(Date.now() - 1000) }).where(eq(jobs.status, "pending"));
}

async function eventsOf(type: string) {
  return db.select().from(events).where(eq(events.type, type)).orderBy(events.id);
}

function payloadOf(job: { payload: Record<string, unknown> }): SendDmJob {
  return job.payload as unknown as SendDmJob;
}

function expectRunAtAbout(runAt: Date, ms: number) {
  expect(runAt.getTime()).toBeGreaterThan(Date.now() + ms - 10_000);
  expect(runAt.getTime()).toBeLessThan(Date.now() + ms + 10_000);
}

describe("ค่าเริ่มต้นตามลิมิตที่ Meta ประกาศ", () => {
  it("Private Reply ของ Instagram 720/ชม., Facebook ไม่จำกัด, DM ทั่วไปไม่จำกัด — ตั้งค่าเองใน env ได้", () => {
    expect(env.instagramPrivateReplyPerHour).toBe(720);
    expect(env.facebookPrivateReplyPerHour).toBe(0);
    expect(env.instagramDmPerHour).toBe(0);
    expect(env.facebookDmPerHour).toBe(0);

    process.env.INSTAGRAM_PRIVATE_REPLY_PER_HOUR = "500";
    process.env.FACEBOOK_PRIVATE_REPLY_PER_HOUR = "300";
    process.env.INSTAGRAM_DM_PER_HOUR = "180";
    process.env.FACEBOOK_DM_PER_HOUR = "90";
    expect(env.instagramPrivateReplyPerHour).toBe(500);
    expect(env.facebookPrivateReplyPerHour).toBe(300);
    expect(env.instagramDmPerHour).toBe(180);
    expect(env.facebookDmPerHour).toBe(90);
  });
});

describe("โควตา Private Reply แยกจาก DM ทั่วไป", () => {
  it("Instagram: ตอบคอมเมนต์ทาง DM ครบ 720 ครั้งใน 1 ชม. (นับครั้งที่ส่งไม่สำเร็จด้วย) → คอมเมนต์ถัดไปรอคิว ไม่ทิ้ง", async () => {
    await createRule({ publicReplies: [], steps: LINK_STEP });
    await seedHistory({ platform: "instagram", pageId: "PAGE1", source: "comment", count: 700, minutesAgo: 30 });
    await seedHistory({ platform: "instagram", pageId: "PAGE1", source: "comment", count: 20, minutesAgo: 20, status: "failed" });

    await deliver(igComment());
    expect(sentDms()).toHaveLength(0);
    const [job] = await pendingSendJobs();
    expect(job.attempts).toBe(0);
    // ส่งได้อีกเมื่อข้อความลำดับที่ 720 นับจากล่าสุด (ส่งไปเมื่อ 30 นาทีก่อน) พ้นช่วง 1 ชม.
    expectRunAtAbout(job.runAt, 30 * MINUTE);
    expect(job.lastError).toContain("ตอบคอมเมนต์ทาง DM ครบ 720 ครั้งใน 1 ชั่วโมงแล้ว");
    expect(job.lastError).toContain("ข้อความไม่หาย");
    expect(await eventsOf("dm_failed")).toHaveLength(0);
  });

  it("Instagram: Private Reply ครบโควตาแล้ว DM ทั่วไป (ทักแชทตาม keyword) ยังส่งได้ทันที", async () => {
    await createRule({ publicReplies: [] });
    await createRule({ name: "ทักแชท", trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990 บาทค่ะ") });
    await seedHistory({ platform: "instagram", pageId: "PAGE1", source: "comment", count: 720, minutesAgo: 10 });

    await deliver(igComment());
    await deliver(igDm({ text: "ราคา" }));

    expect(sentDms()).toHaveLength(1);
    expect(sentDms()[0].body).toMatchObject({ recipient: { id: "IGSID1" }, message: { text: "ราคา 990 บาทค่ะ" } });
    const pending = await pendingSendJobs();
    expect(pending).toHaveLength(1);
    expect(payloadOf(pending[0]).recipient).toEqual({ comment_id: "IGC1" });
  });

  it("DM ทั่วไปและข้อความจากการกดปุ่มไม่ถูกนับในโควตา Private Reply", async () => {
    process.env.INSTAGRAM_PRIVATE_REPLY_PER_HOUR = "2";
    await createRule({ publicReplies: [], oncePerUser: false });
    await seedHistory({ platform: "instagram", pageId: "PAGE1", source: "dm", count: 300, minutesAgo: 5 });
    await seedHistory({ platform: "instagram", pageId: "PAGE1", source: "button", count: 300, minutesAgo: 5 });

    await deliver(igComment({ commentId: "A", fromId: "U1" }));
    await deliver(igComment({ commentId: "B", fromId: "U2" }));
    await deliver(igComment({ commentId: "C", fromId: "U3" }));

    expect(sentDms().map((c) => c.body?.recipient)).toEqual([{ comment_id: "A" }, { comment_id: "B" }]);
    const pending = await pendingSendJobs();
    expect(pending.map((j) => payloadOf(j).recipient)).toEqual([{ comment_id: "C" }]);
    expect(pending[0].lastError).toContain("ตอบคอมเมนต์ทาง DM ครบ 2 ครั้ง");
  });

  it("ค่าเริ่มต้น: DM ทั่วไปของ Instagram ไม่จำกัดรายชั่วโมง (เลิกใช้ 180/ชม. แบบเดิม)", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990 บาทค่ะ") });
    await seedHistory({ platform: "instagram", pageId: "PAGE1", source: "dm", count: 500, minutesAgo: 10 });
    await deliver(igDm({ text: "ราคา" }));
    expect(sentDms()).toHaveLength(1);
    expect(await pendingSendJobs()).toHaveLength(0);
  });

  it("ตั้ง INSTAGRAM_DM_PER_HOUR เองไว้ → ใช้กับ DM ทุกแบบของ Instagram", async () => {
    process.env.INSTAGRAM_DM_PER_HOUR = "3";
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990 บาทค่ะ") });
    await seedHistory({ platform: "instagram", pageId: "PAGE1", source: "button", count: 3, minutesAgo: 15 });

    await deliver(igDm({ text: "ราคา" }));
    expect(sentDms()).toHaveLength(0);
    const [job] = await pendingSendJobs();
    expect(job.attempts).toBe(0);
    expectRunAtAbout(job.runAt, 45 * MINUTE);
    expect(job.lastError).toContain("ส่ง DM ครบ 3 ข้อความใน 1 ชั่วโมงแล้ว");
  });

  it("ประวัติที่เก่ากว่า 1 ชม. ไม่นับ", async () => {
    await createRule({ publicReplies: [] });
    await seedHistory({ platform: "instagram", pageId: "PAGE1", source: "comment", count: 720, minutesAgo: 61 });
    await deliver(igComment());
    expect(sentDms()).toHaveLength(1);
  });

  it("Facebook: Private Reply ไม่จำกัดโดยค่าเริ่มต้น แต่ตั้ง FACEBOOK_PRIVATE_REPLY_PER_HOUR ได้", async () => {
    await createRule({ publicReplies: [], oncePerUser: false });
    await seedHistory({ platform: "facebook", pageId: "PAGE1", source: "comment", count: 1000, minutesAgo: 10 });
    // โควตาของ Instagram ที่ผูกกับเพจเดียวกันไม่เกี่ยวกับ Facebook
    await seedHistory({ platform: "instagram", pageId: "PAGE1", source: "comment", count: 720, minutesAgo: 10 });

    await deliver(fbComment({ commentId: "FB_A", fromId: "U1" }));
    expect(sentDms()).toHaveLength(1);

    process.env.FACEBOOK_PRIVATE_REPLY_PER_HOUR = "1000";
    await deliver(fbComment({ commentId: "FB_B", fromId: "U2" }));
    expect(sentDms()).toHaveLength(1);
    const [job] = await pendingSendJobs();
    expect(payloadOf(job).recipient).toEqual({ comment_id: "FB_B" });
    expect(job.lastError).toContain("ตอบคอมเมนต์ทาง DM ครบ 1000 ครั้ง");
  });

  it("Instagram Login: นับโควตาของบัญชี IG (pageId = IG1) และส่งผ่าน graph.instagram.com เมื่อพ้นช่วง", async () => {
    process.env.INSTAGRAM_PRIVATE_REPLY_PER_HOUR = "1";
    await seedInstagramAccount(db);
    await createRule({ publicReplies: [] });
    await seedHistory({ platform: "instagram", pageId: "IG1", source: "comment", count: 1, minutesAgo: 40 });

    await deliver(igComment(), "instagram_login");
    expect(sentDms()).toHaveLength(0);
    const [job] = await pendingSendJobs();
    expect(payloadOf(job)).toMatchObject({ pageId: "IG1", api: "instagram" });
    expectRunAtAbout(job.runAt, 20 * MINUTE);

    // พ้นช่วง 1 ชม. แล้ว → ส่งออกทาง Instagram Login
    await db.update(messages).set({ sentAt: new Date(Date.now() - 2 * 60 * MINUTE) }).where(eq(messages.pageId, "IG1"));
    await makePendingDue();
    await drainQueue(db);
    expect(sentDms()).toHaveLength(1);
    expect(sentDms()[0]).toMatchObject({ api: "instagram", path: "/IG1/messages" });
    const sent = await db.select().from(messages).where(eq(messages.status, "sent"));
    expect(sent.at(-1)).toMatchObject({ pageId: "IG1", source: "comment" });
  });
});

describe("Meta ตอบว่าส่งถี่เกิน (rate limit)", () => {
  it("รู้จักรหัส rate limit ของ Meta: 4, 17, 32, 613, 80001, 80002, 80004, 80006 และ subcode 2534040", () => {
    for (const code of [4, 17, 32, 613, 80001, 80002, 80004, 80006]) {
      expect(isRateLimitError(new GraphApiError("rate", 400, code)), `code ${code}`).toBe(true);
    }
    expect(isRateLimitError(new GraphApiError("rate", 400, 10, 2534040))).toBe(true);
    for (const code of [1, 2, 10, 100, 190, 200, 551]) {
      expect(isRateLimitError(new GraphApiError("other", 400, code)), `code ${code}`).toBe(false);
    }
    expect(isRateLimitError(new GraphApiError("no code", 500))).toBe(false);
    expect(isRateLimitError(new Error("613"))).toBe(false);
  });

  it("รอนานขึ้นเรื่อยๆ: 1, 2, 4, 8 แล้ว 15 นาทีทุกรอบ", () => {
    expect([1, 2, 3, 4, 5, 6, 10].map((n) => rateLimitDelayMs(n) / MINUTE)).toEqual([1, 2, 4, 8, 15, 15, 15]);
  });

  it("โดนชะลอ → เลื่อนงานออกไป (ไม่นับเป็นความล้มเหลว) บันทึกกิจกรรมครั้งเดียว แล้วส่งได้เมื่อ Meta ปล่อย โดยใช้ลิงก์เดิม", async () => {
    await createRule({ publicReplies: [], steps: LINK_STEP });
    throttle = { code: 613 };

    await deliver(fbComment());
    let [job] = await sendJobs();
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(0);
    expect(payloadOf(job).rateLimitHits).toBe(1);
    expectRunAtAbout(job.runAt, 1 * MINUTE);
    expect(job.lastError).toContain("Meta ขอให้ชะลอการส่ง (รหัส 613)");
    expect(await db.select().from(messages)).toHaveLength(0);
    expect(await eventsOf("dm_failed")).toHaveLength(0);
    const [link] = await db.select().from(links);
    expect(payloadOf(job).linkCodes).toEqual({ b1: link.code });

    const notes = await eventsOf("dm_rate_limited");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ platform: "facebook", pageId: "PAGE1" });
    expect(notes[0].text).toContain("ส่งข้อความถี่เกินกำหนดชั่วคราว (รหัส 613)");
    expect(notes[0].text).toContain("ข้อความไม่หาย");
    // ไม่ใช่ความผิดพลาด → ไม่มี meta.error (หน้ากิจกรรมจะได้ไม่แสดงเป็นกล่องสีแดง)
    expect(notes[0].meta).not.toHaveProperty("error");

    // รอบที่ 2 ยังโดนอยู่ → รอนานขึ้น แต่ไม่บันทึกกิจกรรมซ้ำ
    await makePendingDue();
    await drainQueue(db);
    [job] = await sendJobs();
    expect(payloadOf(job).rateLimitHits).toBe(2);
    expect(job.attempts).toBe(0);
    expectRunAtAbout(job.runAt, 2 * MINUTE);
    expect(await eventsOf("dm_rate_limited")).toHaveLength(1);

    // Meta ปล่อยแล้ว → ส่งสำเร็จด้วยลิงก์ติดตามเดิม
    throttle = null;
    await makePendingDue();
    await drainQueue(db);
    [job] = await sendJobs();
    expect(job.status).toBe("done");
    expect(throttledCalls).toBe(2);
    expect(sentDms()).toHaveLength(1);
    const buttons = (sentDms()[0].body as { message: { attachment: { payload: { buttons: { url: string }[] } } } }).message
      .attachment.payload.buttons;
    expect(buttons[0].url).toBe(`https://dm.example.com/r/${link.code}`);
    expect(await db.select().from(links)).toHaveLength(1);
    expect(await db.select().from(messages)).toEqual([expect.objectContaining({ status: "sent", source: "comment" })]);
    expect(await eventsOf("dm_sent")).toHaveLength(1);
  });

  it("หลายงานโดนชะลอพร้อมกัน → บันทึกกิจกรรมแค่ครั้งเดียวต่อบัญชี", async () => {
    await createRule({ publicReplies: [], oncePerUser: false });
    throttle = { code: 80006 };
    await ingestWebhook(db, fbComment({ commentId: "C1", fromId: "U1" }));
    await ingestWebhook(db, fbComment({ commentId: "C2", fromId: "U2" }));
    await ingestWebhook(db, fbComment({ commentId: "C3", fromId: "U3" }));
    await drainQueue(db);

    const pending = await pendingSendJobs();
    expect(pending).toHaveLength(3);
    expect(await eventsOf("dm_rate_limited")).toHaveLength(1);
    expect(await eventsOf("dm_failed")).toHaveLength(0);
  });

  it("Instagram Login: โดนชะลอ (subcode 2534040) → งานส่ง DM อื่นที่รอคิวของบัญชีเดียวกันรอด้วย บัญชีอื่นส่งต่อได้", async () => {
    await seedInstagramAccount(db);
    await createRule({ publicReplies: [], oncePerUser: false });
    await ingestWebhook(db, igComment({ commentId: "A", fromId: "U1" }), { via: "instagram_login" });
    await ingestWebhook(db, igComment({ commentId: "B", fromId: "U2" }), { via: "instagram_login" });
    await ingestWebhook(db, fbComment({ commentId: "F", fromId: "U3" }));
    // ประมวลผลคอมเมนต์ทีละงาน → ได้งานส่ง DM 3 งานเรียงตามลำดับ (IG A, IG B, Facebook F)
    for (let i = 0; i < 3; i++) {
      const [commentJob] = await claimJobs(db, 1);
      await processJob(db, commentJob);
    }
    expect((await sendJobs()).map((j) => payloadOf(j).pageId)).toEqual(["IG1", "IG1", "PAGE1"]);

    throttle = { code: 10, subcode: 2534040 };
    const [first] = await claimJobs(db, 1);
    await processJob(db, first);
    expect(throttledCalls).toBe(1);

    const [igA, igB, fb] = await sendJobs();
    expect(igA.status).toBe("pending");
    expect(payloadOf(igA)).toMatchObject({ api: "instagram", pageId: "IG1", rateLimitHits: 1 });
    expectRunAtAbout(igA.runAt, 1 * MINUTE);
    // งานถัดไปของบัญชีเดียวกันถูกพักไว้ถึงเวลาเดียวกัน โดยไม่นับว่าโดนชะลอ/ล้มเหลว
    expect(igB.status).toBe("pending");
    expect(igB.runAt.getTime()).toBe(igA.runAt.getTime());
    expect(igB.attempts).toBe(0);
    expect(payloadOf(igB).rateLimitHits).toBeUndefined();
    expect(igB.lastError).toContain("พักทั้งบัญชี");
    // เพจ Facebook เป็นอีกบัญชี ไม่ต้องรอ
    expect(fb.runAt.getTime()).toBeLessThanOrEqual(Date.now());

    const [note] = await eventsOf("dm_rate_limited");
    expect(note).toMatchObject({ platform: "instagram", pageId: "IG1" });
    expect(note.meta).toMatchObject({ api: "instagram", rateLimit: { code: 10, subcode: 2534040 } });
    expect(note.text).toContain("รหัส 10 / 2534040");

    throttle = null;
    await drainQueue(db);
    expect(sentDms().map((c) => c.body?.recipient)).toEqual([{ comment_id: "F" }]);
    expect(await pendingSendJobs()).toHaveLength(2);
  });

  it(`โดนชะลอครบ ${RATE_LIMIT_MAX_WAITS} รอบแล้วยังไม่ผ่าน → เลิกส่ง บันทึกว่าส่งไม่สำเร็จ (ไม่ลองไปเรื่อยๆ)`, async () => {
    await createRule({ publicReplies: [], steps: LINK_STEP });
    throttle = { code: 4 };

    await deliver(fbComment());
    for (let round = 2; round <= RATE_LIMIT_MAX_WAITS; round++) {
      await makePendingDue();
      await drainQueue(db);
    }
    let [job] = await sendJobs();
    expect(job.status).toBe("pending");
    expect(payloadOf(job).rateLimitHits).toBe(RATE_LIMIT_MAX_WAITS);
    expect(job.attempts).toBe(0);
    expect(await eventsOf("dm_failed")).toHaveLength(0);

    await makePendingDue();
    await drainQueue(db);
    [job] = await sendJobs();
    expect(job.status).toBe("done");
    expect(throttledCalls).toBe(RATE_LIMIT_MAX_WAITS + 1);
    expect(await pendingSendJobs()).toHaveLength(0);

    const [failed] = await eventsOf("dm_failed");
    expect(failed.meta).toMatchObject({ api: "facebook", rateLimitHits: RATE_LIMIT_MAX_WAITS + 1, error: { code: 4 } });
    const [msg] = await db.select().from(messages);
    expect(msg).toMatchObject({ status: "failed", source: "comment" });
    // ส่งไม่สำเร็จแน่แล้ว → ลบลิงก์ติดตามทิ้งไม่ให้ถ่วงสถิติ % คลิก
    expect(await db.select().from(links)).toHaveLength(0);
    expect(await eventsOf("dm_rate_limited")).toHaveLength(1);
  });

  it("error ชั่วคราวแบบอื่น (code 2) ยังลองใหม่แบบเดิม ไม่นับว่าโดนชะลอ", async () => {
    await createRule({ publicReplies: [] });
    throttle = { code: 2 };
    await deliver(fbComment());
    const [job] = await sendJobs();
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(1);
    expect(payloadOf(job).rateLimitHits).toBeUndefined();
    expect(await eventsOf("dm_rate_limited")).toHaveLength(0);
  });
});
