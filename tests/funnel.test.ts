import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contacts, events, instagramAccounts, linkChecks, pages, rules } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import { flowPayload } from "@/lib/flows/types";
import { getFunnel, getPreviousFunnel, getProblems, rulesWithLinks } from "@/lib/funnel";
import { checkRuleLinks, checkRuleLinksIfDue, LINK_CHECK_INTERVAL_MS, probeUrl, type FetchLike } from "@/lib/link-health";
import { drainQueue } from "@/lib/queue/worker";
import { getOverview } from "@/lib/stats";
import { createRule, resetDatabase, seedInstagramAccount, singleStep, startMockGraph } from "./helpers";
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
    const click = (ruleId: number, contactId: number, createdAt: Date) => ({ type: "link_clicked" as const, platform: "facebook" as const, ruleId, contactId, createdAt });
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
      // คลิกลิงก์ (นับจาก link_clicked ในช่วงเดียวกัน)
      click(a.id, c1, at(1)),
      click(a.id, c1, at(1)),
      click(b.id, c2, at(1)), // c2 ไม่ได้พิมพ์ keyword ของกฎ B → ไม่นับ
      click(a.id, c3, at(10)),
    ]);
    return { a, b, c1, c3 };
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

  it("คลิกนับเฉพาะในช่วงเดียวกัน: ช่วงก่อนหน้าไม่นับคลิกที่เกิดในช่วงนี้", async () => {
    const { a, c3 } = await seed();
    // c3 พิมพ์ในช่วงก่อนหน้า (ไม่ได้คลิกตอนนั้นในเคสนี้) แล้วกลับมาพิมพ์ + คลิกในช่วงนี้
    await db.delete(events).where(eq(events.type, "link_clicked"));
    await db.insert(events).values([
      { type: "rule_triggered", platform: "facebook", ruleId: a.id, contactId: c3, createdAt: at(1) },
      { type: "link_clicked", platform: "facebook", ruleId: a.id, contactId: c3, createdAt: at(1) },
    ]);
    expect((await getPreviousFunnel(db, 7)).clicked).toEqual({ facebook: 0, instagram: 0 });
    const f = await getFunnel(db, 7, []);
    expect(f.byRule.get(a.id)).toEqual({ typed: 4, clicked: 1 });
    // c3 รู้จักก่อนช่วงนี้ → Contact เดิม
    expect(f.totals.returningPeople).toBe(3);
  });

  it("คอมเมนต์ที่ยังไม่มี contact: หาคนเดียวกันจากกิจกรรมอื่น (ไม่นับซ้ำ + คลิกนับได้)", async () => {
    const a = await createRule({ name: "A", steps: LINK_STEP });
    const c = await contact("PSID_X", "facebook", at(30));
    const fb = { platform: "facebook" as const, pageId: "PAGE1", ruleId: a.id };
    await db.insert(events).values([
      // คอมเมนต์ครั้งแรก (ข้อมูลเก่า ไม่ได้ผูก contact) — DM ส่งสำเร็จ รู้ว่าเป็น contact c
      { ...fb, type: "rule_triggered", actorId: "ASID_X", postId: "P1", createdAt: at(2) },
      { ...fb, type: "dm_sent", actorId: "ASID_X", contactId: c, createdAt: at(2) },
      // คอมเมนต์อีกโพสต์ DM ยังรอส่ง / ส่งไม่สำเร็จ
      { ...fb, type: "rule_triggered", actorId: "ASID_X", postId: "P2", createdAt: at(1) },
      // คอมเมนต์ซ้ำโพสต์เดิม (กฎตอบคนละครั้ง) → ถูกข้าม แต่ก็พิมพ์ keyword มา
      { ...fb, type: "skipped", actorId: "ASID_X", postId: "P1", meta: { reason: "once_per_user" }, createdAt: at(1) },
      { ...fb, type: "link_clicked", contactId: c, createdAt: at(1) },
    ]);
    const f = await getFunnel(db, 7, []);
    expect(f.totals.typed).toEqual({ facebook: 1, instagram: 0 });
    expect(f.totals.clicked).toEqual({ facebook: 1, instagram: 0 });
    expect(f.totals.returningPeople).toBe(1);
  });

  it("Instagram: id คนคอมเมนต์ตรงกับ contact เลย + กฎตอบคนละครั้งนับเป็นคนกลับมา", async () => {
    const a = await createRule({ name: "A", steps: LINK_STEP });
    await contact("IGSID_Y", "instagram", at(30));
    await db.insert(events).values({
      type: "skipped",
      platform: "instagram",
      pageId: "PAGE1",
      ruleId: a.id,
      actorId: "IGSID_Y",
      meta: { reason: "once_per_user" },
      createdAt: at(1),
    });
    const f = await getFunnel(db, 7, []);
    expect(f.totals).toMatchObject({ typed: { facebook: 0, instagram: 1 }, newPeople: 0, returningPeople: 1 });
  });

  it("ส่งข้อความแรกไม่สำเร็จ (token ใช้ไม่ได้ — ไม่มี rule_triggered) ก็นับว่าพิมพ์ keyword · IG ที่สลับวิธีเชื่อมต่อยังเป็นคนเดิม", async () => {
    const a = await createRule({ name: "A", steps: LINK_STEP });
    const ig = await contact("IGSID_Z", "instagram", at(30)); // contact เดิม ผูกกับ PAGE1
    await db.insert(events).values([
      { type: "dm_failed", platform: "facebook", pageId: "PAGE1", ruleId: a.id, actorId: "ASID_T", meta: { source: "comment" }, createdAt: at(1) },
      // ข้อความถัดไปหลังกดปุ่มไม่สำเร็จ ไม่ใช่การพิมพ์ keyword
      { type: "dm_failed", platform: "facebook", pageId: "PAGE1", ruleId: a.id, actorId: "ASID_B", meta: { source: "button" }, createdAt: at(1) },
      // หลังสลับไปเชื่อมผ่าน Instagram Login (page_id = IG1): ตรงกับกฎ + ส่งไม่สำเร็จ = คนเดียวกัน
      { type: "rule_triggered", platform: "instagram", pageId: "IG1", ruleId: a.id, actorId: "IGSID_Z", createdAt: at(2) },
      { type: "dm_failed", platform: "instagram", pageId: "IG1", ruleId: a.id, actorId: "IGSID_Z", meta: { source: "comment" }, createdAt: at(2) },
      { type: "rule_triggered", platform: "instagram", pageId: "PAGE1", ruleId: a.id, contactId: ig, actorId: "IGSID_Z", createdAt: at(1) },
    ]);
    const f = await getFunnel(db, 7, []);
    expect(f.totals.typed).toEqual({ facebook: 1, instagram: 1 });
    expect(f.totals.returningPeople).toBe(1);
  });

  it("กฎที่มีปุ่มลิงก์", async () => {
    const { a } = await seed();
    expect(await rulesWithLinks(db)).toEqual(new Set([a.id]));
  });
});

describe("getProblems (ปัญหาที่ต้องดู)", () => {
  it("ไม่มีปัญหา", async () => {
    await db.update(pages).set({ subscribed: true }).where(eq(pages.id, "PAGE1"));
    expect(await getProblems(db, 7)).toEqual({
      failedSends: 0,
      failedAfterTap: 0,
      failedByRule: new Map(),
      deadTaps: 0,
      deadTapRules: [],
      brokenLinks: [],
      connections: [],
    });
  });

  it("รวมส่งไม่สำเร็จ / กดปุ่มแล้วไม่มีข้อความถัดไป / ลิงก์เสีย / การเชื่อมต่อ", async () => {
    const linkRule = await createRule({ name: "ขอลิงก์", steps: LINK_STEP });
    const off = await createRule({ name: "ปิดอยู่", active: false, steps: singleStep("x", [{ id: "b9", title: "y", type: "link", url: "https://old.example.com" }]) });
    const failed = (source: string | undefined, createdAt: Date) => ({
      type: "dm_failed" as const,
      platform: "facebook" as const,
      ruleId: linkRule.id,
      meta: source ? { source } : {},
      createdAt,
    });
    await db.insert(events).values([
      failed("button", at(1)),
      failed("comment", at(1)),
      failed(undefined, at(1)), // token ใช้ไม่ได้ (งานเก่าไม่มี source)
      failed("comment", at(20)), // นอกช่วง
    ]);
    const skipped = (reason: string) => ({ type: "skipped" as const, platform: "facebook" as const, ruleId: off.id, meta: { reason }, createdAt: at(1) });
    await db.insert(events).values([skipped("button_target_missing"), skipped("rule_inactive"), skipped("cooldown")]);
    await db.insert(linkChecks).values([
      { url: "https://shop.example.com/a", ok: false, status: 404, failures: 2 },
      { url: "https://flaky.example.com", ok: false, status: 503, failures: 1 }, // เสียรอบเดียว ยังไม่เตือน
      { url: "https://old.example.com", ok: false, error: "ENOTFOUND", failures: 3 }, // อยู่ในกฎที่ปิดแล้ว
    ]);
    await db.update(pages).set({ subscribed: true, lastError: "token expired" }).where(eq(pages.id, "PAGE1"));
    // บัญชี IG: ต่ออายุไม่สำเร็จชั่วคราว (ยังใช้งานได้) ไม่นับ · ยังไม่รับ webhook นับ
    await seedInstagramAccount(db, { id: "IG_WARN", username: "warn.shop" });
    await db.update(instagramAccounts).set({ lastError: "ต่ออายุ token ไม่สำเร็จ: timeout" }).where(eq(instagramAccounts.id, "IG_WARN"));
    await seedInstagramAccount(db, { id: "IG_OFF", username: "off.shop", appScopedId: "APPSCOPED2", subscribed: false });

    const p = await getProblems(db, 7);
    expect(p.failedSends).toBe(3);
    expect(p.failedAfterTap).toBe(1);
    expect(p.failedByRule).toEqual(new Map([[linkRule.id, 3]]));
    expect(p.deadTaps).toBe(2);
    expect(p.deadTapRules).toEqual(["ปิดอยู่"]);
    expect(p.brokenLinks).toMatchObject([{ url: "https://shop.example.com/a", status: 404, ruleNames: ["ขอลิงก์"] }]);
    expect(p.connections).toEqual([
      { name: "ร้านทดสอบ", platform: "facebook" },
      { name: "@off.shop", platform: "instagram" },
    ]);
  });

  it("token ใช้ไม่ได้: คนที่ได้ DM ไปแล้ว (กฎตอบคนละครั้ง) คอมเมนต์ซ้ำ ไม่นับเป็นส่งไม่สำเร็จ", async () => {
    await createRule();
    await ingestWebhook(db, fbComment({ commentId: "C1", text: "สนใจ" }));
    await drainQueue(db);
    await db.update(pages).set({ accessToken: "garbage" }).where(eq(pages.id, "PAGE1"));
    await ingestWebhook(db, fbComment({ commentId: "C2", text: "สนใจอีก" }));
    await drainQueue(db);
    expect((await getProblems(db, 7)).failedSends).toBe(0);
    const reasons = (await db.select().from(events).where(eq(events.type, "skipped"))).map((e) => e.meta?.reason);
    expect(reasons).toEqual(["once_per_user"]);
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

    // ปุ่มเดิมถูกเปลี่ยนเป็นปุ่มลิงก์ (id เดิม) → กดจากข้อความเก่าก็ไม่มีข้อความถัดไปเหมือนกัน
    await db
      .update(rules)
      .set({ steps: singleStep("ข้อความใหม่", [{ id: "b1", title: "ดู", type: "link", url: "https://shop.example.com" }]) })
      .where(eq(rules.id, rule.id));
    await ingestWebhook(db, postback("facebook", flowPayload(rule.id, "s1", "b1"), { senderId: "PSID_FROM_C1", mid: "pb.2" }));
    await drainQueue(db);
    expect((await getProblems(db, 7)).deadTaps).toBe(2);
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
    const tlsErr = Object.assign(new TypeError("fetch failed"), { cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" } });
    const f: FetchLike = async (url, init) => {
      if (url === "https://bot") return new Response("", { status: 503, headers: { "cf-mitigated": "challenge" } });
      if (url === "https://tls") throw tlsErr;
      // Response จริงสร้างสถานะนอก 200–599 ไม่ได้ แต่เว็บอย่าง LinkedIn ตอบ 999 มาได้
      if (url === "https://li") return { status: 999, headers: new Headers(), body: null } as unknown as Response;
      return statusFetch({ "https://a": 404, "https://b": 403, "https://c": 502, "https://d": netErr })(url, init);
    };
    expect(await probeUrl("https://bot", f)).toMatchObject({ ok: true, status: 503 });
    expect(await probeUrl("https://tls", f)).toMatchObject({ ok: true, error: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" });
    // ใบรับรองหมดอายุ: เบราว์เซอร์ของลูกค้าก็ขึ้นเตือน → นับว่าเสีย
    const expired: FetchLike = async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "CERT_HAS_EXPIRED" } });
    };
    expect(await probeUrl("https://x", expired)).toMatchObject({ ok: false, error: "CERT_HAS_EXPIRED" });
    expect(await probeUrl("https://li", f)).toMatchObject({ ok: true, status: 999 });
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

  it("ทุกลิงก์เปิดไม่ได้พร้อมกัน (เน็ตของเซิร์ฟเวอร์เอง) ไม่นับเป็นลิงก์เสีย", async () => {
    await createRule({
      steps: singleStep("x", [
        { id: "b1", title: "1", type: "link", url: "https://a.example.com" },
        { id: "b2", title: "2", type: "link", url: "https://b.example.com" },
      ]),
    });
    const down: FetchLike = async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    };
    await checkRuleLinks(db, down);
    await checkRuleLinks(db, down);
    const rows = await db.select().from(linkChecks);
    expect(rows.map((r) => r.failures)).toEqual([0, 0]);
    expect((await getProblems(db, 7)).brokenLinks).toEqual([]);
  });

  it("ทุกลิงก์อยู่เว็บเดียวกันแล้วเว็บนั้นล่ม = ลิงก์เสียจริง", async () => {
    await createRule({
      steps: singleStep("x", [
        { id: "b1", title: "1", type: "link", url: "https://myshop.example/a" },
        { id: "b2", title: "2", type: "link", url: "https://myshop.example/b" },
      ]),
    });
    const down: FetchLike = async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    };
    await checkRuleLinks(db, down);
    await checkRuleLinks(db, down);
    expect((await getProblems(db, 7)).brokenLinks.map((l) => l.url).sort()).toEqual(["https://myshop.example/a", "https://myshop.example/b"]);
  });
});
