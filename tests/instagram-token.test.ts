import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { events, instagramAccounts } from "@/db/schema";
import { getInstagramAccount, INSTAGRAM_TOKEN_TTL_MS } from "@/lib/instagram/accounts";
import {
  isRefreshDue,
  refreshDueInstagramTokens,
  refreshInstagramAccountToken,
  REFRESH_MIN_AGE_MS,
  REFRESH_RETRY_MS,
  REFRESH_WINDOW_MS,
} from "@/lib/instagram/token";
import { maintenance } from "@/lib/queue/worker";
import { resetDatabase, seedInstagramAccount, startMockGraph } from "./helpers";

let graph: Awaited<ReturnType<typeof startMockGraph>>;
let db: Db;

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-10-13T08:00:00.000Z");

function ago(ms: number, from = NOW): Date {
  return new Date(from.getTime() - ms);
}
function later(ms: number, from = NOW): Date {
  return new Date(from.getTime() + ms);
}

beforeAll(async () => {
  graph = await startMockGraph();
});
afterAll(async () => {
  await graph.close();
});
beforeEach(async () => {
  db = await resetDatabase();
  graph.resetAll();
});

function refreshCalls() {
  return graph.calls.filter((c) => c.rawPath === "/refresh_access_token");
}

async function failedEvents() {
  return db.select().from(events).where(eq(events.type, "token_refresh_failed")).orderBy(events.id);
}

async function rawRow(id = "IG1") {
  return (await db.query.instagramAccounts.findFirst({ where: eq(instagramAccounts.id, id) }))!;
}

describe("isRefreshDue", () => {
  const base = {
    tokenRefreshedAt: ago(30 * DAY),
    tokenExpiresAt: later(5 * DAY),
    tokenExpiryEstimated: false,
    tokenCheckedAt: null as Date | null,
  };

  it("ค่าคงที่ตามที่ Meta กำหนด", () => {
    expect(REFRESH_MIN_AGE_MS).toBe(24 * HOUR);
    expect(REFRESH_WINDOW_MS).toBe(10 * DAY);
    expect(REFRESH_RETRY_MS).toBe(6 * HOUR);
  });

  it("token อายุไม่ถึง 24 ชม. → ยังไม่ต่อ (แม้ใกล้หมดอายุหรือไม่รู้วันหมดอายุ)", () => {
    expect(isRefreshDue({ ...base, tokenRefreshedAt: ago(23 * HOUR) }, NOW)).toBe(false);
    expect(isRefreshDue({ ...base, tokenRefreshedAt: ago(23 * HOUR), tokenExpiryEstimated: true }, NOW)).toBe(false);
    expect(isRefreshDue({ ...base, tokenRefreshedAt: ago(24 * HOUR) }, NOW)).toBe(true);
  });

  it("ไม่รู้วันหมดอายุจริง (estimated) → ต่อเลยหลังครบ 24 ชม.", () => {
    expect(isRefreshDue({ ...base, tokenRefreshedAt: ago(25 * HOUR), tokenExpiresAt: later(59 * DAY), tokenExpiryEstimated: true }, NOW)).toBe(true);
  });

  it("เหลือไม่เกิน 10 วัน → ต่อ, ยังเหลือนาน → ไม่ต่อ", () => {
    expect(isRefreshDue({ ...base, tokenExpiresAt: later(10 * DAY) }, NOW)).toBe(true);
    expect(isRefreshDue({ ...base, tokenExpiresAt: later(9 * DAY) }, NOW)).toBe(true);
    expect(isRefreshDue({ ...base, tokenExpiresAt: later(10 * DAY + 1) }, NOW)).toBe(false);
    expect(isRefreshDue({ ...base, tokenExpiresAt: later(40 * DAY) }, NOW)).toBe(false);
  });

  it("เพิ่งลองไม่ถึง 6 ชม. → รอก่อน", () => {
    expect(isRefreshDue({ ...base, tokenCheckedAt: ago(5 * HOUR) }, NOW)).toBe(false);
    expect(isRefreshDue({ ...base, tokenCheckedAt: ago(6 * HOUR) }, NOW)).toBe(true);
  });
});

describe("refreshDueInstagramTokens", () => {
  it("บัญชีที่ถึงเวลา → ได้ token ใหม่ วันหมดอายุจาก expires_in และล้าง error", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: ago(2 * DAY), tokenExpiryEstimated: true, tokenExpiresAt: later(58 * DAY) });
    await db.update(instagramAccounts).set({ lastError: "error เก่า" }).where(eq(instagramAccounts.id, "IG1"));

    expect(await refreshDueInstagramTokens(db, NOW)).toEqual({ checked: 1, refreshed: 1, failed: 0 });

    const account = (await getInstagramAccount(db, "IG1"))!;
    expect(account.token).toMatch(/^IG_REFRESHED_\d+$/);
    expect(account.tokenExpiresAt.getTime()).toBe(NOW.getTime() + 5184000 * 1000);
    expect(account.tokenExpiryEstimated).toBe(false);
    expect(account.tokenRefreshedAt.getTime()).toBe(NOW.getTime());
    expect(account.tokenCheckedAt?.getTime()).toBe(NOW.getTime());
    expect(account.lastError).toBeNull();
    expect(account.subscribed).toBe(true);

    const [refresh] = refreshCalls();
    expect(refresh).toMatchObject({ method: "GET", api: "instagram", rawPath: "/refresh_access_token" });
    expect(refresh.query).toEqual({ grant_type: "ig_refresh_token", access_token: "IG_TOKEN" });
    // subscribe ซ้ำด้วย token ใหม่
    const subscribe = graph.calls.find((c) => c.path === "/me/subscribed_apps");
    expect(subscribe).toMatchObject({ method: "POST", api: "instagram" });
    expect(subscribe!.query.access_token).toBe(account.token);
    expect(await failedEvents()).toHaveLength(0);
  });

  it("ต่ออายุสำเร็จแต่ subscribe ไม่สำเร็จ → token ใหม่ยังถูกเก็บ บันทึกแค่ lastError", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: ago(2 * DAY), tokenExpiryEstimated: true });
    graph.failWhen((c) => c.path === "/me/subscribed_apps");
    expect(await refreshDueInstagramTokens(db, NOW)).toEqual({ checked: 1, refreshed: 1, failed: 0 });
    const row = await rawRow();
    expect(row.subscribed).toBe(true);
    expect(row.lastError).toBe("subscribe webhook ไม่สำเร็จ (mock: Graph API ล่ม)");
    expect((await getInstagramAccount(db, "IG1"))!.token).toMatch(/^IG_REFRESHED_/);
  });

  it("token อายุยังไม่ถึง 24 ชม. หรือยังเหลืออีกนาน → ข้าม ไม่ยิง Meta", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: ago(2 * HOUR), tokenExpiryEstimated: true });
    await seedInstagramAccount(db, { id: "IG2", appScopedId: null, username: "far.shop", tokenRefreshedAt: ago(5 * DAY), tokenExpiresAt: later(50 * DAY) });
    expect(await refreshDueInstagramTokens(db, NOW)).toEqual({ checked: 0, refreshed: 0, failed: 0 });
    expect(graph.calls).toHaveLength(0);
  });

  it("ต่ออายุไม่สำเร็จ → บันทึก lastError + tokenCheckedAt, ขึ้นในหน้ากิจกรรมครั้งเดียว และไม่ throw", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: ago(2 * DAY), tokenExpiresAt: later(5 * DAY) });
    graph.failWhen((c) => c.rawPath === "/refresh_access_token");

    expect(await refreshDueInstagramTokens(db, NOW)).toEqual({ checked: 1, refreshed: 0, failed: 1 });
    let row = await rawRow();
    expect(row.lastError).toBe("ต่ออายุ token ไม่สำเร็จ: mock: Graph API ล่ม");
    expect(row.tokenCheckedAt?.getTime()).toBe(NOW.getTime());
    expect((await getInstagramAccount(db, "IG1"))!.token).toBe("IG_TOKEN");

    const [ev] = await failedEvents();
    expect(ev).toMatchObject({ type: "token_refresh_failed", platform: "instagram", pageId: "IG1" });
    expect(ev.meta).toEqual({ username: "test.shop", error: { message: "mock: Graph API ล่ม", code: 1, status: 500 } });

    // ภายใน 6 ชม. → ไม่ยิงซ้ำ
    graph.reset();
    expect(await refreshDueInstagramTokens(db, later(5 * HOUR))).toEqual({ checked: 0, refreshed: 0, failed: 0 });
    expect(graph.calls).toHaveLength(0);

    // ครบ 6 ชม. → ลองใหม่ ไม่สำเร็จด้วยสาเหตุเดิม → ไม่เพิ่มในหน้ากิจกรรมซ้ำ
    const retryAt = later(6 * HOUR);
    expect(await refreshDueInstagramTokens(db, retryAt)).toEqual({ checked: 1, refreshed: 0, failed: 1 });
    expect(refreshCalls()).toHaveLength(1);
    row = await rawRow();
    expect(row.tokenCheckedAt?.getTime()).toBe(retryAt.getTime());
    expect(await failedEvents()).toHaveLength(1);
  });

  it("token หมดอายุแล้ว → ข้อความให้สร้าง token ใหม่", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: ago(61 * DAY), tokenExpiresAt: ago(HOUR) });
    graph.failWhen((c) => c.rawPath === "/refresh_access_token");
    await refreshDueInstagramTokens(db, NOW);
    expect((await rawRow()).lastError).toBe(
      "token Instagram หมดอายุหรือถูกยกเลิก — สร้าง token ใหม่ในหน้า API setup with Instagram login แล้ววางใน ตั้งค่า → บัญชี Instagram",
    );
    expect(await failedEvents()).toHaveLength(1);
  });

  it("Meta ตอบ code 190 → ข้อความให้สร้าง token ใหม่ แม้ยังไม่ถึงวันหมดอายุ", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: ago(2 * DAY), tokenExpiresAt: later(5 * DAY) });
    const body = JSON.stringify({ error: { message: "Error validating access token", type: "OAuthException", code: 190 } });
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(body, { status: 400 }));
    try {
      const r = await refreshInstagramAccountToken(db, "IG1", { now: NOW });
      expect(r).toEqual({ ok: false, error: expect.stringContaining("หมดอายุหรือถูกยกเลิก") });
    } finally {
      spy.mockRestore();
    }
    expect((await rawRow()).lastError).toMatch(/^token Instagram หมดอายุหรือถูกยกเลิก/);
    const [ev] = await failedEvents();
    expect(ev.meta).toMatchObject({ error: { code: 190, status: 400 } });
  });

  it("token ถอดรหัสไม่ได้ → บันทึกสาเหตุ ไม่ยิง Meta", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: ago(2 * DAY), tokenExpiryEstimated: true });
    await db.update(instagramAccounts).set({ accessToken: "broken" }).where(eq(instagramAccounts.id, "IG1"));
    expect(await refreshDueInstagramTokens(db, NOW)).toEqual({ checked: 1, refreshed: 0, failed: 1 });
    expect(graph.calls).toHaveLength(0);
    expect((await rawRow()).lastError).toBe("token ถอดรหัสไม่ได้ — วาง token ใหม่");
    expect(await failedEvents()).toHaveLength(1);
  });
});

describe("refreshInstagramAccountToken — เจ้าของกดปุ่มเอง", () => {
  it("token อายุไม่ถึง 24 ชม. → error และไม่ยิง Meta", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: ago(3 * HOUR) });
    const r = await refreshInstagramAccountToken(db, "IG1", { now: NOW, manual: true });
    expect(r).toEqual({ ok: false, error: "token เพิ่งสร้างไม่ถึง 24 ชั่วโมง ยังต่ออายุไม่ได้ (ระบบจะต่ออายุให้เองอัตโนมัติ)" });
    expect(graph.calls).toHaveLength(0);
    expect((await rawRow()).tokenCheckedAt).toBeNull();
  });

  it("token ยังเหลืออีกนาน แต่กดเอง → ต่ออายุได้เลย", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: ago(2 * DAY), tokenExpiresAt: later(50 * DAY) });
    const r = await refreshInstagramAccountToken(db, "IG1", { now: NOW, manual: true });
    expect(r).toEqual({ ok: true, tokenExpiresAt: new Date(NOW.getTime() + 5184000 * 1000) });
    expect(refreshCalls()).toHaveLength(1);
  });

  it("ไม่พบบัญชี → error", async () => {
    const r = await refreshInstagramAccountToken(db, "NOPE", { now: NOW, manual: true });
    expect(r.ok).toBe(false);
    expect(graph.calls).toHaveLength(0);
  });
});

describe("maintenance (worker ทุก 10 นาที)", () => {
  it("ต่ออายุไม่สำเร็จก็ไม่ throw และยังบันทึก error", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: new Date(Date.now() - 2 * DAY), tokenExpiryEstimated: true });
    graph.failWhen((c) => c.rawPath === "/refresh_access_token");
    await expect(maintenance(db)).resolves.toBeUndefined();
    expect((await rawRow()).lastError).toBe("ต่ออายุ token ไม่สำเร็จ: mock: Graph API ล่ม");
  });

  it("ต่ออายุบัญชีที่ถึงเวลาด้วย", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: new Date(Date.now() - 2 * DAY), tokenExpiryEstimated: true });
    await maintenance(db);
    expect((await getInstagramAccount(db, "IG1"))!.token).toMatch(/^IG_REFRESHED_/);
    expect(INSTAGRAM_TOKEN_TTL_MS).toBe(60 * DAY);
  });
});
