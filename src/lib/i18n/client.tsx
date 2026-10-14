"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createT, type Catalog, type Messages, type TFunction } from "./core";
import { formatters, type Formatters } from "./format";
import { DEFAULT_LOCALE, parseLocale, type Locale } from "./locale";

/*
 * ภาษาฝั่ง Client Component
 * - root layout ห่อทั้งแอปด้วย <I18nProvider locale={await getLocale()} timeZone={env.timezone}> (ส่งแค่ชื่อภาษา ไม่ส่งข้อความ)
 * - แต่ละคอมโพเนนต์ import หมวดข้อความที่ใช้เอง → เบราว์เซอร์โหลดเฉพาะหมวดที่หน้านั้นใช้จริง
 *
 *   import { useT } from "@/lib/i18n/client";
 *   import { navMessages } from "@/lib/i18n/messages/nav";
 *   const t = useT(navMessages);   t("inbox") → "ข้อความรอตอบ" / "Inbox"
 *   const f = useFormat();         f.relativeTime(date)
 *   const locale = useLocale();    "th" | "en"
 *
 * ไม่มี Provider (เช่น เทสที่ render คอมโพเนนต์เดี่ยวๆ) = ภาษาไทย + เขตเวลาเริ่มต้น
 */

interface I18nValue {
  locale: Locale;
  /** เขตเวลาของระบบจากเซิร์ฟเวอร์ (เบราว์เซอร์อ่าน APP_TIMEZONE เองไม่ได้) — ไม่มี = ค่าเริ่มต้นใน format.ts */
  timeZone?: string;
}

const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE });

export function I18nProvider({ locale, timeZone, children }: { locale: Locale; timeZone?: string; children: ReactNode }) {
  const value = useMemo(() => ({ locale, timeZone }), [locale, timeZone]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

/** ตัวแปลของหมวดนี้ในภาษาปัจจุบัน — ส่งตัวหมวด (เช่น navMessages) ไม่ใช่ชื่อ เพื่อไม่ให้ข้อความทุกหน้าติดไปกับเบราว์เซอร์ */
export function useT<M extends Messages>(catalog: Catalog<M>): TFunction<keyof M & string> {
  return createT(catalog, useLocale());
}

/** ตัวจัดรูปแบบตัวเลข/วันที่ ตามภาษา + เขตเวลาเดียวกับฝั่งเซิร์ฟเวอร์ (เรนเดอร์สองฝั่งได้ผลตรงกัน) */
export function useFormat(): Formatters {
  const { locale, timeZone } = useContext(I18nContext);
  return formatters(locale, timeZone);
}

/**
 * ภาษาปัจจุบันสำหรับโค้ดที่ไม่ได้อยู่ในการเรนเดอร์ (event handler, ฟังก์ชันแสดง toast ฯลฯ — ทำงานในเบราว์เซอร์เท่านั้น)
 * อ่านจาก <html lang> ที่ root layout ใส่ไว้ ในคอมโพเนนต์ให้ใช้ useLocale() แทน
 */
export function currentLocale(): Locale {
  return typeof document === "undefined" ? DEFAULT_LOCALE : parseLocale(document.documentElement.lang);
}
