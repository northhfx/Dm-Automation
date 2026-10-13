import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { instagramAccounts, pages } from "@/db/schema";
import { getInstagramAccount, INSTAGRAM_TOKEN_TTL_MS } from "@/lib/instagram/accounts";
import {
  connectInstagramWithToken,
  disconnectInstagram,
  InstagramConnectError,
  resubscribeInstagram,
} from "@/lib/instagram/connect";
import { DEFAULT_INSTAGRAM_ME, resetDatabase, seedInstagramAccount, startMockGraph } from "./helpers";

let graph: Awaited<ReturnType<typeof startMockGraph>>;
let db: Db;
const NOW = new Date("2026-10-13T08:00:00.000Z");
const ORIGINAL_IG_SECRET = process.env.INSTAGRAM_APP_SECRET;

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
afterEach(() => {
  if (ORIGINAL_IG_SECRET === undefined) delete process.env.INSTAGRAM_APP_SECRET;
  else process.env.INSTAGRAM_APP_SECRET = ORIGINAL_IG_SECRET;
});

async function connectError(token: string): Promise<InstagramConnectError> {
  const err = await connectInstagramWithToken(db, token, NOW).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(InstagramConnectError);
  return err as InstagramConnectError;
}

async function rawRow(id = "IG1") {
  return db.query.instagramAccounts.findFirst({ where: eq(instagramAccounts.id, id) });
}

describe("connectInstagramWithToken — ตรวจก่อนยิง Meta", () => {
  it("token ว่าง → error ที่ช่อง token", async () => {
    const err = await connectError("  \n ");
    expect(err.field).toBe("token");
    expect(err.message).toBe("วาง access token ของ Instagram ก่อน");
    expect(graph.calls).toHaveLength(0);
  });

  it("token ของ Facebook (EAA…) → error ที่ช่อง token โดยไม่ยิง Meta เลย", async () => {
    const err = await connectError("EAAGm0PX4ZCpsBAxyz");
    expect(err.field).toBe("token");
    expect(err.message).toContain("ขึ้นต้นด้วย EAA");
    expect(graph.calls).toHaveLength(0);
    expect(await db.select().from(instagramAccounts)).toHaveLength(0);
  });

  it("ยังไม่ได้ใส่ Instagram app secret → error ที่ช่อง appSecret", async () => {
    delete process.env.INSTAGRAM_APP_SECRET;
    const err = await connectError("IGAA_dashboard_token");
    expect(err.field).toBe("appSecret");
    expect(err.message).toBe("ใส่ Instagram app secret ในหัวข้อ Instagram App ก่อน");
    expect(graph.calls).toHaveLength(0);
  });
});

describe("connectInstagramWithToken — เชื่อมต่อสำเร็จ", () => {
  it("token จากหน้า dashboard: แลกไม่ได้ → เก็บ token ที่วาง (เข้ารหัส) และประมาณวันหมดอายุ 60 วัน", async () => {
    const result = await connectInstagramWithToken(db, "IGAA_dashboard_token", NOW);
    expect(result).toMatchObject({
      accountId: "IG1",
      username: "test.shop",
      subscribed: true,
      tokenExpiryEstimated: true,
    });
    expect(result.tokenExpiresAt.getTime()).toBe(NOW.getTime() + INSTAGRAM_TOKEN_TTL_MS);

    const row = await rawRow();
    expect(row).toBeDefined();
    expect(row!.accessToken).not.toBe("IGAA_dashboard_token");
    expect(row!.accessToken).not.toContain("IGAA_dashboard_token");
    expect(row).toMatchObject({
      id: "IG1",
      appScopedId: "APPSCOPED1",
      username: "test.shop",
      name: "ร้านทดสอบ",
      accountType: "Business",
      tokenExpiryEstimated: true,
      subscribed: true,
      lastError: null,
    });
    expect(row!.tokenRefreshedAt.getTime()).toBe(NOW.getTime());
    expect((await getInstagramAccount(db, "IG1"))!.token).toBe("IGAA_dashboard_token");

    // ลำดับ: แลก token (ไม่สำเร็จ) → /me → subscribe
    expect(graph.calls.map((c) => [c.method, c.api, c.rawPath])).toEqual([
      ["GET", "instagram", "/access_token"],
      ["GET", "instagram", "/v23.0/me"],
      ["POST", "instagram", "/v23.0/me/subscribed_apps"],
    ]);
    expect(graph.calls[0].query).toMatchObject({ grant_type: "ig_exchange_token", client_secret: "test-ig-app-secret" });
    expect(graph.calls[2].query.subscribed_fields).toBe("comments,messages,messaging_postbacks,messaging_seen");
    expect(graph.calls.every((c) => c.query.access_token === "IGAA_dashboard_token")).toBe(true);
  });

  it("token อายุสั้น (IGSHORT…) → แลกเป็น long-lived แล้วเก็บ token ใหม่ วันหมดอายุจาก Meta", async () => {
    const result = await connectInstagramWithToken(db, "IGSHORT_abc", NOW);
    expect(result.tokenExpiryEstimated).toBe(false);
    expect(result.tokenExpiresAt.getTime()).toBe(NOW.getTime() + 5183944 * 1000);
    const account = await getInstagramAccount(db, "IG1");
    expect(account!.token).toMatch(/^IG_LONG_\d+$/);
    expect(account!.tokenExpiryEstimated).toBe(false);
    // /me และ subscribe ใช้ token ใหม่
    const after = graph.calls.slice(1);
    expect(after.every((c) => c.query.access_token === account!.token)).toBe(true);
  });

  it("token ที่คัดลอกมาติดช่องว่าง ขึ้นบรรทัด หรือเครื่องหมายคำพูด → ตัดออกก่อนใช้", async () => {
    await connectInstagramWithToken(db, '  "IGAA_dash\nboard_token"  ', NOW);
    expect((await getInstagramAccount(db, "IG1"))!.token).toBe("IGAA_dashboard_token");
  });

  it("token ไม่ขึ้นต้นด้วย IG → ยังเชื่อมได้ แต่แจ้งเตือน", async () => {
    await db.delete(pages);
    const result = await connectInstagramWithToken(db, "abc123token", NOW);
    expect(result.accountId).toBe("IG1");
    expect(result.notices).toEqual([
      "token ไม่ได้ขึ้นต้นด้วย IG — ถ้าเชื่อมไม่สำเร็จ ให้สร้าง token ใหม่จากหน้า API setup with Instagram login",
    ]);
  });

  it("เชื่อมซ้ำ → อัปเดตแถวเดิม (ไม่ซ้ำ)", async () => {
    await connectInstagramWithToken(db, "IGAA_first", NOW);
    await connectInstagramWithToken(db, "IGAA_second", NOW);
    expect(await db.select().from(instagramAccounts)).toHaveLength(1);
    expect((await getInstagramAccount(db, "IG1"))!.token).toBe("IGAA_second");
  });
});

describe("connectInstagramWithToken — subscribe ไม่สำเร็จ", () => {
  it("ยังบันทึกบัญชี แต่ subscribed=false + lastError + แจ้งเตือน", async () => {
    graph.failWhen((c) => c.path === "/me/subscribed_apps");
    const result = await connectInstagramWithToken(db, "IGAA_dashboard_token", NOW);
    expect(result.subscribed).toBe(false);
    const row = await rawRow();
    expect(row!.subscribed).toBe(false);
    expect(row!.lastError).toBe("subscribe webhook ไม่สำเร็จ (mock: Graph API ล่ม)");
    expect(result.notices).toContain("subscribe webhook ไม่สำเร็จ (mock: Graph API ล่ม)");
  });
});

describe("connectInstagramWithToken — token ใช้ไม่ได้", () => {
  it("token หมดอายุ (code 190) → error ภาษาคน และไม่บันทึกอะไร", async () => {
    const err = await connectError("IG_EXPIRED_token");
    expect(err.field).toBe("token");
    expect(err.message).toBe("token ใช้ไม่ได้หรือหมดอายุ — กด Generate token ใหม่แล้ววางอีกครั้ง");
    expect(await db.select().from(instagramAccounts)).toHaveLength(0);
    expect(graph.calls.some((c) => c.path === "/me/subscribed_apps")).toBe(false);
  });

  it("error อื่นจาก /me → 'เชื่อมต่อไม่สำเร็จ: …' และไม่บันทึก", async () => {
    graph.failWhen((c) => c.path === "/me");
    const err = await connectError("IGAA_dashboard_token");
    expect(err.field).toBe("token");
    expect(err.message).toBe("เชื่อมต่อไม่สำเร็จ: mock: Graph API ล่ม");
    expect(await db.select().from(instagramAccounts)).toHaveLength(0);
  });

  it("/me ไม่มี user_id → ไม่บันทึก", async () => {
    graph.setInstagramMe({ id: "APPSCOPED1", username: "test.shop" });
    const err = await connectError("IGAA_dashboard_token");
    expect(err.message).toMatch(/^เชื่อมต่อไม่สำเร็จ: /);
    expect(await db.select().from(instagramAccounts)).toHaveLength(0);
  });
});

describe("connectInstagramWithToken — เทียบกับเพจที่เชื่อมไว้", () => {
  it("เพจผูก IG เดียวกัน → แจ้งว่าจะใช้ Instagram Login แทน", async () => {
    const result = await connectInstagramWithToken(db, "IGAA_dashboard_token", NOW);
    expect(result.notices).toEqual(["บัญชีนี้ผูกกับเพจ ร้านทดสอบ ด้วย — ระบบจะใช้ Instagram Login กับบัญชีนี้แทน"]);
  });

  it("username ตรงกับเพจ แต่ ID ไม่ตรง → แจ้งว่า ID ไม่ตรง", async () => {
    graph.setInstagramMe({ ...DEFAULT_INSTAGRAM_ME, user_id: "IG9" });
    const result = await connectInstagramWithToken(db, "IGAA_dashboard_token", NOW);
    expect(result.accountId).toBe("IG9");
    expect(result.notices).toEqual([
      "ID ของ @test.shop จาก Instagram Login (IG9) ไม่ตรงกับที่ผูกกับเพจ (IG1) — ระบบยังทำงานได้ แต่อาจตอบซ้ำ แจ้งผู้พัฒนา",
    ]);
  });

  it("ไม่มีเพจไหนเกี่ยวข้อง → ไม่มีแจ้งเตือน", async () => {
    graph.setInstagramMe({ ...DEFAULT_INSTAGRAM_ME, user_id: "IG5", username: "another.shop" });
    const result = await connectInstagramWithToken(db, "IGAA_dashboard_token", NOW);
    expect(result.notices).toEqual([]);
  });
});

describe("resubscribeInstagram", () => {
  it("สำเร็จ → subscribed=true และล้าง error ของการ subscribe", async () => {
    await seedInstagramAccount(db, { subscribed: false });
    await db
      .update(instagramAccounts)
      .set({ lastError: "subscribe webhook ไม่สำเร็จ (เก่า)" })
      .where(eq(instagramAccounts.id, "IG1"));
    expect(await resubscribeInstagram(db, "IG1")).toEqual({ ok: true });
    expect(await rawRow()).toMatchObject({ subscribed: true, lastError: null });
    expect(graph.calls[0]).toMatchObject({ method: "POST", api: "instagram", path: "/me/subscribed_apps" });
    expect(graph.calls[0].query.access_token).toBe("IG_TOKEN");
  });

  it("สำเร็จ แต่ error เรื่อง token ยังคงอยู่", async () => {
    await seedInstagramAccount(db, { subscribed: false });
    await db.update(instagramAccounts).set({ lastError: "ต่ออายุ token ไม่สำเร็จ: x" }).where(eq(instagramAccounts.id, "IG1"));
    expect(await resubscribeInstagram(db, "IG1")).toEqual({ ok: true });
    expect(await rawRow()).toMatchObject({ subscribed: true, lastError: "ต่ออายุ token ไม่สำเร็จ: x" });
  });

  it("ไม่สำเร็จ → ok:false พร้อมสาเหตุ", async () => {
    await seedInstagramAccount(db);
    graph.failWhen((c) => c.path === "/me/subscribed_apps");
    const r = await resubscribeInstagram(db, "IG1");
    expect(r).toEqual({ ok: false, error: "subscribe webhook ไม่สำเร็จ (mock: Graph API ล่ม)" });
    expect(await rawRow()).toMatchObject({ subscribed: false, lastError: "subscribe webhook ไม่สำเร็จ (mock: Graph API ล่ม)" });
  });

  it("ไม่พบบัญชี → ok:false", async () => {
    expect((await resubscribeInstagram(db, "NOPE")).ok).toBe(false);
    expect(graph.calls).toHaveLength(0);
  });
});

describe("disconnectInstagram", () => {
  it("ยกเลิก webhook แล้วลบบัญชี", async () => {
    await seedInstagramAccount(db);
    await disconnectInstagram(db, "IG1");
    expect(await rawRow()).toBeUndefined();
    expect(graph.calls.map((c) => [c.method, c.api, c.path])).toEqual([["DELETE", "instagram", "/me/subscribed_apps"]]);
  });

  it("DELETE subscribed_apps ไม่สำเร็จ → ยังลบบัญชี", async () => {
    await seedInstagramAccount(db);
    graph.failWhen((c) => c.method === "DELETE");
    await disconnectInstagram(db, "IG1");
    expect(await rawRow()).toBeUndefined();
    expect(graph.calls).toHaveLength(1);
  });

  it("เพจที่ผูก IG เดียวกันยังอยู่ครบ", async () => {
    await seedInstagramAccount(db);
    await disconnectInstagram(db, "IG1");
    const [page] = await db.select().from(pages);
    expect(page).toMatchObject({ id: "PAGE1", igUserId: "IG1" });
  });
});
