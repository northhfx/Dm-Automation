import type { Db } from "@/db/client";
import { chatReplies } from "@/db/schema";
import { getConnection } from "@/lib/connections";
import { FLOW_LIMITS } from "@/lib/flows/types";
import { GraphApiError, sendMessage } from "@/lib/meta/graph";
import { lastInboundAt, markThreadHandled, replyWindowEndsAt, type ChatKey } from "./thread";

/*
 * เจ้าของร้านพิมพ์ตอบลูกค้าเองจากหน้าแชท → ส่งผ่าน Send API ในนามเพจ / บัญชี Instagram
 * ส่งสำเร็จ: บันทึกใน chat_replies และถือว่าตอบรายการในหน้าข้อความรอตอบของคนนี้แล้ว
 * ส่งไม่สำเร็จ: บันทึกไว้ด้วย (แสดงในห้องแชทว่าส่งไม่ได้เพราะอะไร)
 */

/** ยาวสุดเท่าข้อความอัตโนมัติแบบไม่มีปุ่ม (ใช้ได้ทั้ง Messenger และ Instagram) */
export const CHAT_TEXT_MAX = FLOW_LIMITS.textPlain;

export type ChatSendFailure =
  | "empty"
  | "tooLong"
  | "noConnection"
  | "noToken"
  | "tokenInvalid"
  | "windowClosed"
  | "unavailable"
  | "failed";

export type ChatSendResult = { ok: true } | { ok: false; reason: ChatSendFailure; detail?: string };

// error ของ Meta ที่รู้ความหมาย (นอกนั้นแสดงข้อความจาก Meta ตรงๆ)
const WINDOW_SUBCODES = new Set([2018278, 2534022]);
const UNAVAILABLE_SUBCODES = new Set([1545041, 2018108]);

/** error จาก Meta → เหตุผลที่บอกเจ้าของร้านได้ */
export function classifySendError(err: unknown): { reason: ChatSendFailure; detail?: string } {
  if (err instanceof GraphApiError) {
    if (err.code === 190) return { reason: "tokenInvalid" };
    if ((err.subcode !== undefined && WINDOW_SUBCODES.has(err.subcode)) || /outside (of )?(the )?allowed window/i.test(err.message)) {
      return { reason: "windowClosed" };
    }
    if (err.code === 551 || (err.subcode !== undefined && UNAVAILABLE_SUBCODES.has(err.subcode))) return { reason: "unavailable" };
    // status 0 = ต่อ Meta ไม่ได้เลย (ข้อความเป็นของระบบเอง ไม่ใช่ของ Meta) → ข้อความทั่วไป
    return err.status === 0 ? { reason: "failed" } : { reason: "failed", detail: err.message };
  }
  return { reason: "failed" };
}

export async function sendChatReply(db: Db, key: ChatKey, rawText: string, now: Date = new Date()): Promise<ChatSendResult> {
  const text = rawText.replace(/\r\n/g, "\n").trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > CHAT_TEXT_MAX) return { ok: false, reason: "tooLong" };

  const conn = await getConnection(db, key.platform, key.account);
  if (!conn) return { ok: false, reason: "noConnection" };
  if (!conn.token) return { ok: false, reason: "noToken" };
  // เช็กก่อนส่ง (Meta ก็ปฏิเสธเองอยู่แล้ว แต่บอกเหตุผลได้ชัดกว่า และไม่ต้องรอ)
  if (!replyWindowEndsAt(await lastInboundAt(db, key), now)) return { ok: false, reason: "windowClosed" };

  try {
    const res = await sendMessage(conn.messagingId, conn.token, { id: key.user }, { text }, conn.api);
    await db.insert(chatReplies).values({
      platform: key.platform,
      pageId: key.account,
      recipientId: key.user,
      text,
      mid: res.message_id ?? null,
      status: "sent",
      sentAt: now,
    });
    await markThreadHandled(db, key, now);
    return { ok: true };
  } catch (err) {
    const failure = classifySendError(err);
    await db.insert(chatReplies).values({
      platform: key.platform,
      pageId: key.account,
      recipientId: key.user,
      text,
      status: "failed",
      error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
      sentAt: now,
    });
    return { ok: false, ...failure };
  }
}
