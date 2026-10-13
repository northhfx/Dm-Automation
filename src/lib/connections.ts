import type { Db } from "@/db/client";
import type { GraphApi, Platform } from "@/db/schema";
import {
  findInstagramAccountByWebhookId,
  getInstagramAccount,
  type InstagramAccount,
} from "@/lib/instagram/accounts";
import { findPageByAccount, getPageById, type ConnectedPage } from "@/lib/pages";

/**
 * "การเชื่อมต่อ" ที่ระบบใช้คุยกับลูกค้าหนึ่งช่องทาง — handler ทุกตัวใช้ type เดียวนี้
 * - Facebook: เพจ (graph.facebook.com + Page token)
 * - Instagram ผ่านเพจ: บัญชี IG ที่ผูกกับเพจ (graph.facebook.com + Page token)
 * - Instagram Login: บัญชีในตาราง instagram_accounts (graph.instagram.com + token ของ Instagram)
 * ถ้าบัญชี IG มีทั้งสองแบบ ใช้ Instagram Login เสมอ (ยกเลิก Instagram Login แล้วจะกลับไปใช้เพจเอง)
 */

/** ช่องทาง webhook ของ Instagram Login ที่ระบบจำเวลาล่าสุดไว้ */
export type LoginKind = "comments" | "messaging";

export interface Connection {
  /** ค่าใน pageId ของ contacts/messages/events และ SendDmJob.pageId: FB Page ID (api facebook) หรือ IG account ID (api instagram) */
  id: string;
  platform: Platform;
  api: GraphApi;
  /** id ใน POST /{id}/messages: Page ID (api facebook ทั้ง FB และ IG-ผ่านเพจ) หรือ IG account ID (api instagram) */
  messagingId: string;
  /** IG account ID สำหรับดึง media (IG-ผ่านเพจ = pages.igUserId, IG Login = id) */
  igUserId: string | null;
  /** ชื่อเพจ หรือ "@username" */
  name: string;
  /** IG username (null สำหรับ Facebook) */
  username: string | null;
  token: string | null;
  /** IG Login เท่านั้น */
  loginChannel: { commentsAt: Date | null; messagingAt: Date | null } | null;
}

function fromPage(page: ConnectedPage, platform: Platform): Connection {
  return {
    id: page.id,
    platform,
    api: "facebook",
    messagingId: page.id,
    igUserId: page.igUserId,
    name: page.name,
    username: platform === "instagram" ? page.igUsername : null,
    token: page.token,
    loginChannel: null,
  };
}

function fromInstagramAccount(account: InstagramAccount): Connection {
  return {
    id: account.id,
    platform: "instagram",
    api: "instagram",
    messagingId: account.id,
    igUserId: account.id,
    name: `@${account.username}`,
    username: account.username,
    token: account.token,
    loginChannel: { commentsAt: account.lastCommentWebhookAt, messagingAt: account.lastMessagingWebhookAt },
  };
}

/** จาก entry.id ของ webhook: facebook → pages.id; instagram → instagram_accounts (id|app_scoped_id) ก่อน, ไม่เจอค่อย pages.igUserId */
export async function findConnection(db: Db, platform: Platform, webhookAccountId: string): Promise<Connection | null> {
  if (platform === "instagram") {
    const account = await findInstagramAccountByWebhookId(db, webhookAccountId);
    if (account) return fromInstagramAccount(account);
  }
  const page = await findPageByAccount(db, platform, webhookAccountId);
  return page ? fromPage(page, platform) : null;
}

/**
 * สำหรับงาน send_dm:
 *  api "instagram" → instagram_accounts.id=key; ไม่เจอ → page ที่ igUserId=key (กลับไปใช้เพจหลังยกเลิก IG Login)
 *  facebook → pages.id=key
 *  instagram + api ไม่ระบุ/"facebook" (งานเก่า key=Page ID) → page; ถ้า page.igUserId มีบัญชี IG Login → คืน connection IG Login; ไม่งั้น IG-ผ่านเพจ;
 *  ไม่เจอ page → ลอง instagram_accounts.id=key
 */
export async function getConnection(db: Db, platform: Platform, key: string, api?: GraphApi): Promise<Connection | null> {
  if (platform === "facebook") {
    const page = await getPageById(db, key);
    return page ? fromPage(page, "facebook") : null;
  }

  if (api === "instagram") {
    const account = await getInstagramAccount(db, key);
    if (account) return fromInstagramAccount(account);
    const page = await findPageByAccount(db, "instagram", key);
    return page ? fromPage(page, "instagram") : null;
  }

  const page = await getPageById(db, key);
  if (page) {
    const account = page.igUserId ? await findInstagramAccountByWebhookId(db, page.igUserId) : null;
    return account ? fromInstagramAccount(account) : fromPage(page, "instagram");
  }
  const account = await getInstagramAccount(db, key);
  return account ? fromInstagramAccount(account) : null;
}
