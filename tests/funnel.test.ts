import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contacts, events, linkChecks, links, messages, pages, rules } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import { flowPayload } from "@/lib/flows/types";
import { getFunnel, getPreviousFunnel, getProblems, rulesWithLinks } from "@/lib/funnel";
import { checkRuleLinks, checkRuleLinksIfDue, LINK_CHECK_INTERVAL_MS, probeUrl, type FetchLike } from "@/lib/link-health";
import { drainQueue } from "@/lib/queue/worker";
import { getOverview } from "@/lib/stats";
import { createRule, resetDatabase, singleStep, startMockGraph } from "./helpers";
import { fbComment, postback } from "./fixtures";

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

const DAY = 24 * 60 * 60_000;
/** n วันก่อน (ห่างขอบวันไว้ กันเขตเวลา: ใช้ 1, 2, 10, 30) */
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY);

const LINK_STEP = singleStep("รายละเอียด", [{ id: "b1", title: "ดูรายละเอียด", type: "link", url: "https://shop.example.com/a" }]);

async function contact(id: string, platform: "facebook" | "instagram", firstSeenAt: Date) {
  const [row] = await db.insert(contacts).values({ platform, platformUserId: id, pageId: "PAGE1", firstSeenAt }).returning();
  return row.id;
}

describe("getFunnel (นับเป็นคน)", () => {
  async function seed() {
    const a = await createRule({ name: "A", steps: LINK_STEP });
    const b = await createRule({ name: "B", steps: singleStep("ขอบคุณค่ะ") });
    const c1 = await contact("P1", "facebook", at(30)); // Contact เดิม
    const c2 = await contact("IG_P2", "instagram", at(1)); // Contact ใหม่
    const c3 = await contact("P3", "facebook", at(10)); // พิมพ์ในช่วงก่อนหน้า
    const trig = (ruleId: number, platform: "facebook" | "instagram", createdAt: Date, o: { contactId?: number; actorId?: string } = {}) => ({
      type: "rule_triggered" as const,
      platform,
      ruleId,
      createdAt,
      contactId: o.contactId ?? null,
      actorId: o.actorId ?? null,
    });
    await db.insert(events).values([
      // คนเดิมพิมพ์ keyword เดิม 2 ครั้ง = 1
      trig(a.id, "facebook", at(2), { contactId: c1 }),
      trig(a.id, "facebook", at(1), { contactId: c1 }),
      // คนเดียวกันพิมพ์ keyword ของอีกกฎ = นับแยก
      trig(b.id, "facebook", at(1), { contactId: c1 }),
      trig(a.id, "instagram", at(1), { contactId: c2 }),
      // คอมเมนต์ที่ส่ง DM ไม่สำเร็จ (ไม่มี contact) — นับจาก id คนคอมเมนต์
      trig(a.id, "facebook", at(1), { actorId: "U9" }),
      trig(a.id, "facebook", at(1), { actorId: "U9" }),
      trig(a.id, "facebook", at(10), { contactId: c3 }),
      // กดปุ่มไปข้อความถัดไป ไม่นับเป็นคลิกลิงก์
      { type: "button_clicked", platform: "instagram", ruleId: a.id, contactId: c2, createdAt: at(1) },
    ]);
    await db.insert(links).values([
      { code: "l1", targetUrl: "https://shop.example.com/a", ruleId: a.id, contactId: c1, clicks: 3, firstClickedAt: at(1), createdAt: at(2) },
      { code: "l2", targetUrl: "https://shop.example.com/a", ruleId: a.id, contactId: c2, clicks: 0, createdAt: at(1) },
      { code: "l3", targetUrl: "https://shop.example.com/a", ruleId: a.id, contactId: c3, clicks: 1, firstClickedAt: at(10), createdAt: at(10) },
    ]);
    return { a, b };
  }

  it("คนเดิม keyword เดิม = 1, ต่างกฎนับแยก, คลิกเฉพาะคนที่พิมพ์ในช่วงนี้", async () => {
    const { a, b } = await seed();
    const dates = (await getOverview(db, 7)).daily.map((d) => d.date);
    const f = await getFunnel(db, 7, dates);

    expect(f.totals.typed).toEqual({ facebook: 3, instagram: 1 });
    expect(f.totals.clicked).toEqual({ facebook: 1, instagram: 0 });
    // c1 (2 กฎ) เป็น Contact เดิม · c2 กับคนที่ไม่มี contact เป็นคนใหม่
    expect(f.totals.returningPeople).toBe(2);
    expect(f.totals.newPeople).toBe(2);
    expect(f.byRule.get(a.id)).toEqual({ typed: 3, clicked: 1 });
    expect(f.byRule.get(b.id)).toEqual({ typed: 1, clicked: 0 });

    expect(f.daily).toHaveLength(7);
    const total = (key: "typed" | "clicked") => f.daily.reduce((n, d) => n + d[key].facebook + d[key].instagram, 0);
    expect(total("typed")).toBe(4);
    expect(total("clicked")).toBe(1);
  });

  it("ช่วงก่อนหน้านับแยก ไม่ปนกับช่วงปัจจุบัน", async () => {
    await seed();
    expect(await getPreviousFunnel(db, 7)).toEqual({
      typed: { facebook: 1, instagram: 0 },
      clicked: { facebook: 1, instagram: 0 },
      newPeople: 1,
      returningPeople: 0,
    });
  });

  it("กฎที่มีปุ่มลิงก์", async () => {
    const { a } = await seed();
    expect(await rulesWithLinks(db)).toEqual(new Set([a.id]));
  });
});

describe("getProblems (ปัญหาที่ต้องดู)", () => {
  it("ไม่มีปัญหา", async () => {
    expect(await getProblems(db, 7)).toEqual({ failedSends: 0, failedAfterTap: 0, deadTaps: 0, brokenLinks: [], connections: [] });
  });

  it("รวมส่งไม่สำเร็จ / กดปุ่มแล้วไม่มีข้อความถัดไป / ลิงก์เสีย / การเชื่อมต่อ", async () => {
    await createRule({ name: "ขอลิงก์", steps: LINK_STEP });
    await createRule({ name: "ปิดอยู่", active: false, steps: singleStep("x", [{ id: "b9", title: "y", type: "link", url: "https://old.example.com" }]) });
    const failed = { platform: "facebook" as const, pageId: "PAGE1", status: "failed" as const };
    await db.insert(messages).values([
      { ...failed, source: "button", sentAt: at(1) },
      { ...failed, source: "comment", sentAt: at(1) },
      { ...failed, source: "comment", sentAt: at(20) }, // นอกช่วง
    ]);
    const skipped = (reason: string) => ({ type: "skipped" as const, platform: "facebook" as const, meta: { reason }, createdAt: at(1) });
    await db.insert(events).values([skipped("button_target_missing"), skipped("rule_inactive"), skipped("cooldown")]);
    await db.insert(linkChecks).values([
      { url: "https://shop.example.com/a", ok: false, status: 404, failures: 2 },
      { url: "https://flaky.example.com", ok: false, status: 503, failures: 1 }, // เสียรอบเดียว ยังไม่เตือน
      { url: "https://old.example.com", ok: false, error: "ENOTFOUND", failures: 3 }, // อยู่ในกฎที่ปิดแล้ว
    ]);
    await db.update(pages).set({ lastError: "token expired" }).where(eq(pages.id, "PAGE1"));

    const p = await getProblems(db, 7);
    expect(p.failedSends).toBe(2);
    expect(p.failedAfterTap).toBe(1);
    expect(p.deadTaps).toBe(2);
    expect(p.brokenLinks).toMatchObject([{ url: "https://shop.example.com/a", status: 404, ruleNames: ["ขอลิงก์"] }]);
    expect(p.connections).toEqual([{ name: "ร้านทดสอบ", platform: "facebook" }]);
  });

  it("ลูกค้ากดปุ่มจากข้อความเก่าที่ถูกแก้แล้ว → บันทึกเป็นปัญหา", async () => {
    const rule = await createRule();
    await ingestWebhook(db, fbComment({ commentId: "C1", text: "สนใจ" }));
    await drainQueue(db);
    // ปุ่ม b1 ถูกลบออกจากข้อความแรกแล้ว
    await db.update(rules).set({ steps: singleStep("ข้อความใหม่") }).where(eq(rules.id, rule.id));
    await ingestWebhook(db, postback("facebook", flowPayload(rule.id, "s1", "b1"), { senderId: "PSID_FROM_C1" }));
    await drainQueue(db);

    const [skip] = await db.select().from(events).where(eq(events.type, "skipped"));
    expect(skip.meta).toMatchObject({ reason: "button_target_missing", stepId: "s1", buttonId: "b1" });
    expect((await getProblems(db, 7)).deadTaps).toBe(1);
  });
});

describe("link-health (ตรวจลิงก์ปลายทาง)", () => {
  const statusFetch =
    (statuses: Record<string, number | Error>): FetchLike =>
    async (url) => {
      const s = statuses[url];
      if (s instanceof Error) throw s;
      return new Response("ok", { status: s ?? 200 });
    };

  it("ถือว่าเสียเฉพาะ 404 / 410 / 5xx / เปิดไม่ได้", async () => {
    const netErr = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    const f = statusFetch({ "https://a": 404, "https://b": 403, "https://c": 502, "https://d": netErr });
    expect(await probeUrl("https://a", f)).toEqual({ ok: false, status: 404, error: null });
    expect(await probeUrl("https://b", f)).toEqual({ ok: true, status: 403, error: null });
    expect(await probeUrl("https://c", f)).toMatchObject({ ok: false, status: 502 });
    expect(await probeUrl("https://d", f)).toEqual({ ok: false, status: null, error: "ENOTFOUND" });
    expect(await probeUrl("https://e", f)).toMatchObject({ ok: true, status: 200 });
  });

  it("ตรวจเฉพาะลิงก์ในกฎที่เปิดอยู่ นับรอบที่เสียติดกัน และตรวจซ้ำทุก 6 ชั่วโมง", async () => {
    await createRule({
      name: "เปิด",
      steps: singleStep("x", [
        { id: "b1", title: "1", type: "link", url: "https://dead.example.com" },
        { id: "b2", title: "2", type: "link", url: "https://fine.example.com" },
      ]),
    });
    await createRule({ name: "ปิด", active: false, steps: singleStep("x", [{ id: "b3", title: "3", type: "link", url: "https://off.example.com" }]) });
    await db.insert(linkChecks).values({ url: "https://removed.example.com", ok: false, failures: 5 });
    const f = statusFetch({ "https://dead.example.com": 404 });
    const t0 = new Date();

    expect(await checkRuleLinks(db, f, t0)).toBe(2);
    expect(await checkRuleLinksIfDue(db, f, new Date(t0.getTime() + 60_000))).toBe(0);
    expect(await checkRuleLinksIfDue(db, f, new Date(t0.getTime() + LINK_CHECK_INTERVAL_MS))).toBe(2);

    const rows = await db.select().from(linkChecks).orderBy(linkChecks.url);
    expect(rows.map((r) => [r.url, r.ok, r.failures])).toEqual([
      ["https://dead.example.com", false, 2],
      ["https://fine.example.com", true, 0],
    ]);
    // เสียครบ 2 รอบ → ขึ้นในปัญหาที่ต้องดู
    expect((await getProblems(db, 7)).brokenLinks.map((l) => l.url)).toEqual(["https://dead.example.com"]);
  });
});
