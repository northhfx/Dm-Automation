import { createElement, Fragment, type ReactNode } from "react";
import { formatters } from "./format";
import { DEFAULT_LOCALE, type Locale } from "./locale";

/*
 * แกนกลางของการแปลภาษา (ใช้ได้ทั้ง Server และ Client)
 *
 * 1) ประกาศข้อความของแต่ละหมวด (namespace) ใน src/lib/i18n/messages/<หมวด>.ts
 *      export const navMessages = defineMessages({
 *        th: { inbox: "ข้อความรอตอบ", waiting: "รอตอบ {count} รายการ" },
 *        en: { inbox: "Inbox", waiting: "Waiting for a reply: {count}" },
 *      });
 *    en ต้องมี key ครบและตรงกับ th ทุกตัว (ขาดหรือเกิน → TypeScript แจ้ง error)
 *
 * 2) แปล:  t("inbox") → "ข้อความรอตอบ" / "Inbox"
 *          t("waiting", { count: 1200 }) → "รอตอบ 1,200 รายการ" (ตัวเลขใส่ตัวคั่นหลักพันให้เอง — ไม่อยากได้ให้ส่งเป็น string)
 *          t.rich("hello", { name: <b>มะลิ</b> }) → ReactNode (ใส่ element ในข้อความได้ เช่น ตัวหนา / ลิงก์)
 *          t.locale → "th" | "en" (ส่งต่อให้ formatters(t.locale) ได้)
 *    {ชื่อ} ที่ไม่ได้ส่งค่ามา จะคงไว้ตามเดิม (เห็นง่ายว่าลืมส่ง)
 *
 * 3) ได้ t มาจาก:  Server → await getT("nav")   Client → useT(navMessages)
 *    โค้ดที่ไม่ใช่ทั้งสองแบบ (ฟังก์ชันธรรมดา) แต่รู้ภาษาแล้ว → createT(navMessages, locale)
 */

export type Messages = Record<string, string>;

/** ข้อความของหมวดหนึ่ง: th เป็นต้นฉบับ, en มี key เดียวกันทุกตัว */
export interface Catalog<M extends Messages = Messages> {
  readonly th: M;
  readonly en: { readonly [K in keyof M]: string };
}

/** key ทั้งหมดของหมวด เช่น MessageKey<typeof navMessages> = "dashboard" | "automation" | ... */
export type MessageKey<C> = C extends Catalog<infer M> ? keyof M & string : never;

/** ค่าที่แทนใน {ชื่อ} — ตัวเลขจะจัดรูปแบบตามภาษา (1,234) */
export type Vars = Readonly<Record<string, string | number>>;

/** ค่าที่แทนใน {ชื่อ} ของ t.rich — ใส่ element ได้ */
export type RichVars = Readonly<Record<string, ReactNode>>;

export interface TFunction<K extends string = string> {
  (key: K, vars?: Vars): string;
  /** เหมือน t() แต่ค่าที่แทนเป็น ReactNode ได้ เช่น t.rich("step", { button: <b>Deploy</b> }) */
  rich(key: K, vars: RichVars): ReactNode;
  readonly locale: Locale;
}

/**
 * ประกาศข้อความของหมวด — en ต้องมี key ตรงกับ th ทุกตัว (TypeScript ตรวจให้)
 * NoInfer: ให้ TypeScript อ่านรายชื่อ key จาก th เท่านั้น แล้วเอา en มาเทียบ
 */
export function defineMessages<M extends Messages>(catalog: { th: M; en: NoInfer<{ [K in keyof M]: string }> }): Catalog<M> {
  return catalog;
}

const PLACEHOLDER = /\{(\w+)\}/g;

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** ชื่อตัวแปรทั้งหมดในข้อความ: "รอตอบ {count} จาก {total}" → ["count", "total"] */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

function display(value: string | number, locale: Locale): string {
  return typeof value === "number" ? formatters(locale).number(value) : value;
}

/** แทน {ชื่อ} ด้วยค่าจาก vars (ไม่มีค่า → คงไว้ตามเดิม) */
export function interpolate(template: string, vars: Vars | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (whole, name: string) =>
    hasOwn(vars, name) ? display(vars[name], locale) : whole,
  );
}

function interpolateRich(template: string, vars: RichVars, locale: Locale): ReactNode {
  // split ด้วย regex ที่มีวงเล็บจับ → ช่องคี่คือชื่อตัวแปร
  const parts = template.split(/\{(\w+)\}/);
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (i % 2 === 0) {
      if (part) nodes.push(part);
    } else if (hasOwn(vars, part)) {
      const value = vars[part];
      nodes.push(typeof value === "number" ? display(value, locale) : value);
    } else {
      nodes.push(`{${part}}`);
    }
  });
  // ส่งเป็น children ทีละตัว (ไม่ใช่ array) React จึงไม่ต้องการ key
  return createElement(Fragment, null, ...nodes);
}

const translators = new WeakMap<object, Partial<Record<Locale, TFunction>>>();

/**
 * ตัวแปลของหมวดในภาษาที่กำหนด (สร้างครั้งเดียวต่อหมวด/ภาษา จึงได้ฟังก์ชันตัวเดิมทุกครั้ง)
 * ไม่มีคำแปลภาษาที่เลือก → ใช้ภาษาไทย → ไม่มีเลย → แสดง key
 */
export function createT<M extends Messages>(catalog: Catalog<M>, locale: Locale = DEFAULT_LOCALE): TFunction<keyof M & string> {
  let byLocale = translators.get(catalog);
  if (!byLocale) {
    byLocale = {};
    translators.set(catalog, byLocale);
  }
  const cached = byLocale[locale];
  if (cached) return cached;

  const primary = catalog[locale] as Messages;
  const fallback = catalog.th as Messages;
  const lookup = (key: string): string => (hasOwn(primary, key) ? primary[key] : hasOwn(fallback, key) ? fallback[key] : key);
  const t = ((key: string, vars?: Vars) => interpolate(lookup(key), vars, locale)) as TFunction;
  Object.defineProperties(t, {
    rich: { value: (key: string, vars: RichVars) => interpolateRich(lookup(key), vars, locale) },
    locale: { value: locale, enumerable: true },
  });
  byLocale[locale] = t;
  return t;
}
