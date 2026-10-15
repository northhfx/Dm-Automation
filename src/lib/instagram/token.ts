import type { Db } from "@/db/client";
import { events } from "@/db/schema";
import { systemMessage } from "@/lib/i18n/system";
import {
  errorInfo,
  GraphApiError,
  refreshInstagramToken,
  subscribeInstagramAccount,
  type InstagramTokenGrant,
} from "@/lib/meta/graph";
import { INSTAGRAM_WEBHOOK_FIELDS } from "@/lib/meta/setup-info";
import {
  getInstagramAccount,
  INSTAGRAM_ERRORS,
  INSTAGRAM_TOKEN_TTL_MS,
  listInstagramAccounts,
  updateInstagramAccountStatus,
  updateInstagramToken,
  type InstagramAccount,
} from "./accounts";

/*
 * ต่ออายุ token ของ Instagram Login (อายุ 60 วัน ถ้าไม่ต่อภายใน 60 วันจะกู้คืนไม่ได้ ต้องวาง token ใหม่)
 * worker เรียก refreshDueInstagramTokens ทุก 10 นาที — ส่วนใหญ่แค่อ่านฐานข้อมูล ยิง Meta เฉพาะบัญชีที่ถึงเวลา
 */

const HOUR = 60 * 60_000;

/** Meta ต่ออายุให้เฉพาะ token ที่มีอายุอย่างน้อย 24 ชั่วโมง */
export const REFRESH_MIN_AGE_MS = 24 * HOUR;
/** ต่ออายุเมื่อเหลือไม่ถึง 10 วัน (หรือไม่รู้วันหมดอายุจริง) */
export const REFRESH_WINDOW_MS = 10 * 24 * HOUR;
/** ต่ออายุไม่สำเร็จ → ลองใหม่ได้ทุก 6 ชั่วโมง */
export const REFRESH_RETRY_MS = 6 * HOUR;

const DECRYPT_FAILED = systemMessage("igTokenDecrypt");

export function isRefreshDue(
  a: Pick<InstagramAccount, "tokenRefreshedAt" | "tokenExpiresAt" | "tokenExpiryEstimated" | "tokenCheckedAt">,
  now: Date = new Date(),
): boolean {
  const t = now.getTime();
  if (t - a.tokenRefreshedAt.getTime() < REFRESH_MIN_AGE_MS) return false;
  if (!a.tokenExpiryEstimated && a.tokenExpiresAt.getTime() - t > REFRESH_WINDOW_MS) return false;
  if (a.tokenCheckedAt && t - a.tokenCheckedAt.getTime() < REFRESH_RETRY_MS) return false;
  return true;
}

export type RefreshResult = { ok: true; tokenExpiresAt: Date } | { ok: false; error: string };

/** บันทึกว่าต่ออายุไม่สำเร็จ + เพิ่มในหน้ากิจกรรม (เฉพาะเมื่อสาเหตุต่างจากครั้งก่อน จะได้ไม่ขึ้นซ้ำทุก 6 ชั่วโมง) */
async function recordFailure(db: Db, account: InstagramAccount, message: string, err: unknown, now: Date): Promise<RefreshResult> {
  await updateInstagramAccountStatus(db, account.id, { lastError: message, tokenCheckedAt: now });
  if (message !== account.lastError) {
    await db.insert(events).values({
      type: "token_refresh_failed",
      platform: "instagram",
      pageId: account.id,
      meta: { username: account.username, error: errorInfo(err) },
    });
  }
  return { ok: false, error: message };
}

async function refreshAccount(db: Db, account: InstagramAccount, now: Date): Promise<RefreshResult> {
  if (!account.token) return recordFailure(db, account, DECRYPT_FAILED, new Error(DECRYPT_FAILED), now);

  let grant: InstagramTokenGrant;
  try {
    grant = await refreshInstagramToken(account.token);
  } catch (err) {
    const expired =
      (err instanceof GraphApiError && err.code === 190) || account.tokenExpiresAt.getTime() < now.getTime();
    const message = expired
      ? INSTAGRAM_ERRORS.tokenExpired
      : systemMessage("igRefreshFailed", { detail: (err as Error)?.message ?? String(err) });
    return recordFailure(db, account, message, err, now);
  }

  const tokenExpiresAt = new Date(
    now.getTime() + (grant.expiresInSec != null ? grant.expiresInSec * 1000 : INSTAGRAM_TOKEN_TTL_MS),
  );
  await updateInstagramToken(db, account.id, { token: grant.token, tokenExpiresAt, tokenExpiryEstimated: false }, now);

  // ได้ token ใหม่แล้ว subscribe webhook ซ้ำเผื่อหลุด (ไม่สำเร็จก็ไม่เป็นไร แค่บันทึกไว้)
  try {
    await subscribeInstagramAccount(grant.token, INSTAGRAM_WEBHOOK_FIELDS);
    await updateInstagramAccountStatus(db, account.id, { subscribed: true });
  } catch (err) {
    await updateInstagramAccountStatus(db, account.id, {
      lastError: systemMessage("igSubscribeFailed", { detail: (err as Error)?.message ?? String(err) }),
    });
  }
  return { ok: true, tokenExpiresAt };
}

/** ต่ออายุ token ของบัญชีเดียว (manual = เจ้าของกดปุ่มเอง → ไม่ต้องรอให้ถึงเวลา แต่ยังต้องมีอายุ ≥ 24 ชม.) */
export async function refreshInstagramAccountToken(
  db: Db,
  accountId: string,
  opts: { now?: Date; manual?: boolean } = {},
): Promise<RefreshResult> {
  const now = opts.now ?? new Date();
  const account = await getInstagramAccount(db, accountId);
  if (!account) return { ok: false, error: systemMessage("igAccountNotFound") };
  if (opts.manual && account.token && now.getTime() - account.tokenRefreshedAt.getTime() < REFRESH_MIN_AGE_MS) {
    return { ok: false, error: systemMessage("igTokenTooNew") };
  }
  return refreshAccount(db, account, now);
}

/** ต่ออายุทุกบัญชีที่ถึงเวลา (worker เรียกทุก 10 นาที) — ไม่ throw */
export async function refreshDueInstagramTokens(
  db: Db,
  now: Date = new Date(),
): Promise<{ checked: number; refreshed: number; failed: number }> {
  const result = { checked: 0, refreshed: 0, failed: 0 };
  let accounts: InstagramAccount[];
  try {
    accounts = await listInstagramAccounts(db);
  } catch (err) {
    console.error("[instagram] อ่านรายการบัญชีเพื่อต่ออายุ token ไม่สำเร็จ:", err);
    return result;
  }
  for (const account of accounts) {
    if (!isRefreshDue(account, now)) continue;
    result.checked++;
    try {
      const r = await refreshAccount(db, account, now);
      if (r.ok) result.refreshed++;
      else result.failed++;
    } catch (err) {
      result.failed++;
      console.error(`[instagram] ต่ออายุ token ของ @${account.username} ผิดพลาด:`, err);
    }
  }
  return result;
}
