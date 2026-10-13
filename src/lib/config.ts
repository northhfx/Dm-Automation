import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { count, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { pages, rules, settings, webhookLogs, type WebhookVia } from "@/db/schema";
import { decrypt, encrypt, randomCode, safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { INSTAGRAM_TOKEN_WARN_MS, isInstagramAccountUsable, listInstagramAccounts } from "@/lib/instagram/accounts";

/**
 * ค่าตั้งค่าที่ผู้ใช้กรอกผ่านหน้าเว็บ เก็บในตาราง settings
 * ถ้ามี environment variable ชื่อเดียวกันจะใช้ค่านั้นก่อน (สำหรับคนที่อยากตั้งผ่าน Railway)
 */

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

type SettingKey =
  | "admin_password_hash"
  | "meta_app_id"
  | "meta_app_secret"
  | "meta_verify_token"
  | "public_base_url"
  | "webhook_verified_at"
  | "webhook_bad_signature_at"
  | "app_review_done"
  | "instagram_app_secret"
  | "instagram_meta_app_secret"
  | "instagram_webhook_verified_at"
  | "instagram_webhook_bad_signature_at";

async function loadSettings(db: Db): Promise<Map<string, string>> {
  const rows = await db.select().from(settings);
  return new Map(rows.map((r) => [r.key, r.value]));
}

async function setSetting(db: Db, key: SettingKey, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

async function deleteSetting(db: Db, key: SettingKey): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}

function tryDecrypt(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decrypt(value, env.authSecret);
  } catch {
    return null;
  }
}

// ---------------- รหัสผ่านเข้าแดชบอร์ด ----------------

export async function isPasswordSet(db: Db): Promise<boolean> {
  if (process.env.ADMIN_PASSWORD) return true;
  return (await loadSettings(db)).has("admin_password_hash");
}

export async function setPassword(db: Db, password: string): Promise<void> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  await setSetting(db, "admin_password_hash", `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`);
}

export async function verifyPassword(db: Db, password: string): Promise<boolean> {
  if (process.env.ADMIN_PASSWORD) return safeEqual(password, process.env.ADMIN_PASSWORD);
  const stored = (await loadSettings(db)).get("admin_password_hash");
  if (!stored) return false;
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

// ---------------- Meta App ----------------

export interface MetaConfig {
  appId: string | null;
  appSecret: string | null;
  verifyToken: string;
  /** ค่ามาจาก environment variable (แก้ในหน้าเว็บไม่ได้) */
  fromEnv: boolean;
}

export async function getMetaConfig(db: Db): Promise<MetaConfig> {
  const s = await loadSettings(db);
  let verifyToken = process.env.META_VERIFY_TOKEN || s.get("meta_verify_token");
  if (!verifyToken) {
    // สร้างให้อัตโนมัติ ผู้ใช้แค่คัดลอกไปวางใน Meta
    verifyToken = `dm-${randomCode(24)}`;
    await db.insert(settings).values({ key: "meta_verify_token", value: verifyToken }).onConflictDoNothing();
    verifyToken = (await loadSettings(db)).get("meta_verify_token") ?? verifyToken;
  }
  return {
    appId: process.env.META_APP_ID || s.get("meta_app_id") || null,
    appSecret: facebookAppSecret(s),
    verifyToken,
    fromEnv: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
  };
}

function facebookAppSecret(s: Map<string, string>): string | null {
  return process.env.META_APP_SECRET || tryDecrypt(s.get("meta_app_secret"));
}

/** บันทึก App ID / App Secret (ถ้าเว้น secret ว่างไว้ จะใช้ค่าเดิม) */
export async function saveMetaApp(db: Db, appId: string, appSecret: string): Promise<void> {
  await setSetting(db, "meta_app_id", appId);
  if (appSecret) {
    await setSetting(db, "meta_app_secret", encrypt(appSecret, env.authSecret));
    // ใส่ App Secret ใหม่แล้ว → ล้างคำเตือน "ลายเซ็นไม่ตรง" รอดูข้อมูลชุดถัดไป
    await deleteSetting(db, "webhook_bad_signature_at");
  }
}

// ---------------- Instagram Login ----------------

export interface InstagramConfig {
  /** Instagram app secret จากหน้า API setup with Instagram login (ใช้แลก token และตรวจลายเซ็น webhook) */
  appSecret: string | null;
  /** Basic secret ของแอป IG ที่แยก (App settings → Basic) — ไม่บังคับ ใช้ตรวจลายเซ็น webhook เท่านั้น */
  metaAppSecret: string | null;
  /** ค่ามาจาก environment variable INSTAGRAM_APP_SECRET (แก้ในหน้าเว็บไม่ได้) */
  fromEnv: boolean;
}

function instagramConfigFrom(s: Map<string, string>): InstagramConfig {
  return {
    appSecret: process.env.INSTAGRAM_APP_SECRET || tryDecrypt(s.get("instagram_app_secret")),
    metaAppSecret: process.env.INSTAGRAM_META_APP_SECRET || tryDecrypt(s.get("instagram_meta_app_secret")),
    fromEnv: Boolean(process.env.INSTAGRAM_APP_SECRET),
  };
}

export async function getInstagramConfig(db: Db): Promise<InstagramConfig> {
  return instagramConfigFrom(await loadSettings(db));
}

/** ค่าว่าง/undefined = คงค่าเดิม; บันทึก secret ใดก็ตาม → ลบ instagram_webhook_bad_signature_at */
export async function saveInstagramApp(db: Db, data: { appSecret?: string; metaAppSecret?: string }): Promise<void> {
  const appSecret = data.appSecret?.trim();
  const metaAppSecret = data.metaAppSecret?.trim();
  if (appSecret) await setSetting(db, "instagram_app_secret", encrypt(appSecret, env.authSecret));
  if (metaAppSecret) await setSetting(db, "instagram_meta_app_secret", encrypt(metaAppSecret, env.authSecret));
  // ใส่ secret ใหม่แล้ว → ล้างคำเตือน "ลายเซ็นไม่ตรง" รอดูข้อมูลชุดถัดไป
  if (appSecret || metaAppSecret) await deleteSetting(db, "instagram_webhook_bad_signature_at");
}

export interface WebhookSecret {
  secret: string;
  /** ลายเซ็นตรงกับ secret นี้ = webhook มาทางไหน */
  via: WebhookVia;
}

/**
 * secret ทั้งหมดที่ใช้ตรวจลายเซ็น webhook (Meta ใช้ secret ตัวไหนลงลายเซ็นยังไม่แน่ชัด จึงลองทุกตัว)
 * ลำดับ: FB App Secret (facebook_login) → Instagram app secret → Instagram meta app secret (instagram_login);
 * ข้ามค่า null และค่าที่ซ้ำกับรายการก่อนหน้า
 */
export async function getWebhookSecrets(db: Db): Promise<WebhookSecret[]> {
  const s = await loadSettings(db);
  const ig = instagramConfigFrom(s);
  const candidates: { secret: string | null; via: WebhookVia }[] = [
    { secret: facebookAppSecret(s), via: "facebook_login" },
    { secret: ig.appSecret, via: "instagram_login" },
    { secret: ig.metaAppSecret, via: "instagram_login" },
  ];
  const out: WebhookSecret[] = [];
  for (const c of candidates) {
    if (!c.secret || out.some((o) => o.secret === c.secret)) continue;
    out.push({ secret: c.secret, via: c.via });
  }
  return out;
}

// ---------------- URL ของระบบ ----------------

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** URL สาธารณะของระบบ ใช้ทำลิงก์ติดตามและ Callback URL — บน Railway หาได้เองอัตโนมัติ */
export async function getPublicBaseUrl(db: Db): Promise<string | null> {
  if (process.env.PUBLIC_BASE_URL) return normalizeUrl(process.env.PUBLIC_BASE_URL);
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  const saved = (await loadSettings(db)).get("public_base_url");
  return saved ? normalizeUrl(saved) : null;
}

export async function savePublicBaseUrl(db: Db, url: string): Promise<void> {
  await setSetting(db, "public_base_url", normalizeUrl(url));
}

/** จำ URL จาก request ครั้งแรก (กรณีไม่ได้รันบน Railway และไม่ได้ตั้ง PUBLIC_BASE_URL) */
export async function rememberBaseUrlFromHeaders(db: Db, headers: Headers): Promise<void> {
  if (await getPublicBaseUrl(db)) return;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return;
  const proto = headers.get("x-forwarded-proto")?.split(",")[0] ?? (host.startsWith("localhost") ? "http" : "https");
  await savePublicBaseUrl(db, `${proto}://${host}`);
}

// ---------------- สถานะการตั้งค่า (ใช้ในหน้าคู่มือ) ----------------

export async function markWebhookVerified(db: Db): Promise<void> {
  await setSetting(db, "webhook_verified_at", new Date().toISOString());
}

/**
 * Meta ส่งข้อมูลมาแต่ลายเซ็นไม่ตรงกับ App Secret ที่บันทึกไว้ (เช่น กดรีเซ็ต App Secret ใน Meta หลังบันทึกในระบบ)
 * จำเวลาไว้เพื่อแสดงคำเตือนในหน้าคู่มือ/ตั้งค่า — ไม่งั้นผู้ใช้จะเห็นแค่ว่า "ไม่มีอะไรเกิดขึ้น"
 */
export async function markWebhookBadSignature(db: Db): Promise<void> {
  await setSetting(db, "webhook_bad_signature_at", new Date().toISOString());
}

/** Meta กด Verify ที่ Callback URL ของ Instagram Login (/api/webhooks/instagram) สำเร็จ */
export async function markInstagramWebhookVerified(db: Db): Promise<void> {
  await setSetting(db, "instagram_webhook_verified_at", new Date().toISOString());
}

/** มีข้อมูลส่งมาที่ /api/webhooks/instagram แต่ลายเซ็นไม่ตรงกับ secret ใดเลย */
export async function markInstagramWebhookBadSignature(db: Db): Promise<void> {
  await setSetting(db, "instagram_webhook_bad_signature_at", new Date().toISOString());
}

export async function setAppReviewDone(db: Db, done: boolean): Promise<void> {
  if (done) await setSetting(db, "app_review_done", "1");
  else await deleteSetting(db, "app_review_done");
}

export interface SetupStatus {
  baseUrl: string | null;
  meta: MetaConfig;
  webhookVerifiedAt: string | null;
  pagesConnected: number;
  pagesSubscribed: number;
  lastWebhookAt: Date | null;
  /**
   * ครั้งล่าสุดที่ Meta ส่งข้อมูลมาแต่ App Secret ของ Facebook ไม่ตรง
   * (null = ไม่มีปัญหา หรือรับข้อมูลที่ลงลายเซ็นด้วย App Secret ของ Facebook ได้ตามปกติหลังจากนั้นแล้ว)
   */
  badSignatureAt: string | null;
  ruleCount: number;
  appReviewDone: boolean;
  instagram: InstagramSetupStatus;
}

/** สถานะการเชื่อม Instagram ผ่าน Instagram Login */
export interface InstagramSetupStatus {
  appSecretSet: boolean;
  fromEnv: boolean;
  /** จำนวนบัญชีที่เชื่อมไว้ */
  accounts: number;
  /** จำนวนบัญชีที่ใช้งานได้จริง: subscribe webhook สำเร็จ และ token ยังใช้ได้ (ไม่หมดอายุ/ไม่ถูกปฏิเสธ) */
  subscribed: number;
  webhookVerifiedAt: string | null;
  /** webhook ล่าสุดที่มาทาง Instagram Login */
  lastWebhookAt: Date | null;
  /** ครั้งล่าสุดที่ /api/webhooks/instagram ได้ลายเซ็นที่ไม่ตรง (null = ไม่มีปัญหา หรือรับข้อมูลได้ตามปกติหลังจากนั้นแล้ว) */
  badSignatureAt: string | null;
  /** token ที่จะหมดอายุเร็วที่สุด: หมดแล้ว / เหลือไม่ถึง 7 วัน */
  tokenWarning: "expiring" | "expired" | null;
}

export async function getSetupStatus(db: Db): Promise<SetupStatus> {
  const [s, meta, baseUrl, pageRows, lastLog, lastFbLog, ruleRows, igAccounts, lastIgLog] = await Promise.all([
    loadSettings(db),
    getMetaConfig(db),
    getPublicBaseUrl(db),
    db.select({ total: count(), subscribed: sql<number>`count(*) FILTER (WHERE ${pages.subscribed})::int` }).from(pages),
    db.select({ at: webhookLogs.receivedAt }).from(webhookLogs).orderBy(desc(webhookLogs.id)).limit(1),
    // ข้อมูลที่ลงลายเซ็นด้วย App Secret ของ Facebook (แถวเก่าก่อนมี source ก็มาจากแอป Facebook ทั้งหมด)
    // — ข้อมูลที่มาทาง Instagram Login ไม่ได้แปลว่า App Secret ของ Facebook ถูกแล้ว
    db
      .select({ at: webhookLogs.receivedAt })
      .from(webhookLogs)
      .where(or(eq(webhookLogs.source, "facebook_login"), isNull(webhookLogs.source)))
      .orderBy(desc(webhookLogs.id))
      .limit(1),
    db.select({ n: count() }).from(rules),
    listInstagramAccounts(db),
    db
      .select({ at: webhookLogs.receivedAt })
      .from(webhookLogs)
      .where(eq(webhookLogs.source, "instagram_login"))
      .orderBy(desc(webhookLogs.id))
      .limit(1),
  ]);
  const ig = instagramConfigFrom(s);
  const igLastWebhookAt = lastIgLog[0]?.at ?? null;
  const now = new Date();
  const minExpiresAt = igAccounts.reduce<Date | null>(
    (min, a) => (!min || a.tokenExpiresAt < min ? a.tokenExpiresAt : min),
    null,
  );
  return {
    baseUrl,
    meta,
    webhookVerifiedAt: s.get("webhook_verified_at") ?? null,
    pagesConnected: Number(pageRows[0]?.total ?? 0),
    pagesSubscribed: Number(pageRows[0]?.subscribed ?? 0),
    lastWebhookAt: lastLog[0]?.at ?? null,
    badSignatureAt: newerThan(s.get("webhook_bad_signature_at"), lastFbLog[0]?.at ?? null),
    ruleCount: Number(ruleRows[0]?.n ?? 0),
    appReviewDone: s.get("app_review_done") === "1",
    instagram: {
      appSecretSet: Boolean(ig.appSecret),
      fromEnv: ig.fromEnv,
      accounts: igAccounts.length,
      subscribed: igAccounts.filter((a) => isInstagramAccountUsable(a, now)).length,
      webhookVerifiedAt: s.get("instagram_webhook_verified_at") ?? null,
      lastWebhookAt: igLastWebhookAt,
      badSignatureAt: newerThan(s.get("instagram_webhook_bad_signature_at"), igLastWebhookAt),
      tokenWarning: tokenWarning(minExpiresAt),
    },
  };
}

function tokenWarning(expiresAt: Date | null, now = Date.now()): InstagramSetupStatus["tokenWarning"] {
  if (!expiresAt) return null;
  if (expiresAt.getTime() < now) return "expired";
  if (expiresAt.getTime() < now + INSTAGRAM_TOKEN_WARN_MS) return "expiring";
  return null;
}

function newerThan(iso: string | undefined, other: Date | null): string | null {
  if (!iso) return null;
  return !other || new Date(iso).getTime() > other.getTime() ? iso : null;
}

/** ขั้นตอนที่จำเป็นก่อนใช้งานได้ (ไม่รวม App Review ซึ่งรอ Meta นาน) */
export function setupProgress(status: SetupStatus): { done: number; total: number } {
  const steps = [
    Boolean(status.baseUrl),
    Boolean(status.meta.appId && status.meta.appSecret),
    Boolean(status.webhookVerifiedAt),
    // เพจ Facebook หรือบัญชี Instagram (Instagram Login) อย่างใดอย่างหนึ่งพร้อมรับ webhook
    status.pagesSubscribed > 0 || status.instagram.subscribed > 0,
    Boolean(status.lastWebhookAt),
    status.ruleCount > 0,
  ];
  return { done: steps.filter(Boolean).length, total: steps.length };
}
