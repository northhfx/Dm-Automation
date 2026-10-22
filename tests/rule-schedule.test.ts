import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { events, inboxItems, ruleFolders, rules } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import { flowPayload } from "@/lib/flows/types";
import { drainQueue } from "@/lib/queue/worker";
import { closedReplyOf, effectiveSchedule, scheduleState } from "@/lib/rules/schedule";
import { createRule, resetDatabase, singleStep, startMockGraph } from "./helpers";
import { fbComment, fbDm, postback } from "./fixtures";

/*
 * ตั้งเวลาเปิด–ปิดกฎ (ของกฎเอง + ทั้งโฟลเดอร์):
 * - ยังไม่ถึงเวลา / หมดเวลา → ไม่ตอบตามกฎ
 * - หมดเวลา + มีข้อความปิดรับ → ตอบใต้คอมเมนต์ (คนเดิมโพสต์เดิมครั้งเดียว) หรือตอบในแชท
 * - ปุ่มในข้อความที่ส่งไปแล้วยังกดต่อได้หลังหมดเวลา
 */

vi.mock("@/lib/auth", () => ({ requireAuth: async () => {} }));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));

let graph: Awaited<ReturnType<typeof startMockGraph>>;
let db: Db;

beforeAll(async () => {
  graph = await startMockGraph();
});
afterAll(async () => {
  await graph.close();
});
beforeEach(async () => {
  db = await resetDatabase();
  graph.reset();
});

const HOUR = 60 * 60_000;
const past = (h = 1) => new Date(Date.now() - h * HOUR);
const future = (h = 1) => new Date(Date.now() + h * HOUR);
const CLOSED = "ปิดรับสมัครแล้ว รอติดตามรอบถัดไปนะครับ";

async function deliver(payload: unknown) {
  await ingestWebhook(db, payload);
  await drainQueue(db);
}
const dms = () => graph.calls.filter((c) => c.path === "/PAGE1/messages");
const publicReplies = () => graph.calls.filter((c) => /\/comments$/.test(c.path));
const types = async () => (await db.select({ type: events.type }).from(events).orderBy(events.id)).map((e) => e.type);

describe("ช่วงเวลา (ตัวช่วย)", () => {
  it("ช่วงที่ใช้จริง = ซ้อนกันของกฎและโฟลเดอร์ · สถานะ", () => {
    const a = new Date("2026-10-01T00:00:00Z");
    const b = new Date("2026-10-10T00:00:00Z");
    const c = new Date("2026-10-20T00:00:00Z");
    expect(effectiveSchedule({ startsAt: a, endsAt: c }, { startsAt: b, endsAt: null })).toEqual({ startsAt: b, endsAt: c });
    expect(effectiveSchedule({ startsAt: null, endsAt: c }, { startsAt: null, endsAt: b })).toEqual({ startsAt: null, endsAt: b });
    expect(scheduleState({ startsAt: b, endsAt: c }, a)).toBe("upcoming");
    expect(scheduleState({ startsAt: b, endsAt: c }, b)).toBe("open");
    expect(scheduleState({ startsAt: b, endsAt: c }, c)).toBe("ended");
    expect(scheduleState({ startsAt: null, endsAt: null })).toBe("open");
    expect(closedReplyOf({ closedReply: "  " }, { closedReply: "โฟลเดอร์" })).toBe("โฟลเดอร์");
    expect(closedReplyOf({ closedReply: "ของกฎ" }, { closedReply: "โฟลเดอร์" })).toBe("ของกฎ");
    expect(closedReplyOf({ closedReply: null }, null)).toBeNull();
  });
});

describe("คอมเมนต์", () => {
  it("อยู่ในช่วงเวลา → ตอบปกติ", async () => {
    await createRule({ startsAt: past(), endsAt: future() });
    await deliver(fbComment({ commentId: "C1", text: "สนใจ" }));
    expect(await types()).toContain("rule_triggered");
    expect(dms()).toHaveLength(1);
  });

  it("หมดเวลา + มีข้อความปิดรับ → ตอบใต้คอมเมนต์ ไม่ส่ง DM · คนเดิมโพสต์เดิมตอบครั้งเดียว", async () => {
    const rule = await createRule({ endsAt: past(), closedReply: CLOSED });
    await deliver(fbComment({ commentId: "C1", text: "สนใจ" }));
    expect(dms()).toHaveLength(0);
    expect(publicReplies()).toHaveLength(1);
    expect(publicReplies()[0].body).toMatchObject({ message: CLOSED });
    const [skip] = await db.select().from(events).where(eq(events.type, "skipped"));
    expect(skip).toMatchObject({ ruleId: rule.id, meta: { reason: "rule_ended", replied: true } });
    // ไม่ขึ้นในข้อความรอตอบ (ตอบไปแล้ว)
    expect(await db.select().from(inboxItems)).toHaveLength(0);

    await deliver(fbComment({ commentId: "C2", text: "สนใจอีกที" }));
    expect(publicReplies()).toHaveLength(1);
    expect(await types()).not.toContain("rule_triggered");
  });

  it("หมดเวลา ไม่มีข้อความปิดรับ → ไม่ตอบ และขึ้นในข้อความรอตอบให้ตอบเอง", async () => {
    await createRule({ endsAt: past() });
    await deliver(fbComment({ commentId: "C1", text: "สนใจ" }));
    expect(graph.calls.filter((c) => c.method === "POST")).toHaveLength(0);
    expect(await db.select().from(inboxItems)).toHaveLength(1);
  });

  it("ยังไม่ถึงเวลาเริ่ม → ไม่ตอบ (ข้อความปิดรับก็ไม่ส่ง)", async () => {
    await createRule({ startsAt: future(), closedReply: CLOSED });
    await deliver(fbComment({ commentId: "C1", text: "สนใจ" }));
    expect(graph.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("กฎที่หมดเวลาอยู่บนสุด แต่มีกฎอื่นที่เปิดอยู่ตรง keyword → กฎที่เปิดอยู่ตอบ", async () => {
    await createRule({ name: "เก่า", priority: 10, endsAt: past(), closedReply: CLOSED });
    const open = await createRule({ name: "ใหม่", priority: 20 });
    await deliver(fbComment({ commentId: "C1", text: "สนใจ" }));
    const [triggered] = await db.select().from(events).where(eq(events.type, "rule_triggered"));
    expect(triggered.ruleId).toBe(open.id);
    expect(publicReplies().map((c) => c.body?.message)).not.toContain(CLOSED);
  });

  it("ตั้งเวลาทั้งโฟลเดอร์: โฟลเดอร์หมดเวลา → กฎข้างในหยุด และใช้ข้อความปิดรับของโฟลเดอร์", async () => {
    const [folder] = await db.insert(ruleFolders).values({ name: "รอบ 1", endsAt: past(), closedReply: "รอบนี้ปิดแล้ว" }).returning();
    await createRule({ folderId: folder.id, endsAt: future(48) });
    await deliver(fbComment({ commentId: "C1", text: "สนใจ" }));
    expect(dms()).toHaveLength(0);
    expect(publicReplies()[0].body).toMatchObject({ message: "รอบนี้ปิดแล้ว" });
  });
});

describe("แชท + ปุ่ม", () => {
  it("แชท keyword ของกฎที่หมดเวลา → ตอบในแชทด้วยข้อความปิดรับ", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990"), endsAt: past(), closedReply: CLOSED });
    await deliver(fbDm({ text: "ราคาเท่าไหร่", mid: "m1" }));
    expect(dms()).toHaveLength(1);
    expect(dms()[0].body).toMatchObject({ recipient: { id: "PSID1" }, message: { text: CLOSED } });
    expect(await types()).not.toContain("rule_triggered");
  });

  it("หมดเวลาแล้ว ลูกค้ายังกดปุ่มในข้อความที่ได้ไปแล้วต่อได้", async () => {
    const rule = await createRule();
    await deliver(fbComment({ commentId: "C1", text: "สนใจ" }));
    await db.update(rules).set({ endsAt: past() }).where(eq(rules.id, rule.id));
    graph.reset();
    await deliver(postback("facebook", flowPayload(rule.id, "s1", "b1"), { senderId: "PSID_FROM_C1" }));
    expect(dms()).toHaveLength(1);
  });
});

describe("บันทึกจากหน้าแก้กฎ / โฟลเดอร์", () => {
  const ruleForm = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries({
      name: "ตั้งเวลา",
      trigger: "comment",
      platforms: "facebook",
      matchType: "contains",
      keywords: "สนใจ",
      steps: JSON.stringify([{ id: "s1", text: "สวัสดี", buttons: [] }]),
      active: "on",
      ...fields,
    }))
      data.set(k, v);
    return data;
  };

  it("บันทึกเวลาและข้อความปิดรับ · เวลาปิดก่อนเวลาเริ่มไม่ผ่าน", async () => {
    const { saveRule } = await import("@/app/(dashboard)/rules/actions");
    const rule = await createRule();
    const ends = future(24).toISOString();
    const ok = await saveRule({}, ruleForm({ id: String(rule.id), startsAt: "", endsAt: ends, closedReply: `  ${CLOSED}  ` }));
    expect(ok.error).toBeUndefined();
    const row = await db.query.rules.findFirst({ where: eq(rules.id, rule.id) });
    expect(row).toMatchObject({ startsAt: null, closedReply: CLOSED });
    expect(row?.endsAt?.toISOString()).toBe(ends);

    const bad = await saveRule({}, ruleForm({ id: String(rule.id), startsAt: future(48).toISOString(), endsAt: ends }));
    expect(bad.error).toBe("เวลาปิดต้องอยู่หลังเวลาเริ่ม");
    // ล้างเวลา = ไม่จำกัด
    await saveRule({}, ruleForm({ id: String(rule.id), startsAt: "", endsAt: "", closedReply: "" }));
    expect(await db.query.rules.findFirst({ where: eq(rules.id, rule.id) })).toMatchObject({ endsAt: null, closedReply: null });
  });

  it("แก้ไขโฟลเดอร์: บันทึกชื่อ + เวลาของทั้งโฟลเดอร์", async () => {
    const { renameFolder } = await import("@/app/(dashboard)/rules/actions");
    const [folder] = await db.insert(ruleFolders).values({ name: "A" }).returning();
    const data = new FormData();
    data.set("id", String(folder.id));
    data.set("name", "รอบ 2");
    data.set("startsAt", "");
    data.set("endsAt", future(24).toISOString());
    data.set("closedReply", "ปิดแล้วจ้า");
    expect(await renameFolder({}, data)).toMatchObject({ done: 1 });
    const row = await db.query.ruleFolders.findFirst({ where: eq(ruleFolders.id, folder.id) });
    expect(row).toMatchObject({ name: "รอบ 2", closedReply: "ปิดแล้วจ้า", startsAt: null });
    expect(row?.endsAt).toBeInstanceOf(Date);
  });
});
