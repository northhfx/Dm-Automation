import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { links } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import { flowPayload } from "@/lib/flows/types";
import { drainQueue } from "@/lib/queue/worker";
import { getAllTimeRuleStats, getOverview, getStepStats, parseRange, rate } from "@/lib/stats";
import { GET as clickLink } from "@/app/r/[code]/route";
import { createRule, resetDatabase, singleStep, startMockGraph } from "./helpers";
import { fbComment, fbDm, fbRead, igComment, postback } from "./fixtures";

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
});

async function deliver(payload: unknown) {
  await ingestWebhook(db, payload);
  await drainQueue(db);
}

describe("getOverview", () => {
  it("สรุปตัวเลขตรงกับกิจกรรมที่เกิดขึ้น", async () => {
    const commentRule = await createRule({ name: "คอมเมนต์ขอลิงก์" });
    const dmRule = await createRule({ name: "ถามราคา", trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990 บาท") });
    const failRule = await createRule({ name: "พัง", keywords: ["พัง"], steps: singleStep("FAIL_PERMANENT"), publicReplies: [] });

    await deliver(fbComment({ commentId: "C1", text: "สนใจ" }));
    await deliver(igComment({ commentId: "C2", text: "สนใจมาก" }));
    await deliver(igComment({ commentId: "C3", text: "สวยจัง", fromId: "OTHER" }));
    await deliver(fbComment({ commentId: "C4", text: "พัง", fromId: "U9" }));
    await deliver(fbDm({ text: "ราคาเท่าไหร่", mid: "x1" }));
    await deliver(fbRead(Date.now() + 1000));
    // คนแรกกดปุ่ม "ใช่ ฉันสนใจ" แล้วกดลิงก์ในข้อความที่ 2
    await deliver(postback("facebook", flowPayload(commentRule.id, "s1", "b1"), { senderId: "PSID_FROM_C1" }));
    const [link] = await db.select().from(links);
    await clickLink(new NextRequest(`https://dm.example.com/r/${link.code}`), { params: Promise.resolve({ code: link.code }) });

    const o = await getOverview(db, 7);
    expect(o.totals.commentsReceived).toEqual({ facebook: 2, instagram: 2 });
    expect(o.totals.dmsReceived).toEqual({ facebook: 1, instagram: 0 });
    expect(o.totals.triggers).toEqual({ facebook: 3, instagram: 1 });
    expect(o.totals.dmsSent).toEqual({ facebook: 3, instagram: 1 });
    expect(o.totals.dmsFailed).toBe(1);
    expect(o.totals.publicReplies).toBe(2);
    expect(o.totals.buttonTaps).toBe(1);
    expect(o.totals.linksSent).toBe(1);
    expect(o.totals.linksClicked).toBe(1);
    expect(o.totals.totalClicks).toBe(1);
    // CTR นับเฉพาะกฎที่มีปุ่ม (กฎ DM ตอบราคาเป็นข้อความธรรมดา)
    expect(o.totals.reachedContacts).toBe(2);
    expect(o.totals.engagedContacts).toBe(1);
    expect(o.totals.newContacts).toBe(3);
    expect(o.totals.dmsRead).toBe(1);

    expect(o.daily).toHaveLength(7);
    expect(o.daily.at(-1)).toEqual({ date: expect.any(String), sent: 4, clicks: 2, triggers: 4 });

    const byId = Object.fromEntries(o.rules.map((r) => [r.id, r]));
    expect(byId[commentRule.id]).toMatchObject({ triggers: 2, sent: 3, failed: 0, reached: 2, engaged: 1 });
    expect(byId[commentRule.id].hasButtons).toBe(true);
    expect(byId[dmRule.id]).toMatchObject({ triggers: 1, sent: 1, read: 1, reached: 1, engaged: 0, hasButtons: false });
    expect(byId[failRule.id]).toMatchObject({ triggers: 1, sent: 0, failed: 1 });

    const allTime = await getAllTimeRuleStats(db);
    expect(allTime.get(commentRule.id)).toMatchObject({ triggers: 2, reached: 2, engaged: 1 });

    expect(await getStepStats(db, commentRule.id)).toEqual({
      s1: { sent: 2, reached: 2, engaged: 1 },
      s2: { sent: 1, reached: 1, engaged: 1 },
    });
  });

  it("CTR นับเฉพาะคนกดที่ได้รับข้อความในช่วงเวลาเดียวกัน (ไม่เกิน 100%)", async () => {
    const rule = await createRule({ publicReplies: [] });
    await deliver(fbComment({ commentId: "OLD", fromId: "A" }));
    // ข้อความของคน A ถูกส่งไปเมื่อ 10 วันก่อน แต่เพิ่งมากดวันนี้
    await db.execute(sql`UPDATE messages SET sent_at = now() - interval '10 days'`);
    await deliver(postback("facebook", flowPayload(rule.id, "s1", "b1"), { senderId: "PSID_FROM_OLD", mid: "late" }));
    await db.execute(sql`UPDATE messages SET sent_at = now() - interval '10 days'`);
    await deliver(fbComment({ commentId: "NEW", fromId: "B" }));

    const o = await getOverview(db, 7);
    expect(o.totals.reachedContacts).toBe(1);
    expect(o.totals.engagedContacts).toBe(0);
    expect(o.rules[0]).toMatchObject({ reached: 1, engaged: 0 });
    // ทั้งหมดตั้งแต่เริ่มใช้: A ได้รับและกด, B ได้รับแต่ยังไม่กด
    expect((await getAllTimeRuleStats(db)).get(rule.id)).toMatchObject({ reached: 2, engaged: 1 });
  });

  it("ฐานข้อมูลว่างก็แสดงผลได้", async () => {
    const o = await getOverview(db, 30);
    expect(o.daily).toHaveLength(30);
    expect(o.rules).toEqual([]);
    expect(o.totals.newContacts).toBe(0);
    expect(await getStepStats(db, 1)).toEqual({});
  });
});

describe("helpers", () => {
  it("parseRange รับเฉพาะค่าที่กำหนด", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("90")).toBe(90);
    expect(parseRange("12")).toBe(30);
    expect(parseRange(undefined)).toBe(30);
  });

  it("rate คืน null เมื่อหารด้วยศูนย์", () => {
    expect(rate(1, 4)).toBe(25);
    expect(rate(0, 0)).toBeNull();
  });
});
