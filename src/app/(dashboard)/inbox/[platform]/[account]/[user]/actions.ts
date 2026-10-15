"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { requireAuth } from "@/lib/auth";
import { sendChatReply, CHAT_TEXT_MAX, type ChatSendFailure } from "@/lib/chat/send";
import { parseChatKey } from "@/lib/chat/thread";
import { getT } from "@/lib/i18n/server";

/*
 * ปุ่ม "ส่ง" ในหน้าแชท — คืนข้อความ error ตามภาษาที่เลือกไว้ (null = ส่งสำเร็จ)
 * refresh(): โหลดห้องแชทใหม่ (ข้อความที่เพิ่งส่ง) + ตัวเลขข้อความรอตอบบนเมนู
 */
export async function sendChatReplyAction(input: { platform: string; account: string; user: string; text: string }): Promise<string | null> {
  await requireAuth();
  const t = await getT("chat");
  const key = parseChatKey(input.platform, input.account, input.user);
  if (!key) return t("errNoConnection");
  const platform = key.platform === "facebook" ? "Facebook" : "Instagram";
  const where = key.platform === "facebook" ? "Messenger" : "Instagram";

  const result = await sendChatReply(getDb(), key, String(input.text ?? ""));
  if (result.ok) {
    refresh();
    return null;
  }
  const messages: Record<ChatSendFailure, string> = {
    empty: t("errEmpty"),
    tooLong: t("errTooLong", { max: String(CHAT_TEXT_MAX) }),
    noConnection: t("errNoConnection"),
    noToken: t("errToken", { platform }),
    tokenInvalid: t("errToken", { platform }),
    windowClosed: t("errWindow", { platform, where }),
    unavailable: t("errUnavailable"),
    failed: result.detail ? t("errFailed", { detail: result.detail }) : t("errFailedGeneric"),
  };
  // ยิงไปถึง Meta แล้วไม่ผ่าน (บันทึกไว้ในห้องแชทแล้ว) หรือหมดเวลาตอบ → โหลดใหม่ให้เห็นสถานะล่าสุด
  if (result.reason !== "empty" && result.reason !== "tooLong") refresh();
  return messages[result.reason];
}
