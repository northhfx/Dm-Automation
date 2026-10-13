import type { Db } from "@/db/client";
import { pages } from "@/db/schema";
import { getInstagramConfig } from "@/lib/config";
import {
  exchangeInstagramToken,
  getInstagramMe,
  GraphApiError,
  subscribeInstagramAccount,
  unsubscribeInstagramAccount,
  type InstagramMe,
} from "@/lib/meta/graph";
import { INSTAGRAM_WEBHOOK_FIELDS } from "@/lib/meta/setup-info";
import {
  deleteInstagramAccount,
  getInstagramAccount,
  INSTAGRAM_ERRORS,
  INSTAGRAM_TOKEN_TTL_MS,
  saveInstagramAccount,
  updateInstagramAccountStatus,
} from "./accounts";

/*
 * เชื่อมบัญชี Instagram ผ่าน Instagram Login ด้วย token ที่เจ้าของร้านกด Generate token ในหน้า
 * API setup with Instagram login แล้ววางในหน้าตั้งค่า (ไม่มี OAuth)
 */

/** error ที่แสดงให้เจ้าของร้านเห็นได้เลย (field = ช่องในฟอร์มที่ต้องแก้) */
export class InstagramConnectError extends Error {
  constructor(
    message: string,
    readonly field: "token" | "appSecret" | null = null,
  ) {
    super(message);
    this.name = "InstagramConnectError";
  }
}

export interface ConnectInstagramResult {
  accountId: string;
  username: string;
  subscribed: boolean;
  tokenExpiresAt: Date;
  tokenExpiryEstimated: boolean;
  /** ข้อความแจ้งเตือนที่ไม่ทำให้เชื่อมต่อไม่สำเร็จ (ภาษาไทย) */
  notices: string[];
}

const SUBSCRIBE_ERROR_PREFIX = INSTAGRAM_ERRORS.subscribePrefix;

function messageOf(err: unknown): string {
  return (err as Error)?.message ?? String(err);
}

/** token ที่คัดลอกมามักติดช่องว่าง ขึ้นบรรทัดใหม่ หรือเครื่องหมายคำพูด */
function cleanToken(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "");
}

async function getMeOrThrow(token: string): Promise<InstagramMe> {
  try {
    return await getInstagramMe(token);
  } catch (err) {
    if (err instanceof GraphApiError && err.code === 190) {
      throw new InstagramConnectError("token ใช้ไม่ได้หรือหมดอายุ — กด Generate token ใหม่แล้ววางอีกครั้ง", "token");
    }
    if (err instanceof GraphApiError && err.code === 3) {
      throw new InstagramConnectError(
        "token นี้ใช้กับ Instagram Login ไม่ได้ — ต้องสร้างจากหน้า API setup with Instagram login",
        "token",
      );
    }
    throw new InstagramConnectError(`เชื่อมต่อไม่สำเร็จ: ${messageOf(err)}`, "token");
  }
}

/** subscribe webhook ของบัญชี แล้วบันทึกผล (ไม่ throw) — คืนข้อความ error ถ้าไม่สำเร็จ */
async function subscribeAndRecord(db: Db, accountId: string, token: string): Promise<string | null> {
  try {
    await subscribeInstagramAccount(token, INSTAGRAM_WEBHOOK_FIELDS);
    await updateInstagramAccountStatus(db, accountId, { subscribed: true });
    return null;
  } catch (err) {
    const error = `${SUBSCRIBE_ERROR_PREFIX} (${messageOf(err)})`;
    await updateInstagramAccountStatus(db, accountId, { subscribed: false, lastError: error });
    return error;
  }
}

export async function connectInstagramWithToken(
  db: Db,
  rawToken: string,
  now: Date = new Date(),
): Promise<ConnectInstagramResult> {
  const notices: string[] = [];

  // 1) ตรวจ token เบื้องต้น (ยังไม่ยิง Meta)
  const pasted = cleanToken(rawToken);
  if (!pasted) throw new InstagramConnectError("วาง access token ของ Instagram ก่อน", "token");
  if (pasted.startsWith("EAA")) {
    throw new InstagramConnectError(
      "token นี้เป็นของ Facebook (ขึ้นต้นด้วย EAA) — ต้องกด Generate token ในหน้า API setup with Instagram login แล้วคัดลอก token ที่ขึ้นต้นด้วย IG",
      "token",
    );
  }
  if (!pasted.startsWith("IG")) {
    notices.push("token ไม่ได้ขึ้นต้นด้วย IG — ถ้าเชื่อมไม่สำเร็จ ให้สร้าง token ใหม่จากหน้า API setup with Instagram login");
  }

  // 2) ต้องมี Instagram app secret (ใช้แลก token และตรวจลายเซ็น webhook)
  const { appSecret } = await getInstagramConfig(db);
  if (!appSecret) throw new InstagramConnectError("ใส่ Instagram app secret ในหัวข้อ Instagram App ก่อน", "appSecret");

  // 3) แลกเป็น long-lived token — token จากหน้า dashboard เป็น long-lived อยู่แล้ว แลกไม่ได้เป็นเรื่องปกติ
  let token = pasted;
  let tokenExpiresAt = new Date(now.getTime() + INSTAGRAM_TOKEN_TTL_MS);
  let tokenExpiryEstimated = true;
  try {
    const grant = await exchangeInstagramToken(pasted, appSecret);
    token = grant.token;
    tokenExpiresAt = new Date(now.getTime() + (grant.expiresInSec != null ? grant.expiresInSec * 1000 : INSTAGRAM_TOKEN_TTL_MS));
    tokenExpiryEstimated = grant.expiresInSec == null;
  } catch {
    // ใช้ token ที่วางมา และประมาณวันหมดอายุไว้ 60 วัน (ระบบจะต่ออายุให้หลังผ่านไป 24 ชม. แล้วได้วันจริง)
  }

  // 4) token นี้เป็นของบัญชีไหน (ไม่สำเร็จ → ไม่บันทึกอะไรเลย)
  const me = await getMeOrThrow(token);

  // 5) บันทึก
  await saveInstagramAccount(
    db,
    {
      id: me.userId,
      appScopedId: me.appScopedId,
      username: me.username,
      name: me.name,
      accountType: me.accountType,
      token,
      tokenExpiresAt,
      tokenExpiryEstimated,
    },
    now,
  );

  // 6) ให้ Meta ส่ง webhook ของบัญชีนี้มา
  const subscribeError = await subscribeAndRecord(db, me.userId, token);
  if (subscribeError) notices.push(subscribeError);

  // 7) เทียบกับเพจที่เชื่อมไว้ (บัญชีเดียวกันอาจผูกกับเพจ Facebook ด้วย)
  const connectedPages = await db
    .select({ name: pages.name, igUserId: pages.igUserId, igUsername: pages.igUsername })
    .from(pages)
    .orderBy(pages.name);
  const linked = connectedPages.find((p) => p.igUserId === me.userId);
  const sameUsername = connectedPages.find(
    (p) => p.igUsername != null && me.username !== "" && p.igUsername.toLowerCase() === me.username.toLowerCase(),
  );
  if (linked) {
    notices.push(`บัญชีนี้ผูกกับเพจ ${linked.name} ด้วย — ระบบจะใช้ Instagram Login กับบัญชีนี้แทน`);
  } else if (sameUsername) {
    notices.push(
      `ID ของ @${me.username} จาก Instagram Login (${me.userId}) ไม่ตรงกับที่ผูกกับเพจ (${sameUsername.igUserId}) — ระบบยังทำงานได้ แต่อาจตอบซ้ำ แจ้งผู้พัฒนา`,
    );
  }

  return {
    accountId: me.userId,
    username: me.username,
    subscribed: subscribeError === null,
    tokenExpiresAt,
    tokenExpiryEstimated,
    notices,
  };
}

/** กด "ลองใหม่" ในหน้าตั้งค่า: subscribe webhook ของบัญชีอีกครั้ง */
export async function resubscribeInstagram(
  db: Db,
  accountId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const account = await getInstagramAccount(db, accountId);
  if (!account) return { ok: false, error: "ไม่พบบัญชี Instagram นี้ อาจถูกยกเลิกการเชื่อมต่อไปแล้ว" };
  if (!account.token) return { ok: false, error: "token ถอดรหัสไม่ได้ — วาง token ใหม่" };
  const error = await subscribeAndRecord(db, accountId, account.token);
  if (error) return { ok: false, error };
  // ล้างเฉพาะ error ของการ subscribe (error เรื่อง token ยังต้องแสดงอยู่)
  if (account.lastError?.startsWith(SUBSCRIBE_ERROR_PREFIX)) {
    await updateInstagramAccountStatus(db, accountId, { lastError: null });
  }
  return { ok: true };
}

/** ยกเลิกการเชื่อมต่อ: ลองบอก Meta ให้หยุดส่ง webhook (ไม่สำเร็จก็ไม่เป็นไร) แล้วลบบัญชี */
export async function disconnectInstagram(db: Db, accountId: string): Promise<void> {
  const account = await getInstagramAccount(db, accountId);
  if (account?.token) {
    try {
      await unsubscribeInstagramAccount(account.token);
    } catch (err) {
      console.warn(`[instagram] ยกเลิก webhook ของ @${account.username} ไม่สำเร็จ (ลบบัญชีต่อ):`, messageOf(err));
    }
  }
  await deleteInstagramAccount(db, accountId);
}
