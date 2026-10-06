import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { events, pages, settings } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import {
  getMetaConfig,
  getPublicBaseUrl,
  getSetupStatus,
  isPasswordSet,
  rememberBaseUrlFromHeaders,
  saveMetaApp,
  setPassword,
  setupProgress,
  verifyPassword,
} from "@/lib/config";
import { getAuthSecret } from "@/lib/env";
import { listConnectedPages } from "@/lib/pages";
import { drainQueue } from "@/lib/queue/worker";
import { GET as verifyWebhook } from "@/app/api/webhooks/meta/route";
import { createRule, resetDatabase, startMockGraph } from "./helpers";
import { fbComment } from "./fixtures";

// เทสนี้จำลองผู้ใช้ทั่วไปที่ไม่ได้ตั้ง environment variable ของ Meta เลย (ตั้งทุกอย่างผ่านหน้าเว็บ)
const OVERRIDES = ["META_APP_ID", "META_APP_SECRET", "META_VERIFY_TOKEN", "ADMIN_PASSWORD", "PUBLIC_BASE_URL", "RAILWAY_PUBLIC_DOMAIN"];
const saved: Record<string, string | undefined> = {};

let db: Db;
let graph: Awaited<ReturnType<typeof startMockGraph>>;

beforeAll(async () => {
  graph = await startMockGraph();
});
afterAll(async () => {
  await graph.close();
});
beforeEach(async () => {
  db = await resetDatabase();
  for (const key of OVERRIDES) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of OVERRIDES) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("รหัสผ่าน", () => {
  it("ตั้งครั้งแรกแล้วตรวจได้ และเก็บแบบ hash", async () => {
    expect(await isPasswordSet(db)).toBe(false);
    await setPassword(db, "รหัสลับ1234");
    expect(await isPasswordSet(db)).toBe(true);
    expect(await verifyPassword(db, "รหัสลับ1234")).toBe(true);
    expect(await verifyPassword(db, "wrong-password")).toBe(false);
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "admin_password_hash") });
    expect(row?.value).toMatch(/^scrypt\$/);
    expect(row?.value).not.toContain("รหัสลับ1234");
  });

  it("ถ้าตั้ง ADMIN_PASSWORD ไว้ใช้ค่านั้นแทน", async () => {
    process.env.ADMIN_PASSWORD = "from-env";
    expect(await isPasswordSet(db)).toBe(true);
    expect(await verifyPassword(db, "from-env")).toBe(true);
  });
});

describe("Meta App", () => {
  it("สร้าง verify token ให้อัตโนมัติและใช้ค่าเดิมทุกครั้ง", async () => {
    const first = await getMetaConfig(db);
    expect(first.verifyToken).toMatch(/^dm-[A-Za-z0-9]{24}$/);
    expect((await getMetaConfig(db)).verifyToken).toBe(first.verifyToken);
    expect(first.appId).toBeNull();
    expect(first.appSecret).toBeNull();
  });

  it("เก็บ App Secret แบบเข้ารหัส และเว้นว่างเพื่อใช้ค่าเดิมได้", async () => {
    await saveMetaApp(db, "1234567890", "0123456789abcdef0123456789abcdef");
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "meta_app_secret") });
    expect(row?.value).not.toContain("0123456789abcdef");
    await saveMetaApp(db, "999", "");
    expect(await getMetaConfig(db)).toMatchObject({ appId: "999", appSecret: "0123456789abcdef0123456789abcdef", fromEnv: false });
  });

  it("Meta กด Verify สำเร็จ → บันทึกว่ายืนยันแล้ว", async () => {
    const { verifyToken } = await getMetaConfig(db);
    const res = await verifyWebhook(
      new NextRequest(`https://x/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=ok`),
    );
    expect(await res.text()).toBe("ok");
    expect((await getSetupStatus(db)).webhookVerifiedAt).not.toBeNull();
  });
});

describe("URL ของระบบ", () => {
  it("ใช้ PUBLIC_BASE_URL → โดเมนของ Railway → ค่าที่จำจาก request ตามลำดับ", async () => {
    expect(await getPublicBaseUrl(db)).toBeNull();
    await rememberBaseUrlFromHeaders(db, new Headers({ host: "dm.up.railway.app", "x-forwarded-proto": "https" }));
    expect(await getPublicBaseUrl(db)).toBe("https://dm.up.railway.app");
    process.env.RAILWAY_PUBLIC_DOMAIN = "auto.up.railway.app";
    expect(await getPublicBaseUrl(db)).toBe("https://auto.up.railway.app");
    process.env.PUBLIC_BASE_URL = "https://custom.example.com/";
    expect(await getPublicBaseUrl(db)).toBe("https://custom.example.com");
  });
});

describe("สถานะคู่มือตั้งค่า", () => {
  it("นับขั้นที่เสร็จแล้ว", async () => {
    await db.delete(pages);
    expect(setupProgress(await getSetupStatus(db))).toEqual({ done: 0, total: 6 });
    process.env.RAILWAY_PUBLIC_DOMAIN = "auto.up.railway.app";
    await saveMetaApp(db, "1234567890", "0123456789abcdef0123456789abcdef");
    await createRule();
    expect(setupProgress(await getSetupStatus(db)).done).toBe(3);
  });
});

describe("กุญแจลับของระบบ", () => {
  it("ไม่ต้องตั้ง AUTH_SECRET: สร้างจาก DATABASE_URL ได้คงที่", () => {
    const original = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    try {
      const a = getAuthSecret();
      expect(a).toMatch(/^[a-f0-9]{64}$/);
      expect(getAuthSecret()).toBe(a);
    } finally {
      process.env.AUTH_SECRET = original;
    }
  });

  it("token ของเพจถอดรหัสไม่ได้ → แจ้งให้เชื่อมต่อใหม่ในหน้ากิจกรรม", async () => {
    process.env.META_APP_SECRET = "test-app-secret";
    await db.update(pages).set({ accessToken: "v1.broken.broken.broken" });
    expect((await listConnectedPages(db))[0].token).toBeNull();
    await createRule();
    await ingestWebhook(db, fbComment());
    await drainQueue(db);
    const failed = await db.select().from(events).where(eq(events.type, "dm_failed"));
    expect(failed).toHaveLength(1);
    expect(JSON.stringify(failed[0].meta)).toContain("เชื่อมต่อเพจใหม่");
    expect(graph.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });
});
