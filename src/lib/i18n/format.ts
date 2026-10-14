import { DEFAULT_LOCALE, INTL_LOCALES, type Locale } from "./locale";

/*
 * จัดรูปแบบตัวเลข / วันที่ ตามภาษา (th-TH / en-US) — ใช้ได้ทั้ง Server และ Client
 * - Server Component: const f = await getFormat()        (src/lib/i18n/server.ts)
 * - Client Component: const f = useFormat()              (src/lib/i18n/client.tsx)
 * - ที่อื่น (มีภาษาอยู่แล้ว):  formatters(locale).dateTime(d)
 * ตัวจัดรูปแบบของ Intl สร้างครั้งเดียวต่อภาษา/ตัวเลือก แล้วใช้ซ้ำ (สร้างใหม่ทุกครั้งช้า)
 */

/**
 * เขตเวลาของระบบ (ตั้งได้ด้วย APP_TIMEZONE ฝั่งเซิร์ฟเวอร์ — ในเบราว์เซอร์อ่าน env ไม่ได้ จึงได้ค่าเริ่มต้นเสมอ)
 * Client Component ต้องใช้ useFormat() ซึ่งได้เขตเวลาจริงจาก I18nProvider (root layout ส่งมา)
 * ไม่งั้นเวลาที่เรนเดอร์ฝั่งเซิร์ฟเวอร์กับในเบราว์เซอร์จะไม่ตรงกัน (hydration mismatch) เมื่อตั้ง APP_TIMEZONE ไว้
 */
const TIME_ZONE = process.env.APP_TIMEZONE || "Asia/Bangkok";

type DateInput = Date | string | null | undefined;

export interface Formatters {
  readonly locale: Locale;
  /** 1234 → "1,234" */
  number(n: number): string;
  /** 12.34 → "12%", 3.21 → "3.2%", null → "–" */
  percent(n: number | null): string;
  /** ["ส่ง DM", "คลิก"] → "ส่ง DM และ คลิก" / ["DMs", "clicks"] → "DMs and clicks" (คำเชื่อมตามภาษา) */
  list(items: readonly string[]): string;
  /** วันที่ + เวลา (ไม่มีปี): "13 ต.ค. 14:05" / "Oct 13, 2:05 PM" — null → "–" */
  dateTime(d: DateInput): string;
  /**
   * วันที่ตามตัวเลือกของ Intl — ค่าเริ่มต้น { day: "numeric", month: "short" } ("13 ต.ค." / "Oct 13")
   * เขตเวลาเริ่มต้นเป็นของระบบ — วันที่แบบ "2026-10-13" (ไม่มีเวลา) ให้ใส่ { timeZone: "UTC" }
   */
  date(d: DateInput, options?: Intl.DateTimeFormatOptions): string;
  /** "เมื่อสักครู่" / "just now", "5 นาทีที่ผ่านมา" / "5 minutes ago", "เมื่อวาน" / "yesterday" — เกิน 7 วันแสดงเป็น dateTime */
  relativeTime(d: DateInput, now?: Date): string;
}

const JUST_NOW: Record<Locale, string> = { th: "เมื่อสักครู่", en: "just now" };

const DATE_TIME_OPTIONS: Record<Locale, Intl.DateTimeFormatOptions> = {
  th: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  // อังกฤษใช้ชั่วโมงแบบ 12 ชม. ไม่เติมศูนย์หน้า ("2:05 PM" ไม่ใช่ "02:05 PM")
  en: { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
};

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

function toDate(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}

function create(locale: Locale, timeZone: string): Formatters {
  const tag = INTL_LOCALES[locale];
  const numberFormat = new Intl.NumberFormat(tag);
  const dateTimeFormat = new Intl.DateTimeFormat(tag, { ...DATE_TIME_OPTIONS[locale], timeZone });
  const relativeFormat = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  // ไทย: Intl ไม่เว้นวรรคหน้า "และ" ("DMและคลิก") ซึ่งอ่านยากเมื่อมีคำอังกฤษ → ต่อเองแบบมีวรรค
  const listFormat = locale === "th" ? null : new Intl.ListFormat(tag, { type: "conjunction" });
  const dateFormats = new Map<string, Intl.DateTimeFormat>();

  const self: Formatters = {
    locale,
    number: (n) => numberFormat.format(n),
    percent: (n) => (n === null ? "–" : `${n.toFixed(n >= 10 || n === 0 ? 0 : 1)}%`),
    list: (items) =>
      listFormat ? listFormat.format(items) : items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(" ")} และ ${items[items.length - 1]}`,
    dateTime: (d) => (d ? dateTimeFormat.format(toDate(d)) : "–"),
    date(d, options = DEFAULT_DATE_OPTIONS) {
      if (!d) return "–";
      const key = JSON.stringify(options);
      let f = dateFormats.get(key);
      if (!f) {
        f = new Intl.DateTimeFormat(tag, { timeZone, ...options });
        dateFormats.set(key, f);
      }
      return f.format(toDate(d));
    },
    relativeTime(d, now = new Date()) {
      if (!d) return "–";
      const date = toDate(d);
      const sec = Math.round((date.getTime() - now.getTime()) / 1000);
      const abs = Math.abs(sec);
      if (abs < 45) return JUST_NOW[locale];
      if (abs < 3600) return relativeFormat.format(Math.round(sec / 60), "minute");
      if (abs < 86400) return relativeFormat.format(Math.round(sec / 3600), "hour");
      if (abs < 7 * 86400) return relativeFormat.format(Math.round(sec / 86400), "day");
      return self.dateTime(date);
    },
  };
  return self;
}

const cache = new Map<string, Formatters>();

/**
 * ตัวจัดรูปแบบของภาษานั้น (ไม่ใส่ = ไทย) — สร้างครั้งเดียวต่อภาษา/เขตเวลา
 * timeZone ไม่ใส่ = เขตเวลาของระบบ (ฝั่งเซิร์ฟเวอร์) — ในเบราว์เซอร์ให้ใช้ useFormat() แทน
 */
export function formatters(locale: Locale = DEFAULT_LOCALE, timeZone: string = TIME_ZONE): Formatters {
  const key = `${locale}|${timeZone}`;
  let f = cache.get(key);
  if (!f) {
    f = create(locale, timeZone);
    cache.set(key, f);
  }
  return f;
}
