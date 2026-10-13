import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { events, instagramAccounts, pages, settings, webhookLogs } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import {
  getInstagramConfig,
  getMetaConfig,
  getPublicBaseUrl,
  getSetupStatus,
  getWebhookSecrets,
  isPasswordSet,
  markInstagramWebhookBadSignature,
  markInstagramWebhookVerified,
  markWebhookBadSignature,
  rememberBaseUrlFromHeaders,
  saveInstagramApp,
  saveMetaApp,
  setPassword,
  setupProgress,
  verifyPassword,
} from "@/lib/config";
import { getAuthSecret } from "@/lib/env";
import { INSTAGRAM_ERRORS } from "@/lib/instagram/accounts";
import { listConnectedPages } from "@/lib/pages";
import { drainQueue } from "@/lib/queue/worker";
import { GET as verifyWebhook, POST as receiveWebhook } from "@/app/api/webhooks/meta/route";
import { POST as receiveInstagram } from "@/app/api/webhooks/instagram/route";
import { createRule, resetDatabase, seedInstagramAccount, signedPost, startMockGraph } from "./helpers";
import { fbComment, igDm } from "./fixtures";

// เทสนี้จำลองผู้ใช้ทั่วไปที่ไม่ได้ตั้ง environment variable ของ Meta เลย (ตั้งทุกอย่างผ่านหน้าเว็บ)
const OVERRIDES = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_VERIFY_TOKEN",
  "ADMIN_PASSWORD",
  "PUBLIC_BASE_URL",
  "RAILWAY_PUBLIC_DOMAIN",
  "INSTAGRAM_APP_SECRET",
  "INSTAGRAM_META_APP_SECRET",
];
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
  it("Meta ส่งข้อมูลมาแต่ App Secret ไม่ตรง → เตือน แล้วหายเมื่อใส่ App Secret ใหม่หรือรับข้อมูลได้ตามปกติ", async () => {
    await saveMetaApp(db, "1234567890", "secret-old");
    // ข้อมูลจริงของเพจที่เชื่อมไว้ (PAGE1) แต่ลงลายเซ็นด้วย App Secret ตัวใหม่ที่ระบบยังไม่รู้
    const res = await receiveWebhook(
      signedPost("https://dm.example.com/api/webhooks/meta", JSON.stringify(fbComment({ commentId: "SIG0" })), "secret-reset"),
    );
    expect(res.status).toBe(401);
    expect((await getSetupStatus(db)).badSignatureAt).not.toBeNull();

    await saveMetaApp(db, "1234567890", "secret-new");
    expect((await getSetupStatus(db)).badSignatureAt).toBeNull();

    await markWebhookBadSignature(db);
    await new Promise((r) => setTimeout(r, 20));
    await ingestWebhook(db, fbComment({ commentId: "SIG1" }));
    expect((await getSetupStatus(db)).badSignatureAt).toBeNull();
  });

  it("request มั่วๆ ที่ไม่น่าใช่ Meta (ไม่มีลายเซ็น / ลายเซ็นผิดรูปแบบ / ไม่ใช่เพจที่เชื่อมไว้) → 401 แต่ไม่ขึ้นคำเตือน", async () => {
    await saveMetaApp(db, "1234567890", "secret-ok");
    const post = (body: string, signature?: string) =>
      receiveWebhook(
        new NextRequest("https://dm.example.com/api/webhooks/meta", {
          method: "POST",
          body,
          headers: signature ? { "x-hub-signature-256": signature } : {},
        }),
      );
    expect((await post("hello")).status).toBe(401);
    expect((await post("{}", "sha256=deadbeef")).status).toBe(401);
    expect((await post(JSON.stringify(fbComment()), `sha256=${"a".repeat(63)}`)).status).toBe(401);
    // ลายเซ็นรูปแบบถูกแต่ไม่ใช่ JSON ของ Meta / เป็นเพจที่ไม่ได้เชื่อม
    const wrong = (body: string) => signedPost("https://dm.example.com/api/webhooks/meta", body, "attacker");
    expect((await receiveWebhook(wrong("hello"))).status).toBe(401);
    expect((await receiveWebhook(wrong(JSON.stringify({ object: "user", entry: [{ id: "PAGE1" }] })))).status).toBe(401);
    const otherPage = JSON.parse(JSON.stringify(fbComment())) as { entry: { id: string }[] };
    otherPage.entry[0].id = "SOMEONE_ELSES_PAGE";
    expect((await receiveWebhook(wrong(JSON.stringify(otherPage)))).status).toBe(401);
    expect((await getSetupStatus(db)).badSignatureAt).toBeNull();
    expect(await db.select().from(webhookLogs)).toHaveLength(0);
  });

  it("ข้อมูลที่มาทาง Instagram Login ไม่ลบคำเตือน App Secret ของ Facebook", async () => {
    await saveMetaApp(db, "1234567890", "fb-secret-old");
    await saveInstagramApp(db, { appSecret: "ig-secret" });
    await seedInstagramAccount(db);
    const fbRes = await receiveWebhook(
      signedPost("https://dm.example.com/api/webhooks/meta", JSON.stringify(fbComment()), "fb-secret-reset"),
    );
    expect(fbRes.status).toBe(401);
    expect((await getSetupStatus(db)).badSignatureAt).not.toBeNull();

    await new Promise((r) => setTimeout(r, 20));
    const igRes = await receiveInstagram(
      signedPost("https://dm.example.com/api/webhooks/instagram", JSON.stringify(igDm()), "ig-secret"),
    );
    expect(igRes.status).toBe(200);
    const status = await getSetupStatus(db);
    expect(status.lastWebhookAt).not.toBeNull();
    expect(status.instagram.lastWebhookAt).not.toBeNull();
    expect(status.badSignatureAt).not.toBeNull();

    // ข้อมูลที่ลงลายเซ็นด้วย App Secret ของ Facebook มาถึงหลังจากนั้น → คำเตือนหาย
    await new Promise((r) => setTimeout(r, 20));
    await ingestWebhook(db, fbComment({ commentId: "FBOK" }), { via: "facebook_login" });
    expect((await getSetupStatus(db)).badSignatureAt).toBeNull();
  });

  it("นับขั้นที่เสร็จแล้ว", async () => {
    await db.delete(pages);
    expect(setupProgress(await getSetupStatus(db))).toEqual({ done: 0, total: 6 });
    process.env.RAILWAY_PUBLIC_DOMAIN = "auto.up.railway.app";
    await saveMetaApp(db, "1234567890", "0123456789abcdef0123456789abcdef");
    await createRule();
    expect(setupProgress(await getSetupStatus(db)).done).toBe(3);
  });
});

describe("Instagram App (Instagram Login)", () => {
  const FB_SECRET = "0123456789abcdef0123456789abcdef";
  const IG_SECRET = "IgAppSecret0123456789abcdef";
  const IG_META_SECRET = "IgBasicSecret0123456789abcd";

  it("เก็บ secret แบบเข้ารหัส เว้นว่างเพื่อใช้ค่าเดิม และ env มาก่อน", async () => {
    expect(await getInstagramConfig(db)).toEqual({ appSecret: null, metaAppSecret: null, fromEnv: false });

    await saveInstagramApp(db, { appSecret: IG_SECRET, metaAppSecret: IG_META_SECRET });
    const rows = await db.select().from(settings);
    expect(rows.find((r) => r.key === "instagram_app_secret")?.value).not.toContain(IG_SECRET);
    expect(rows.find((r) => r.key === "instagram_meta_app_secret")?.value).not.toContain(IG_META_SECRET);

    await saveInstagramApp(db, { appSecret: "", metaAppSecret: "   " });
    await saveInstagramApp(db, {});
    expect(await getInstagramConfig(db)).toEqual({ appSecret: IG_SECRET, metaAppSecret: IG_META_SECRET, fromEnv: false });

    await saveInstagramApp(db, { metaAppSecret: "IgBasicSecretNEW456789abcd" });
    expect(await getInstagramConfig(db)).toMatchObject({ appSecret: IG_SECRET, metaAppSecret: "IgBasicSecretNEW456789abcd" });

    process.env.INSTAGRAM_APP_SECRET = "from-env-ig-secret";
    process.env.INSTAGRAM_META_APP_SECRET = "from-env-ig-basic";
    expect(await getInstagramConfig(db)).toEqual({
      appSecret: "from-env-ig-secret",
      metaAppSecret: "from-env-ig-basic",
      fromEnv: true,
    });
    expect((await getSetupStatus(db)).instagram).toMatchObject({ appSecretSet: true, fromEnv: true });
  });

  it("secret สำหรับตรวจลายเซ็น webhook: FB → Instagram app secret → App secret ของแอป IG และไม่ซ้ำ", async () => {
    expect(await getWebhookSecrets(db)).toEqual([]);

    await saveInstagramApp(db, { appSecret: IG_SECRET });
    expect(await getWebhookSecrets(db)).toEqual([{ secret: IG_SECRET, via: "instagram_login" }]);

    await saveMetaApp(db, "1234567890", FB_SECRET);
    await saveInstagramApp(db, { metaAppSecret: IG_META_SECRET });
    expect(await getWebhookSecrets(db)).toEqual([
      { secret: FB_SECRET, via: "facebook_login" },
      { secret: IG_SECRET, via: "instagram_login" },
      { secret: IG_META_SECRET, via: "instagram_login" },
    ]);

    // ใช้แอปเดียวกัน: App secret (Basic) ของแอป IG = App Secret ของ Facebook → เหลือรายการเดียวแบบ facebook_login
    await saveInstagramApp(db, { metaAppSecret: FB_SECRET });
    expect(await getWebhookSecrets(db)).toEqual([
      { secret: FB_SECRET, via: "facebook_login" },
      { secret: IG_SECRET, via: "instagram_login" },
    ]);

    // env ของ Facebook มาก่อนค่าที่บันทึกไว้
    process.env.META_APP_SECRET = "env-fb-secret";
    expect((await getWebhookSecrets(db))[0]).toEqual({ secret: "env-fb-secret", via: "facebook_login" });
  });

  it("Verify และคำเตือนลายเซ็นไม่ตรง แยกจากของ Facebook — บันทึก secret ใหม่แล้วคำเตือนหาย", async () => {
    await markInstagramWebhookVerified(db);
    await markInstagramWebhookBadSignature(db);
    let status = await getSetupStatus(db);
    expect(status.instagram.webhookVerifiedAt).not.toBeNull();
    expect(status.instagram.badSignatureAt).not.toBeNull();
    expect(status.webhookVerifiedAt).toBeNull();
    expect(status.badSignatureAt).toBeNull();

    await saveInstagramApp(db, { appSecret: "" });
    expect((await getSetupStatus(db)).instagram.badSignatureAt).not.toBeNull();
    await saveInstagramApp(db, { appSecret: IG_SECRET });
    status = await getSetupStatus(db);
    expect(status.instagram.badSignatureAt).toBeNull();
    expect(status.instagram.webhookVerifiedAt).not.toBeNull();

    // บันทึก secret ของ Facebook ไม่ล้างคำเตือนของ Instagram
    await markInstagramWebhookBadSignature(db);
    await saveMetaApp(db, "1234567890", FB_SECRET);
    expect((await getSetupStatus(db)).instagram.badSignatureAt).not.toBeNull();
    await saveInstagramApp(db, { metaAppSecret: IG_META_SECRET });
    expect((await getSetupStatus(db)).instagram.badSignatureAt).toBeNull();
  });

  it("webhook ล่าสุดของ Instagram นับเฉพาะที่มาทาง Instagram Login และคำเตือนลายเซ็นหายเมื่อรับข้อมูลได้", async () => {
    await markInstagramWebhookBadSignature(db);
    await new Promise((r) => setTimeout(r, 20));
    await db.insert(webhookLogs).values({ object: "instagram", source: "facebook_login", body: {} });
    await db.insert(webhookLogs).values({ object: "instagram", body: {} }); // แถวเก่า (source = null)
    let status = await getSetupStatus(db);
    expect(status.lastWebhookAt).not.toBeNull();
    expect(status.instagram.lastWebhookAt).toBeNull();
    expect(status.instagram.badSignatureAt).not.toBeNull();

    await db.insert(webhookLogs).values({ object: "instagram", source: "instagram_login", body: {} });
    const [latest] = await db.insert(webhookLogs).values({ object: "instagram", source: "instagram_login", body: {} }).returning();
    await db.insert(webhookLogs).values({ object: "page", source: "facebook_login", body: {} });
    status = await getSetupStatus(db);
    expect(status.instagram.lastWebhookAt?.getTime()).toBe(latest.receivedAt.getTime());
    expect(status.instagram.badSignatureAt).toBeNull();

    // ลายเซ็นไม่ตรงอีกครั้งหลังจากรับข้อมูลล่าสุด → เตือนอีก
    await new Promise((r) => setTimeout(r, 20));
    await markInstagramWebhookBadSignature(db);
    expect((await getSetupStatus(db)).instagram.badSignatureAt).not.toBeNull();
  });

  it("นับบัญชี / บัญชีที่รับ webhook และเตือน token ที่ใกล้หมดหรือหมดอายุ", async () => {
    expect((await getSetupStatus(db)).instagram).toEqual({
      appSecretSet: false,
      fromEnv: false,
      accounts: 0,
      subscribed: 0,
      webhookVerifiedAt: null,
      lastWebhookAt: null,
      badSignatureAt: null,
      tokenWarning: null,
    });

    const day = 24 * 60 * 60_000;
    await seedInstagramAccount(db);
    await seedInstagramAccount(db, { id: "IG2", appScopedId: "APPSCOPED2", username: "second.shop", subscribed: false });
    let ig = (await getSetupStatus(db)).instagram;
    expect(ig).toMatchObject({ accounts: 2, subscribed: 1, tokenWarning: null });

    await db
      .update(instagramAccounts)
      .set({ tokenExpiresAt: new Date(Date.now() + 3 * day) })
      .where(eq(instagramAccounts.id, "IG2"));
    ig = (await getSetupStatus(db)).instagram;
    expect(ig.tokenWarning).toBe("expiring");

    await db
      .update(instagramAccounts)
      .set({ tokenExpiresAt: new Date(Date.now() - day) })
      .where(eq(instagramAccounts.id, "IG1"));
    ig = (await getSetupStatus(db)).instagram;
    expect(ig.tokenWarning).toBe("expired");
  });

  it("บัญชีที่ token หมดอายุหรือถูก Meta ปฏิเสธ ไม่นับว่าพร้อมใช้งาน (ขั้นที่ 4)", async () => {
    await db.delete(pages);
    await seedInstagramAccount(db);
    expect((await getSetupStatus(db)).instagram).toMatchObject({ accounts: 1, subscribed: 1 });

    await db
      .update(instagramAccounts)
      .set({ tokenExpiresAt: new Date(Date.now() - 60_000) })
      .where(eq(instagramAccounts.id, "IG1"));
    let status = await getSetupStatus(db);
    expect(status.instagram).toMatchObject({ accounts: 1, subscribed: 0, tokenWarning: "expired" });
    expect(setupProgress(status).done).toBe(0);

    await db
      .update(instagramAccounts)
      .set({ tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000), lastError: INSTAGRAM_ERRORS.tokenRejected })
      .where(eq(instagramAccounts.id, "IG1"));
    expect((await getSetupStatus(db)).instagram.subscribed).toBe(0);

    // ต่ออายุไม่สำเร็จชั่วคราว: token ยังใช้ได้ → ยังนับว่าพร้อม
    await db
      .update(instagramAccounts)
      .set({ lastError: `${INSTAGRAM_ERRORS.refreshPrefix}: mock` })
      .where(eq(instagramAccounts.id, "IG1"));
    status = await getSetupStatus(db);
    expect(status.instagram.subscribed).toBe(1);
    expect(setupProgress(status).done).toBe(1);
  });

  it("ขั้นที่ 4 ผ่านได้ด้วยบัญชี Instagram อย่างเดียว (ไม่มีเพจ Facebook)", async () => {
    await db.delete(pages);
    expect(setupProgress(await getSetupStatus(db))).toEqual({ done: 0, total: 6 });
    await seedInstagramAccount(db, { subscribed: false });
    expect(setupProgress(await getSetupStatus(db)).done).toBe(0);
    await seedInstagramAccount(db);
    const status = await getSetupStatus(db);
    expect(status.pagesSubscribed).toBe(0);
    expect(setupProgress(status)).toEqual({ done: 1, total: 6 });
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
