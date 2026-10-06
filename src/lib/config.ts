import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { count, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { pages, rules, settings, webhookLogs } from "@/db/schema";
import { decrypt, encrypt, randomCode, safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";

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
  | "app_review_done";

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
    appSecret: process.env.META_APP_SECRET || tryDecrypt(s.get("meta_app_secret")),
    verifyToken,
    fromEnv: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
  };
}

/** บันทึก App ID / App Secret (ถ้าเว้น secret ว่างไว้ จะใช้ค่าเดิม) */
export async function saveMetaApp(db: Db, appId: string, appSecret: string): Promise<void> {
  await setSetting(db, "meta_app_id", appId);
  if (appSecret) await setSetting(db, "meta_app_secret", encrypt(appSecret, env.authSecret));
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
  ruleCount: number;
  appReviewDone: boolean;
}

export async function getSetupStatus(db: Db): Promise<SetupStatus> {
  const [s, meta, baseUrl, pageRows, lastLog, ruleRows] = await Promise.all([
    loadSettings(db),
    getMetaConfig(db),
    getPublicBaseUrl(db),
    db.select({ total: count(), subscribed: sql<number>`count(*) FILTER (WHERE ${pages.subscribed})::int` }).from(pages),
    db.select({ at: webhookLogs.receivedAt }).from(webhookLogs).orderBy(desc(webhookLogs.id)).limit(1),
    db.select({ n: count() }).from(rules),
  ]);
  return {
    baseUrl,
    meta,
    webhookVerifiedAt: s.get("webhook_verified_at") ?? null,
    pagesConnected: Number(pageRows[0]?.total ?? 0),
    pagesSubscribed: Number(pageRows[0]?.subscribed ?? 0),
    lastWebhookAt: lastLog[0]?.at ?? null,
    ruleCount: Number(ruleRows[0]?.n ?? 0),
    appReviewDone: s.get("app_review_done") === "1",
  };
}

/** ขั้นตอนที่จำเป็นก่อนใช้งานได้ (ไม่รวม App Review ซึ่งรอ Meta นาน) */
export function setupProgress(status: SetupStatus): { done: number; total: number } {
  const steps = [
    Boolean(status.baseUrl),
    Boolean(status.meta.appId && status.meta.appSecret),
    Boolean(status.webhookVerifiedAt),
    status.pagesSubscribed > 0,
    Boolean(status.lastWebhookAt),
    status.ruleCount > 0,
  ];
  return { done: steps.filter(Boolean).length, total: steps.length };
}
