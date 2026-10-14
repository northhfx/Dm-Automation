import { cookies } from "next/headers";
import { createT, type Catalog, type Messages, type TFunction } from "./core";
import { formatters, type Formatters } from "./format";
import { LOCALE_COOKIE, parseLocale, type Locale } from "./locale";
import { catalogs, mergedCatalog, type AnyKey, type KeyOf, type Namespace } from "./registry";

/*
 * ภาษาฝั่งเซิร์ฟเวอร์ — ใช้ใน Server Component, generateMetadata, Server Action, Route Handler เท่านั้น
 * (อ่านคุกกี้ "lang" ของคำขอนี้ เหมือน getThemePref() ใน src/lib/theme-server.ts)
 *
 *   const t = await getT("nav");        t("dashboard")          → "ภาพรวม" / "Dashboard"
 *   const t = await getT(navMessages);  (ส่งตัวหมวดแทนชื่อก็ได้ ผลเหมือนกัน)
 *   const t = await getT();             t("nav.dashboard")      → key แบบเต็ม ใช้ได้ทุกหมวด
 *   const f = await getFormat();        f.dateTime(row.createdAt), f.number(1234)
 *   const locale = await getLocale();   "th" | "en"
 */

/** ภาษาที่ผู้ใช้เลือกไว้ (ไม่มีคุกกี้ = ไทย) */
export async function getLocale(): Promise<Locale> {
  return parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

export async function getT(): Promise<TFunction<AnyKey>>;
export async function getT<N extends Namespace>(namespace: N): Promise<TFunction<KeyOf<N>>>;
export async function getT<M extends Messages>(catalog: Catalog<M>): Promise<TFunction<keyof M & string>>;
export async function getT(namespace?: Namespace | Catalog): Promise<TFunction> {
  const catalog: Catalog = namespace === undefined ? mergedCatalog() : typeof namespace === "string" ? catalogs[namespace] : namespace;
  return createT(catalog, await getLocale());
}

/** ตัวจัดรูปแบบตัวเลข/วันที่ ตามภาษาของคำขอนี้ */
export async function getFormat(): Promise<Formatters> {
  return formatters(await getLocale());
}
