import { createT, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { activityMessages } from "@/lib/i18n/messages/activity";

/** ประเภทกิจกรรมที่นับว่า "ไม่สำเร็จ" (ตัวกรอง "ไม่สำเร็จ" ในหน้ากิจกรรม) */
export const SEND_FAILED_TYPES = ["dm_failed", "public_reply_failed"];
export const TOKEN_FAILED_TYPES = ["token_refresh_failed"];
export const FAILED_TYPES = [...SEND_FAILED_TYPES, ...TOKEN_FAILED_TYPES];

export interface FailureSummary {
  title: string;
  description: string;
  href: string;
  action: string;
}

/**
 * แถบแจ้งเตือนบนหน้ากิจกรรม จากจำนวนรายการไม่สำเร็จใน 24 ชม. (แยกตามประเภท) — ข้อความตามภาษาที่ส่งมา (ไม่ส่ง = ไทย)
 * ต่ออายุ token ไม่สำเร็จ ไม่ใช่ "ส่งไม่สำเร็จ" — ไม่งั้นเจ้าของร้านจะไปหาข้อความที่ส่งไม่ถึงลูกค้าซึ่งไม่มีอยู่จริง
 */
export function failureSummary(counts: Record<string, number>, locale: Locale = DEFAULT_LOCALE): FailureSummary | null {
  const t = createT(activityMessages, locale);
  const sum = (types: string[]) => types.reduce((n, type) => n + (counts[type] ?? 0), 0);
  const send = sum(SEND_FAILED_TYPES);
  const token = sum(TOKEN_FAILED_TYPES);
  if (send === 0 && token === 0) return null;
  if (token === 0) {
    return {
      title: t("failSendTitle", { count: send }),
      description: t("failSendDescription"),
      href: "/activity?filter=failed",
      action: t("failSendAction"),
    };
  }
  if (send === 0) {
    return {
      title: t("failTokenTitle", { count: token }),
      description: t("failTokenDescription"),
      href: "/settings#instagram",
      action: t("failTokenAction"),
    };
  }
  return {
    title: t("failBothTitle", { count: send + token }),
    description: t("failBothDescription", { send, token }),
    href: "/activity?filter=failed",
    action: t("failSendAction"),
  };
}
