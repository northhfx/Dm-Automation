import { formatNumber } from "@/components/ui";

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
 * แถบแจ้งเตือนบนหน้ากิจกรรม จากจำนวนรายการไม่สำเร็จใน 24 ชม. (แยกตามประเภท)
 * ต่ออายุ token ไม่สำเร็จ ไม่ใช่ "ส่งไม่สำเร็จ" — ไม่งั้นเจ้าของร้านจะไปหาข้อความที่ส่งไม่ถึงลูกค้าซึ่งไม่มีอยู่จริง
 */
export function failureSummary(counts: Record<string, number>): FailureSummary | null {
  const sum = (types: string[]) => types.reduce((n, t) => n + (counts[t] ?? 0), 0);
  const send = sum(SEND_FAILED_TYPES);
  const token = sum(TOKEN_FAILED_TYPES);
  if (send === 0 && token === 0) return null;
  if (token === 0) {
    return {
      title: `ส่งไม่สำเร็จ ${formatNumber(send)} รายการ ใน 24 ชั่วโมงที่ผ่านมา`,
      description: "กดดูสาเหตุและวิธีแก้ของแต่ละรายการ",
      href: "/activity?filter=failed",
      action: "ดูสาเหตุ",
    };
  }
  if (send === 0) {
    return {
      title: `ต่ออายุ token Instagram ไม่สำเร็จ ${formatNumber(token)} ครั้ง ใน 24 ชั่วโมงที่ผ่านมา`,
      description: "ไม่ใช่ข้อความที่ส่งไม่ถึงลูกค้า — ดูสถานะ token และวิธีแก้ได้ที่ ตั้งค่า → บัญชี Instagram",
      href: "/settings#instagram",
      action: "ไปที่ตั้งค่า",
    };
  }
  return {
    title: `มีรายการไม่สำเร็จ ${formatNumber(send + token)} รายการ ใน 24 ชั่วโมงที่ผ่านมา`,
    description: `ส่งข้อความไม่สำเร็จ ${formatNumber(send)} รายการ · ต่ออายุ token Instagram ไม่สำเร็จ ${formatNumber(token)} ครั้ง — กดดูสาเหตุและวิธีแก้ของแต่ละรายการ`,
    href: "/activity?filter=failed",
    action: "ดูสาเหตุ",
  };
}
