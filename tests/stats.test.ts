import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { Db } from "@/db/client";
import { links } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import { drainQueue } from "@/lib/queue/worker";
import { getOverview, parseRange, rate } from "@/lib/stats";
import { GET as clickLink } from "@/app/r/[code]/route";
import { createRule, resetDatabase, startMockGraph } from "./helpers";
import { fbComment, fbDm, fbRead, igComment } from "./fixtures";

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
    const dmRule = await createRule({ name: "ถามราคา", trigger: "dm", keywords: ["ราคา"], linkUrl: null });
    const failRule = await createRule({ name: "พัง", keywords: ["พัง"], dmText: "FAIL_PERMANENT", publicReplies: [] });

    await deliver(fbComment({ commentId: "C1", text: "สนใจ" }));
    await deliver(igComment({ commentId: "C2", text: "สนใจมาก" }));
    await deliver(igComment({ commentId: "C3", text: "สวยจัง", fromId: "OTHER" }));
    await deliver(fbComment({ commentId: "C4", text: "พัง", fromId: "U9" }));
    await deliver(fbDm({ text: "ราคาเท่าไหร่", mid: "x1" }));
    await deliver(fbRead(Date.now() + 1000));

    const [firstLink] = await db.select().from(links).orderBy(links.id);
    await clickLink(new NextRequest(`https://dm.example.com/r/${firstLink.code}`), {
      params: Promise.resolve({ code: firstLink.code }),
    });

    const o = await getOverview(db, 7);
    expect(o.totals.commentsReceived).toEqual({ facebook: 2, instagram: 2 });
    expect(o.totals.dmsReceived).toEqual({ facebook: 1, instagram: 0 });
    expect(o.totals.triggers).toEqual({ facebook: 3, instagram: 1 });
    expect(o.totals.dmsSent).toEqual({ facebook: 2, instagram: 1 });
    expect(o.totals.dmsFailed).toBe(1);
    expect(o.totals.publicReplies).toBe(2);
    expect(o.totals.linksSent).toBe(2);
    expect(o.totals.linksClicked).toBe(1);
    expect(o.totals.totalClicks).toBe(1);
    expect(o.totals.newContacts).toBe(3);
    // read receipt ของ PSID1 นับเฉพาะข้อความที่ส่งให้ PSID1
    expect(o.totals.dmsRead).toBe(1);

    expect(o.daily).toHaveLength(7);
    const today = o.daily.at(-1)!;
    expect(today).toEqual({ date: expect.any(String), sent: 3, clicks: 1, triggers: 4 });

    const byId = Object.fromEntries(o.rules.map((r) => [r.id, r]));
    expect(byId[commentRule.id]).toMatchObject({ triggers: 2, sent: 2, failed: 0, linksSent: 2, linksClicked: 1 });
    expect(byId[dmRule.id]).toMatchObject({ triggers: 1, sent: 1, read: 1, linksSent: 0 });
    expect(byId[failRule.id]).toMatchObject({ triggers: 1, sent: 0, failed: 1 });
  });

  it("ฐานข้อมูลว่างก็แสดงผลได้", async () => {
    const o = await getOverview(db, 30);
    expect(o.daily).toHaveLength(30);
    expect(o.rules).toEqual([]);
    expect(o.totals.newContacts).toBe(0);
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
