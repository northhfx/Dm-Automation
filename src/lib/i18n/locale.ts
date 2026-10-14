/*
 * ภาษาของหน้าจัดการ: ไทย (ค่าเริ่มต้น) / อังกฤษ — ใช้ได้ทั้งฝั่ง Server และ Client (ไฟล์นี้ไม่มี import ฝั่งเซิร์ฟเวอร์)
 * - ค่าที่เลือกเก็บในคุกกี้ "lang" (ไม่มีคุกกี้ = ไทย)
 * - root layout อ่านคุกกี้ → ใส่ <html lang> และส่งภาษาให้ I18nProvider ตั้งแต่ฝั่งเซิร์ฟเวอร์ → เปิดหน้ามาไม่กะพริบ
 * - เปลี่ยนภาษา = เขียนคุกกี้ + router.refresh() ให้ Server Component เรนเดอร์ใหม่ (ดู components/language-toggle.tsx)
 * ภาษานี้เปลี่ยนเฉพาะหน้าจัดการ — ข้อความที่ระบบส่งหาลูกค้าไม่เปลี่ยนตาม
 */

export const LOCALES = ["th", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "th";

export const LOCALE_COOKIE = "lang";

/** อายุคุกกี้ภาษา (วินาที) = 1 ปี */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** ชื่อภาษาในภาษาของตัวเอง (ไม่แปล — คนที่อ่านอีกภาษาไม่ออกจะได้หาทางกลับเจอ) */
export const LOCALE_NAMES: Record<Locale, string> = { th: "ไทย", en: "English" };

/** แท็กภาษาสำหรับ Intl (วันที่ / ตัวเลข) */
export const INTL_LOCALES: Record<Locale, string> = { th: "th-TH", en: "en-US" };

/**
 * ค่าจากคุกกี้ (หรือแท็กภาษาอื่นๆ เช่น "en-US", "TH") → ภาษาที่รองรับ
 * ค่าอื่น / ไม่มีค่า → ไทย
 */
export function parseLocale(v: string | undefined | null): Locale {
  const primary = v?.trim().toLowerCase().split(/[-_]/)[0];
  return primary === "en" ? "en" : DEFAULT_LOCALE;
}
