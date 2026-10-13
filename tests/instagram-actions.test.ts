import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { instagramAccounts } from "@/db/schema";
import { getInstagramConfig, saveInstagramApp } from "@/lib/config";
import { resetDatabase, seedInstagramAccount, startMockGraph } from "./helpers";

// server action เรียก requireAuth / revalidatePath ซึ่งต้องมี request ของ Next → แทนด้วยของปลอม
vi.mock("@/lib/auth", () => ({ requireAuth: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const {
  connectInstagramAction,
  disconnectInstagramAction,
  refreshInstagramTokenAction,
  resubscribeInstagramAction,
  saveInstagramAppAction,
} = await import("@/app/(dashboard)/settings/actions");

const ORIGINAL_IG_SECRET = process.env.INSTAGRAM_APP_SECRET;
const ORIGINAL_META_SECRET = process.env.META_APP_SECRET;
const IG_SECRET = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const FB_SECRET = "0123456789abcdef0123456789abcdef";

let graph: Awaited<ReturnType<typeof startMockGraph>>;
let db: Db;

beforeAll(async () => {
  graph = await startMockGraph();
});
afterAll(async () => {
  await graph.close();
});
beforeEach(async () => {
  // ทดสอบแบบที่เจ้าของร้านกรอก secret ในหน้าเว็บ (ไม่ได้ตั้งใน Railway)
  delete process.env.INSTAGRAM_APP_SECRET;
  db = await resetDatabase();
  graph.resetAll();
});
afterEach(() => {
  if (ORIGINAL_IG_SECRET === undefined) delete process.env.INSTAGRAM_APP_SECRET;
  else process.env.INSTAGRAM_APP_SECRET = ORIGINAL_IG_SECRET;
  if (ORIGINAL_META_SECRET === undefined) delete process.env.META_APP_SECRET;
  else process.env.META_APP_SECRET = ORIGINAL_META_SECRET;
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

describe("saveInstagramAppAction", () => {
  it("บันทึกครั้งแรกแต่เว้นว่าง → แจ้งที่ช่อง igAppSecret", async () => {
    const state = await saveInstagramAppAction({}, form({ igAppSecret: "  ", igMetaAppSecret: "" }));
    expect(state.field).toBe("igAppSecret");
    expect(state.error).toBeTruthy();
    expect((await getInstagramConfig(db)).appSecret).toBeNull();
  });

  it("รูปแบบไม่ถูกต้อง → แจ้งที่ช่องนั้น", async () => {
    expect((await saveInstagramAppAction({}, form({ igAppSecret: "short" }))).field).toBe("igAppSecret");
    const state = await saveInstagramAppAction({}, form({ igAppSecret: IG_SECRET, igMetaAppSecret: "มี ช่องว่าง" }));
    expect(state.field).toBe("igMetaAppSecret");
    expect((await getInstagramConfig(db)).appSecret).toBeNull();
  });

  it("วาง App Secret ของ Facebook มาผิดช่อง → บอกว่าต้องใช้ Instagram app secret", async () => {
    process.env.META_APP_SECRET = FB_SECRET;
    const state = await saveInstagramAppAction({}, form({ igAppSecret: FB_SECRET }));
    expect(state.field).toBe("igAppSecret");
    expect(state.error).toContain("App Secret ของ Facebook");
    expect((await getInstagramConfig(db)).appSecret).toBeNull();
  });

  it("ค่าถูกต้อง → บันทึก (เข้ารหัส) และอ่านกลับได้ / เว้นว่างครั้งถัดไป = ใช้ค่าเดิม", async () => {
    expect(await saveInstagramAppAction({}, form({ igAppSecret: IG_SECRET, igMetaAppSecret: "" }))).toEqual({ ok: true });
    expect(await getInstagramConfig(db)).toMatchObject({ appSecret: IG_SECRET, metaAppSecret: null, fromEnv: false });

    // ครั้งที่ 2: เว้น app secret ว่าง ใส่แค่ secret ของแอปแยก
    const meta = "f".repeat(32);
    expect(await saveInstagramAppAction({}, form({ igAppSecret: "", igMetaAppSecret: meta }))).toEqual({ ok: true });
    expect(await getInstagramConfig(db)).toMatchObject({ appSecret: IG_SECRET, metaAppSecret: meta });
  });

  it("ตั้งไว้ใน Railway (INSTAGRAM_APP_SECRET) → แก้ในหน้าเว็บไม่ได้", async () => {
    process.env.INSTAGRAM_APP_SECRET = "from-railway";
    const state = await saveInstagramAppAction({}, form({ igAppSecret: IG_SECRET }));
    expect(state.ok).toBeFalsy();
    expect(state.error).toContain("Railway");
    expect((await getInstagramConfig(db)).appSecret).toBe("from-railway");
  });
});

describe("connectInstagramAction", () => {
  it("token ของ Facebook (EAA…) → error ที่ช่อง token และไม่บันทึกอะไร", async () => {
    await saveInstagramApp(db, { appSecret: IG_SECRET });
    const state = await connectInstagramAction({}, form({ token: "EAAGm0PX4ZCpsBAxyz" }));
    expect(state).toMatchObject({ field: "token" });
    expect(state.error).toContain("EAA");
    expect(state.ok).toBeUndefined();
    expect(await db.select().from(instagramAccounts)).toHaveLength(0);
  });

  it("ยังไม่ได้ใส่ Instagram app secret → error ที่ช่อง appSecret", async () => {
    const state = await connectInstagramAction({}, form({ token: "IGAA_dashboard_token" }));
    expect(state.field).toBe("appSecret");
    expect(await db.select().from(instagramAccounts)).toHaveLength(0);
  });

  it("สำเร็จ → ข้อความมี @username, ส่งต่อข้อความแจ้งทั้งหมด และบอกชื่อเพจที่ผูกบัญชีเดียวกัน", async () => {
    await saveInstagramApp(db, { appSecret: IG_SECRET });
    // token ไม่ขึ้นต้นด้วย IG → มีข้อความแจ้งเพิ่ม (แต่ยังเชื่อมได้)
    const state = await connectInstagramAction({}, form({ token: ' "XYZ_dashboard_token" ' }));
    expect(state.ok).toBe(true);
    expect(state.error).toBeUndefined();
    expect(state.message).toContain("@test.shop");
    expect(state.subscribed).toBe(true);
    // เพจ PAGE1 ใน resetDatabase ผูก IG1 ไว้ → บัญชีเดียวกัน
    expect(state.linkedPage).toBe("ร้านทดสอบ");
    expect(state.notices).toEqual(
      expect.arrayContaining([expect.stringContaining("ไม่ได้ขึ้นต้นด้วย IG"), expect.stringContaining("บัญชีนี้ผูกกับเพจ ร้านทดสอบ")]),
    );
    const row = await db.query.instagramAccounts.findFirst({ where: eq(instagramAccounts.id, "IG1") });
    expect(row).toMatchObject({ username: "test.shop", subscribed: true });
  });
});

describe("ปุ่มจัดการบัญชี", () => {
  it("ยกเลิกการเชื่อมต่อ → ลบบัญชีออก", async () => {
    await seedInstagramAccount(db);
    await disconnectInstagramAction(form({ accountId: "IG1" }));
    expect(await db.select().from(instagramAccounts)).toHaveLength(0);
  });

  it("ต่ออายุ token ที่เพิ่งสร้าง (ไม่ถึง 24 ชม.) → แจ้งว่ายังต่อไม่ได้ โดยไม่เรียก Meta", async () => {
    await seedInstagramAccount(db);
    const state = await refreshInstagramTokenAction(form({ accountId: "IG1" }));
    expect(state.ok).toBeFalsy();
    expect(state.error).toContain("24 ชั่วโมง");
    expect(graph.calls).toHaveLength(0);
  });

  it("ต่ออายุ token ที่อายุเกิน 24 ชม. → สำเร็จ", async () => {
    await seedInstagramAccount(db, { tokenRefreshedAt: new Date(Date.now() - 25 * 60 * 60_000) });
    expect(await refreshInstagramTokenAction(form({ accountId: "IG1" }))).toEqual({ ok: true });
    expect(graph.calls.some((c) => c.rawPath === "/refresh_access_token")).toBe(true);
  });

  it("ลองใหม่ (subscribe webhook อีกครั้ง) → บัญชีกลับมาพร้อมใช้งาน", async () => {
    await seedInstagramAccount(db, { subscribed: false });
    expect(await resubscribeInstagramAction(form({ accountId: "IG1" }))).toEqual({ ok: true });
    const row = await db.query.instagramAccounts.findFirst({ where: eq(instagramAccounts.id, "IG1") });
    expect(row?.subscribed).toBe(true);
  });

  it("บัญชีถูกลบไปแล้ว → แจ้ง error แทนที่จะขึ้นว่าสำเร็จ", async () => {
    const state = await resubscribeInstagramAction(form({ accountId: "IG_GONE" }));
    expect(state.ok).toBeFalsy();
    expect(state.error).toContain("ไม่พบบัญชี");
  });
});
