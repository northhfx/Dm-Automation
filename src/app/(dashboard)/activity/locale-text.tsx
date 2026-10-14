"use client";

import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";

/*
 * ข้อความสั้นๆ ตามภาษา สำหรับคอมโพเนนต์ธรรมดาที่อ่านคุกกี้ภาษาเองไม่ได้ (เช่น loading.tsx ที่ต้องแสดงได้ทันที)
 * ฝั่งเซิร์ฟเวอร์ส่งคำแปลมาทั้งสองภาษา เฉพาะข้อความนี้ (ไม่ส่งทั้งหมวด ข้อความหน้าอื่นจึงไม่ติดไปกับเบราว์เซอร์)
 * แล้วเลือกภาษาจาก I18nProvider ได้ทั้งตอน SSR และในเบราว์เซอร์
 *   <LocaleText text={{ th: activityMessages.th.loading, en: activityMessages.en.loading }} />
 */
export function LocaleText({ text }: { text: Readonly<Record<Locale, string>> }) {
  return <>{text[useLocale()]}</>;
}
