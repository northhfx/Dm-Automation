import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { instagramAccounts, pages } from "@/db/schema";
import { findConnection, getConnection, type Connection } from "@/lib/connections";
import {
  deleteInstagramAccount,
  findInstagramAccountByWebhookId,
  getInstagramAccount,
  INSTAGRAM_ERRORS,
  INSTAGRAM_TOKEN_TTL_MS,
  instagramAccountHealth,
  instagramHealthLevel,
  instagramTokenState,
  isInstagramAccountUsable,
  needsNewInstagramToken,
  listInstagramAccounts,
  markInstagramLoginDelivery,
  saveInstagramAccount,
  updateInstagramAccountStatus,
  updateInstagramToken,
} from "@/lib/instagram/accounts";
import { resetDatabase, seedInstagramAccount } from "./helpers";

let db: Db;

beforeEach(async () => {
  db = await resetDatabase();
});

const DAY = 24 * 60 * 60_000;

/** การเชื่อมต่อที่คาดหวังเมื่อบัญชี IG1 เชื่อมผ่าน Instagram Login */
const IG_LOGIN: Partial<Connection> = {
  id: "IG1",
  platform: "instagram",
  api: "instagram",
  messagingId: "IG1",
  igUserId: "IG1",
  name: "@test.shop",
  username: "test.shop",
  token: "IG_TOKEN",
};

/** การเชื่อมต่อที่คาดหวังเมื่อใช้ IG1 ผ่านเพจ PAGE1 (แบบเดิม) */
const IG_VIA_PAGE: Partial<Connection> = {
  id: "PAGE1",
  platform: "instagram",
  api: "facebook",
  messagingId: "PAGE1",
  igUserId: "IG1",
  name: "ร้านทดสอบ",
  username: "test.shop",
  token: "PAGE_TOKEN",
  loginChannel: null,
};

const FACEBOOK: Connection = {
  id: "PAGE1",
  platform: "facebook",
  api: "facebook",
  messagingId: "PAGE1",
  igUserId: "IG1",
  name: "ร้านทดสอบ",
  username: null,
  token: "PAGE_TOKEN",
  loginChannel: null,
};

describe("findConnection (จาก entry.id ของ webhook)", () => {
  it("Instagram ใช้บัญชี Instagram Login ก่อนเพจ และจับคู่ app_scoped_id ได้", async () => {
    await seedInstagramAccount(db);
    const byId = await findConnection(db, "instagram", "IG1");
    expect(byId).toMatchObject(IG_LOGIN);
    expect(byId?.loginChannel).toEqual({ commentsAt: null, messagingAt: null });
    expect(await findConnection(db, "instagram", "APPSCOPED1")).toMatchObject(IG_LOGIN);
  });

  it("ไม่มีบัญชี Instagram Login → ใช้เพจที่ผูก IG ไว้ (แบบเดิม)", async () => {
    expect(await findConnection(db, "instagram", "IG1")).toMatchObject(IG_VIA_PAGE);
    expect(await findConnection(db, "instagram", "APPSCOPED1")).toBeNull();
    expect(await findConnection(db, "instagram", "NOPE")).toBeNull();
  });

  it("Facebook ไม่ได้รับผลกระทบจากบัญชี Instagram Login", async () => {
    expect(await findConnection(db, "facebook", "PAGE1")).toEqual(FACEBOOK);
    await seedInstagramAccount(db);
    expect(await findConnection(db, "facebook", "PAGE1")).toEqual(FACEBOOK);
    expect(await findConnection(db, "facebook", "IG1")).toBeNull();
  });

  it("บัญชี IG ที่ไม่ได้ผูกกับเพจไหนเลยก็หาเจอ", async () => {
    await seedInstagramAccount(db, { id: "IG9", appScopedId: "APPSCOPED9", username: "solo.shop", token: "IG_TOKEN_9" });
    expect(await findConnection(db, "instagram", "IG9")).toMatchObject({
      id: "IG9",
      api: "instagram",
      messagingId: "IG9",
      name: "@solo.shop",
      token: "IG_TOKEN_9",
    });
    // IG1 ยังวิ่งผ่านเพจตามเดิม
    expect(await findConnection(db, "instagram", "IG1")).toMatchObject(IG_VIA_PAGE);
  });
});

describe("getConnection (งาน send_dm)", () => {
  it("งานเก่าของ Instagram (pageId = PAGE1) ใช้ Instagram Login ถ้ามีบัญชี ไม่งั้นใช้เพจ", async () => {
    expect(await getConnection(db, "instagram", "PAGE1")).toMatchObject(IG_VIA_PAGE);
    expect(await getConnection(db, "instagram", "PAGE1", "facebook")).toMatchObject(IG_VIA_PAGE);
    await seedInstagramAccount(db);
    expect(await getConnection(db, "instagram", "PAGE1")).toMatchObject(IG_LOGIN);
    expect(await getConnection(db, "instagram", "PAGE1", "facebook")).toMatchObject(IG_LOGIN);
  });

  it("api instagram ใช้ instagram_accounts.id — ยกเลิก Instagram Login แล้วกลับไปใช้เพจที่ผูก IG นั้น", async () => {
    await seedInstagramAccount(db);
    expect(await getConnection(db, "instagram", "IG1", "instagram")).toMatchObject(IG_LOGIN);
    await deleteInstagramAccount(db, "IG1");
    expect(await getConnection(db, "instagram", "IG1", "instagram")).toMatchObject(IG_VIA_PAGE);
    await db.delete(pages);
    expect(await getConnection(db, "instagram", "IG1", "instagram")).toBeNull();
  });

  it("ไม่เจอเพจ → ลอง instagram_accounts.id", async () => {
    await db.delete(pages);
    expect(await getConnection(db, "instagram", "IG1")).toBeNull();
    await seedInstagramAccount(db);
    expect(await getConnection(db, "instagram", "IG1")).toMatchObject(IG_LOGIN);
    expect(await getConnection(db, "instagram", "PAGE1")).toBeNull();
  });

  it("Facebook ใช้ pages.id เสมอ", async () => {
    await seedInstagramAccount(db);
    expect(await getConnection(db, "facebook", "PAGE1")).toEqual(FACEBOOK);
    expect(await getConnection(db, "facebook", "PAGE1", "instagram")).toEqual(FACEBOOK);
    expect(await getConnection(db, "facebook", "IG1")).toBeNull();
  });

  it("token ถอดรหัสไม่ได้ → token = null", async () => {
    await seedInstagramAccount(db);
    await db.update(instagramAccounts).set({ accessToken: "v1.broken.broken.broken" });
    expect((await getConnection(db, "instagram", "IG1", "instagram"))?.token).toBeNull();
    expect((await findConnection(db, "instagram", "IG1"))?.token).toBeNull();
    expect((await getInstagramAccount(db, "IG1"))?.token).toBeNull();
    expect((await listInstagramAccounts(db))[0].token).toBeNull();
  });
});

describe("instagram_accounts", () => {
  it("เก็บ token แบบเข้ารหัส และไม่ส่งคอลัมน์ที่เข้ารหัสออกไป", async () => {
    const account = await seedInstagramAccount(db);
    const row = await db.query.instagramAccounts.findFirst({ where: eq(instagramAccounts.id, "IG1") });
    expect(row?.accessToken).not.toContain("IG_TOKEN");
    expect(account.token).toBe("IG_TOKEN");
    expect(account).not.toHaveProperty("accessToken");
    expect(account).toMatchObject({ appScopedId: "APPSCOPED1", username: "test.shop", subscribed: true });
  });

  it("บันทึกวันที่ได้รับ webhook ผ่าน Instagram Login แยกคอมเมนต์กับ DM", async () => {
    await seedInstagramAccount(db);
    const commentsAt = new Date("2026-10-01T10:00:00Z");
    await markInstagramLoginDelivery(db, "IG1", "comments", commentsAt);
    let a = await getInstagramAccount(db, "IG1");
    expect(a?.lastCommentWebhookAt).toEqual(commentsAt);
    expect(a?.lastMessagingWebhookAt).toBeNull();

    const messagingAt = new Date("2026-10-02T10:00:00Z");
    await markInstagramLoginDelivery(db, "IG1", "messaging", messagingAt);
    a = await getInstagramAccount(db, "IG1");
    expect(a?.lastCommentWebhookAt).toEqual(commentsAt);
    expect(a?.lastMessagingWebhookAt).toEqual(messagingAt);
    expect((await findConnection(db, "instagram", "IG1"))?.loginChannel).toEqual({ commentsAt, messagingAt });

    await markInstagramLoginDelivery(db, "IG1", "messaging");
    a = await getInstagramAccount(db, "IG1");
    expect(Date.now() - a!.lastMessagingWebhookAt!.getTime()).toBeLessThan(60_000);
  });

  it("เชื่อมซ้ำ: รีเซ็ตสถานะ token/subscribe แต่คงเวลาที่ได้รับ webhook ไว้", async () => {
    const seen = new Date("2026-10-01T10:00:00Z");
    await seedInstagramAccount(db, { lastCommentWebhookAt: seen, lastMessagingWebhookAt: seen });
    await updateInstagramAccountStatus(db, "IG1", { lastError: "เคยพัง", tokenCheckedAt: new Date() });

    const now = new Date("2026-10-10T00:00:00Z");
    const expires = new Date(now.getTime() + INSTAGRAM_TOKEN_TTL_MS);
    await saveInstagramAccount(
      db,
      {
        id: "IG1",
        appScopedId: "APPSCOPED1",
        username: "renamed.shop",
        name: null,
        accountType: "Media_Creator",
        token: "IG_NEW",
        tokenExpiresAt: expires,
        tokenExpiryEstimated: true,
      },
      now,
    );
    expect(await getInstagramAccount(db, "IG1")).toMatchObject({
      username: "renamed.shop",
      name: null,
      accountType: "Media_Creator",
      token: "IG_NEW",
      tokenExpiresAt: expires,
      tokenExpiryEstimated: true,
      tokenRefreshedAt: now,
      tokenCheckedAt: null,
      subscribed: false,
      lastError: null,
      connectedAt: now,
      lastCommentWebhookAt: seen,
      lastMessagingWebhookAt: seen,
    });
    expect(await listInstagramAccounts(db)).toHaveLength(1);
  });

  it("ต่ออายุ token สำเร็จ และแก้สถานะเฉพาะค่าที่ส่งมา", async () => {
    await seedInstagramAccount(db, { tokenExpiryEstimated: true });
    await updateInstagramAccountStatus(db, "IG1", { subscribed: false, lastError: "subscribe webhook ไม่สำเร็จ" });
    let a = await getInstagramAccount(db, "IG1");
    expect(a).toMatchObject({ subscribed: false, lastError: "subscribe webhook ไม่สำเร็จ", tokenCheckedAt: null });

    const checked = new Date("2026-10-05T00:00:00Z");
    await updateInstagramAccountStatus(db, "IG1", { tokenCheckedAt: checked });
    await updateInstagramAccountStatus(db, "IG1", {});
    a = await getInstagramAccount(db, "IG1");
    expect(a).toMatchObject({ subscribed: false, lastError: "subscribe webhook ไม่สำเร็จ", tokenCheckedAt: checked });

    const now = new Date("2026-10-06T00:00:00Z");
    const expires = new Date("2026-12-05T00:00:00Z");
    await updateInstagramToken(db, "IG1", { token: "IG_REFRESHED_1", tokenExpiresAt: expires, tokenExpiryEstimated: false }, now);
    a = await getInstagramAccount(db, "IG1");
    expect(a).toMatchObject({
      token: "IG_REFRESHED_1",
      tokenExpiresAt: expires,
      tokenExpiryEstimated: false,
      tokenRefreshedAt: now,
      tokenCheckedAt: now,
      lastError: null,
      subscribed: false,
    });

    await updateInstagramAccountStatus(db, "IG1", { subscribed: true, lastError: null });
    expect(await getInstagramAccount(db, "IG1")).toMatchObject({ subscribed: true, lastError: null });
  });

  it("เรียงตาม username, หาจาก id/app_scoped_id และลบได้", async () => {
    await seedInstagramAccount(db, { id: "IG2", appScopedId: "APPSCOPED2", username: "zeta.shop" });
    await seedInstagramAccount(db, { id: "IG3", appScopedId: null, username: "alpha.shop" });
    await seedInstagramAccount(db);
    expect((await listInstagramAccounts(db)).map((a) => a.username)).toEqual(["alpha.shop", "test.shop", "zeta.shop"]);
    expect((await findInstagramAccountByWebhookId(db, "APPSCOPED2"))?.id).toBe("IG2");
    expect((await findInstagramAccountByWebhookId(db, "IG3"))?.id).toBe("IG3");
    expect(await findInstagramAccountByWebhookId(db, "NOPE")).toBeNull();
    await deleteInstagramAccount(db, "IG2");
    expect(await getInstagramAccount(db, "IG2")).toBeNull();
    expect(await listInstagramAccounts(db)).toHaveLength(2);
  });

  it("สถานะ token: ใช้ได้ / ใกล้หมดอายุ / หมดอายุ / ถอดรหัสไม่ได้", () => {
    const now = new Date("2026-10-13T00:00:00Z");
    const at = (ms: number) => new Date(now.getTime() + ms);
    expect(instagramTokenState({ token: "IG", tokenExpiresAt: at(60 * DAY) }, now)).toBe("ok");
    expect(instagramTokenState({ token: "IG", tokenExpiresAt: at(7 * DAY) }, now)).toBe("ok");
    expect(instagramTokenState({ token: "IG", tokenExpiresAt: at(7 * DAY - 1) }, now)).toBe("expiring");
    expect(instagramTokenState({ token: "IG", tokenExpiresAt: at(DAY) }, now)).toBe("expiring");
    expect(instagramTokenState({ token: "IG", tokenExpiresAt: at(0) }, now)).toBe("expiring");
    expect(instagramTokenState({ token: "IG", tokenExpiresAt: at(-1) }, now)).toBe("expired");
    expect(instagramTokenState({ token: null, tokenExpiresAt: at(60 * DAY) }, now)).toBe("invalid");
    expect(instagramTokenState({ token: null, tokenExpiresAt: at(-DAY) }, now)).toBe("invalid");
    expect(instagramTokenState({ token: "IG", tokenExpiresAt: new Date(Date.now() + 30 * DAY) })).toBe("ok");
  });

  it("สถานะรวมของบัญชี: กติกาเดียวสำหรับแถบเมนู หน้าตั้งค่า และคู่มือ", () => {
    const now = new Date("2026-10-13T00:00:00Z");
    type HealthInput = Parameters<typeof instagramAccountHealth>[0];
    const base: HealthInput = { token: "IG", tokenExpiresAt: new Date(now.getTime() + 30 * DAY), subscribed: true, lastError: null };
    const health = (o: Partial<HealthInput>) => instagramAccountHealth({ ...base, ...o }, now);

    expect(health({})).toBe("ok");
    expect(health({ token: null })).toBe("invalid");
    expect(health({ tokenExpiresAt: new Date(now.getTime() - 1) })).toBe("expired");
    // Meta ไม่รับ token แล้ว (วันหมดอายุยังไม่ถึง) → ต้องวาง token ใหม่ ไม่ใช่ "พร้อมใช้งาน"
    expect(health({ lastError: INSTAGRAM_ERRORS.tokenRejected })).toBe("rejected");
    expect(health({ lastError: INSTAGRAM_ERRORS.tokenExpired })).toBe("rejected");
    expect(health({ subscribed: false, lastError: `${INSTAGRAM_ERRORS.subscribePrefix} (x)` })).toBe("unsubscribed");
    expect(health({ tokenExpiresAt: new Date(now.getTime() + DAY) })).toBe("expiring");
    // ต่ออายุไม่สำเร็จชั่วคราว / subscribe ซ้ำหลังต่ออายุไม่สำเร็จ → เตือน แต่ยังใช้งานได้
    expect(health({ lastError: `${INSTAGRAM_ERRORS.refreshPrefix}: 500` })).toBe("warning");
    expect(health({ lastError: `${INSTAGRAM_ERRORS.subscribePrefix} (x)` })).toBe("warning");

    expect(instagramHealthLevel("ok")).toBe("ok");
    expect(instagramHealthLevel("warning")).toBe("warning");
    expect(instagramHealthLevel("expiring")).toBe("warning");
    for (const h of ["invalid", "expired", "rejected", "unsubscribed"] as const) expect(instagramHealthLevel(h)).toBe("critical");
    expect(["invalid", "expired", "rejected", "unsubscribed", "expiring", "warning", "ok"].filter((h) =>
      needsNewInstagramToken(h as Parameters<typeof needsNewInstagramToken>[0]),
    )).toEqual(["invalid", "expired", "rejected"]);

    expect(isInstagramAccountUsable({ ...base, lastError: `${INSTAGRAM_ERRORS.refreshPrefix}: 500` }, now)).toBe(true);
    expect(isInstagramAccountUsable({ ...base, tokenExpiresAt: new Date(now.getTime() - DAY) }, now)).toBe(false);
    expect(isInstagramAccountUsable({ ...base, subscribed: false }, now)).toBe(false);
  });
});
