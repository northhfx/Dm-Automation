import { asc, eq, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { instagramAccounts, type InstagramAccountRow } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import type { LoginKind } from "@/lib/connections";

/**
 * บัญชี Instagram ที่เชื่อมผ่าน Instagram Login (ตาราง instagram_accounts)
 * ไฟล์นี้อ่าน/เขียนฐานข้อมูลอย่างเดียว ไม่เรียก Meta — การเชื่อมต่อ/ต่ออายุ token อยู่ใน connect.ts และ token.ts
 */

export interface InstagramAccount extends Omit<InstagramAccountRow, "accessToken"> {
  /** null = ถอดรหัสไม่ได้ (เช่น เปลี่ยนรหัสฐานข้อมูล/AUTH_SECRET) ต้องวาง token ใหม่ */
  token: string | null;
}

export interface SaveInstagramAccountInput {
  /** /me user_id (ใช้ส่งข้อความและจับคู่ webhook) */
  id: string;
  /** /me id (app-scoped) เก็บไว้จับคู่ webhook เท่านั้น */
  appScopedId: string | null;
  username: string;
  name: string | null;
  accountType: string | null;
  token: string;
  tokenExpiresAt: Date;
  /** true = Meta ไม่ได้บอกวันหมดอายุ (ประมาณเอาว่า 60 วัน) */
  tokenExpiryEstimated: boolean;
}

/** token แบบ long-lived ของ Instagram ใช้ได้ 60 วัน */
export const INSTAGRAM_TOKEN_TTL_MS = 60 * 24 * 60 * 60_000;
/** เหลือน้อยกว่านี้ถือว่า "ใกล้หมดอายุ" */
export const INSTAGRAM_TOKEN_WARN_MS = 7 * 24 * 60 * 60_000;

/**
 * ข้อความ lastError ของบัญชี — ตัวที่บันทึก (handlers, token.ts, connect.ts) กับหน้าที่แสดงสถานะใช้ชุดเดียวกัน
 * หน้าเว็บจึงแยกได้ว่า "ต้องวาง token ใหม่" หรือ "ปัญหาชั่วคราว ระบบลองใหม่เอง"
 */
export const INSTAGRAM_ERRORS = {
  /** Meta ไม่รับ token แล้ว (code 190) ตอนส่งข้อความ/ดึงข้อมูล */
  tokenRejected: "token ของ Instagram ใช้ไม่ได้ — ไปที่ ตั้งค่า → บัญชี Instagram แล้ววาง token ใหม่",
  /** ต่ออายุไม่ได้เพราะ token หมดอายุหรือถูกยกเลิก */
  tokenExpired:
    "token Instagram หมดอายุหรือถูกยกเลิก — สร้าง token ใหม่ในหน้า API setup with Instagram login แล้ววางใน ตั้งค่า → บัญชี Instagram",
  /** ขึ้นต้นข้อความเมื่อต่ออายุไม่สำเร็จชั่วคราว (ระบบลองใหม่เองทุก 6 ชั่วโมง) */
  refreshPrefix: "ต่ออายุ token ไม่สำเร็จ",
  /** ขึ้นต้นข้อความเมื่อ subscribe webhook ไม่สำเร็จ */
  subscribePrefix: "subscribe webhook ไม่สำเร็จ",
} as const;

function withToken(row: InstagramAccountRow): InstagramAccount {
  const { accessToken, ...rest } = row;
  try {
    return { ...rest, token: decrypt(accessToken, env.authSecret) };
  } catch {
    return { ...rest, token: null };
  }
}

/**
 * upsert ด้วย id: เข้ารหัส token, tokenRefreshedAt=now, tokenCheckedAt=null, lastError=null, subscribed=false, connectedAt=now;
 * ไม่แตะ lastCommentWebhookAt/lastMessagingWebhookAt เมื่อเป็นการเชื่อมซ้ำ
 */
export async function saveInstagramAccount(db: Db, data: SaveInstagramAccountInput, now: Date = new Date()): Promise<void> {
  const values = {
    id: data.id,
    appScopedId: data.appScopedId,
    username: data.username,
    name: data.name,
    accountType: data.accountType,
    accessToken: encrypt(data.token, env.authSecret),
    tokenExpiresAt: data.tokenExpiresAt,
    tokenExpiryEstimated: data.tokenExpiryEstimated,
    tokenRefreshedAt: now,
    tokenCheckedAt: null,
    subscribed: false,
    lastError: null,
    connectedAt: now,
  };
  await db.insert(instagramAccounts).values(values).onConflictDoUpdate({ target: instagramAccounts.id, set: values });
}

/** หลังต่ออายุสำเร็จ: token, expiresAt, estimated, tokenRefreshedAt=now, tokenCheckedAt=now, lastError=null */
export async function updateInstagramToken(
  db: Db,
  id: string,
  data: { token: string; tokenExpiresAt: Date; tokenExpiryEstimated: boolean },
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(instagramAccounts)
    .set({
      accessToken: encrypt(data.token, env.authSecret),
      tokenExpiresAt: data.tokenExpiresAt,
      tokenExpiryEstimated: data.tokenExpiryEstimated,
      tokenRefreshedAt: now,
      tokenCheckedAt: now,
      lastError: null,
    })
    .where(eq(instagramAccounts.id, id));
}

/** แก้เฉพาะค่าที่ส่งมา (undefined = ไม่แตะ, lastError: null = ล้าง error) */
export async function updateInstagramAccountStatus(
  db: Db,
  id: string,
  patch: { subscribed?: boolean; lastError?: string | null; tokenCheckedAt?: Date },
): Promise<void> {
  const set: Partial<Pick<InstagramAccountRow, "subscribed" | "lastError" | "tokenCheckedAt">> = {};
  if (patch.subscribed !== undefined) set.subscribed = patch.subscribed;
  if (patch.lastError !== undefined) set.lastError = patch.lastError;
  if (patch.tokenCheckedAt !== undefined) set.tokenCheckedAt = patch.tokenCheckedAt;
  if (Object.keys(set).length === 0) return;
  await db.update(instagramAccounts).set(set).where(eq(instagramAccounts.id, id));
}

/** จำว่าเพิ่งได้รับคอมเมนต์ / DM ผ่าน Instagram Login (หน้าตั้งค่าแสดงเวลา และใช้ตัดสินว่าจะข้าม DM ที่มาทาง Facebook Login ไหม) */
export async function markInstagramLoginDelivery(db: Db, id: string, kind: LoginKind, at: Date = new Date()): Promise<void> {
  await db
    .update(instagramAccounts)
    .set(kind === "comments" ? { lastCommentWebhookAt: at } : { lastMessagingWebhookAt: at })
    .where(eq(instagramAccounts.id, id));
}

export async function getInstagramAccount(db: Db, id: string): Promise<InstagramAccount | null> {
  const row = await db.query.instagramAccounts.findFirst({ where: eq(instagramAccounts.id, id) });
  return row ? withToken(row) : null;
}

/** หาบัญชีจาก entry.id ของ webhook: ตรงกับ id หรือ app_scoped_id (ถ้าเจอทั้งสองแบบ ใช้แถวที่ id ตรงก่อน) */
export async function findInstagramAccountByWebhookId(db: Db, webhookId: string): Promise<InstagramAccount | null> {
  const rows = await db.query.instagramAccounts.findMany({
    where: or(eq(instagramAccounts.id, webhookId), eq(instagramAccounts.appScopedId, webhookId)),
  });
  const row = rows.find((r) => r.id === webhookId) ?? rows[0];
  return row ? withToken(row) : null;
}

export async function listInstagramAccounts(db: Db): Promise<InstagramAccount[]> {
  const rows = await db.query.instagramAccounts.findMany({ orderBy: [asc(instagramAccounts.username)] });
  return rows.map(withToken);
}

export async function deleteInstagramAccount(db: Db, id: string): Promise<void> {
  await db.delete(instagramAccounts).where(eq(instagramAccounts.id, id));
}

/** invalid = ถอดรหัส token ไม่ได้; expired = เลยวันหมดอายุแล้ว; expiring = เหลือไม่ถึง 7 วัน */
export type InstagramTokenState = "ok" | "expiring" | "expired" | "invalid";

export function instagramTokenState(
  a: { token: string | null; tokenExpiresAt: Date },
  now: Date = new Date(),
): InstagramTokenState {
  if (a.token == null) return "invalid";
  const left = a.tokenExpiresAt.getTime() - now.getTime();
  if (left < 0) return "expired";
  if (left < INSTAGRAM_TOKEN_WARN_MS) return "expiring";
  return "ok";
}

/**
 * สถานะรวมของบัญชี — กติกาเดียวที่ทุกหน้าใช้ (แถบเมนู, หน้าตั้งค่า, คู่มือ) เรียงตามความสำคัญ:
 * invalid = ถอดรหัส token ไม่ได้, expired = เลยวันหมดอายุ, rejected = Meta ไม่รับ token แล้ว,
 * unsubscribed = ยังไม่รับ webhook, expiring = เหลือไม่ถึง 7 วัน,
 * warning = token ยังใช้ได้แต่มี error ล่าสุด (เช่น ต่ออายุไม่สำเร็จชั่วคราว ระบบจะลองใหม่เอง)
 */
export type InstagramAccountHealth = "invalid" | "expired" | "rejected" | "unsubscribed" | "expiring" | "warning" | "ok";

export function instagramAccountHealth(
  a: { token: string | null; tokenExpiresAt: Date; subscribed: boolean; lastError: string | null },
  now: Date = new Date(),
): InstagramAccountHealth {
  const state = instagramTokenState(a, now);
  if (state === "invalid" || state === "expired") return state;
  if (a.lastError === INSTAGRAM_ERRORS.tokenRejected || a.lastError === INSTAGRAM_ERRORS.tokenExpired) return "rejected";
  if (!a.subscribed) return "unsubscribed";
  if (state === "expiring") return "expiring";
  if (a.lastError) return "warning";
  return "ok";
}

/** critical = ระบบตอบบัญชีนี้ไม่ได้แล้ว, warning = ยังทำงานอยู่แต่ควรดู, ok = พร้อมใช้งาน */
export function instagramHealthLevel(health: InstagramAccountHealth): "critical" | "warning" | "ok" {
  if (health === "ok") return "ok";
  return health === "expiring" || health === "warning" ? "warning" : "critical";
}

/** ต้องวาง token ใหม่ (ระบบต่ออายุเองไม่ได้แล้ว) */
export function needsNewInstagramToken(health: InstagramAccountHealth): boolean {
  return health === "invalid" || health === "expired" || health === "rejected";
}

/** บัญชีที่ใช้งานได้จริง: รับ webhook แล้ว และ token ยังใช้ได้ */
export function isInstagramAccountUsable(
  a: { token: string | null; tokenExpiresAt: Date; subscribed: boolean; lastError: string | null },
  now: Date = new Date(),
): boolean {
  return instagramHealthLevel(instagramAccountHealth(a, now)) !== "critical";
}
