import { createT, DEFAULT_LOCALE, formatters, type Locale } from "@/lib/i18n";
import { commonMessages } from "@/lib/i18n/messages/common";
import { guideMessages } from "@/lib/i18n/messages/guide";
import {
  instagramAccountHealth,
  isInstagramAccountUsable,
  needsNewInstagramToken,
  type InstagramAccount,
} from "@/lib/instagram/accounts";

/** "11 ธ.ค. 20:04 (โดยประมาณ)" — วันหมดอายุของ token ของบัญชี */
function expiryText(a: Pick<InstagramAccount, "tokenExpiresAt" | "tokenExpiryEstimated">, locale: Locale): string {
  const date = formatters(locale).dateTime(a.tokenExpiresAt);
  return a.tokenExpiryEstimated ? createT(guideMessages, locale)("igExpiryEstimated", { date }) : date;
}

/**
 * สถานะของขั้นที่ 5 ในคู่มือ (เชื่อมต่อ Instagram): เสร็จเมื่อมีบัญชีที่ใช้งานได้จริง
 * (รับ webhook แล้ว และ token ยังไม่หมดอายุ/ไม่ถูก Meta ปฏิเสธ) — กติกาเดียวกับหน้าตั้งค่าและแถบเมนู
 * ถ้า token ตายหมดแล้ว ขั้นนี้กลับเป็น "ยังไม่เสร็จ" (การ์ดเปิดอยู่) และบอกให้วาง token ใหม่ในข้อ 7
 * webhookOk = Meta ยืนยัน Callback URL ของ Instagram แล้ว หรือเคยได้รับข้อมูลทาง Instagram Login
 * (ยังไม่ครบ → ยังไม่เสร็จ การ์ดไม่พับ เพื่อให้เห็นข้อ 8–11 ที่เหลือ)
 * locale = ภาษาของข้อความสรุป (ไม่ใส่ = ไทย)
 */
export function instagramStepStatus(
  accounts: InstagramAccount[],
  now: Date = new Date(),
  webhookOk = true,
  locale: Locale = DEFAULT_LOCALE,
): { done: boolean; summary: string } {
  const t = createT(guideMessages, locale);
  const ready = accounts.filter((a) => isInstagramAccountUsable(a, now));
  if (ready.length > 0 && !webhookOk) {
    return { done: false, summary: t("igPendingWebhook", { username: ready[0].username }) };
  }
  if (ready.length > 0) {
    return {
      done: true,
      summary: t("igConnected", {
        accounts: ready.map((a) => t("igAccountValid", { username: a.username, expiry: expiryText(a, locale) })).join(", "),
      }),
    };
  }
  const dead = accounts.find((a) => needsNewInstagramToken(instagramAccountHealth(a, now)));
  if (dead) {
    const health = instagramAccountHealth(dead, now);
    return {
      done: false,
      summary:
        health === "expired"
          ? t("igTokenExpired", { username: dead.username, expiry: expiryText(dead, locale) })
          : t("igTokenInvalid", { username: dead.username }),
    };
  }
  if (accounts.length > 0) {
    return {
      done: false,
      summary: t("igNotSubscribed", { username: accounts[0].username, retry: createT(commonMessages, locale)("retry") }),
    };
  }
  return { done: false, summary: t("igIntro") };
}
