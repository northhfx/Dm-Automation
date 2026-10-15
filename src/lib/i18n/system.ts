import { createT, type MessageKey } from "./core";
import type { Locale } from "./locale";
import { systemMessages } from "./messages/system";

/*
 * ข้อความของระบบเบื้องหลัง (หมวด system — ดูหัวไฟล์ messages/system.ts) ใช้ได้ทั้ง Server และ Client
 *
 *   ตอนสร้าง (src/lib/**):  throw new Error(systemMessage("igNoUserId"))
 *                           lastError: systemMessage("igRefreshFailed", { detail: err.message })
 *     → ได้ข้อความภาษาไทยต้นฉบับเสมอ (เก็บลงฐานข้อมูล / เทียบกันในโค้ด ไม่ขึ้นกับภาษาของคนที่เปิดหน้าเว็บ)
 *
 *   ตอนแสดง (หน้าเว็บ):     localizeSystemMessage(row.lastError, locale)
 *     → ภาษาไทยคืนตามเดิม / อังกฤษแปลข้อความที่ตรงแม่แบบ (รวมแถวเก่าในฐานข้อมูล) / ไม่ตรงแม่แบบไหน (เช่น error จาก Meta) คืนตามเดิม
 */

export type SystemKey = MessageKey<typeof systemMessages>;

/** ค่าที่แทนใน {ตัวแปร}: ข้อความเท่านั้น (ตัวเลขให้ String() เอง — จะได้ไม่มีตัวคั่นหลักพันในข้อความที่เก็บ) */
export type SystemVars = Readonly<Record<string, string>>;

const thai = createT(systemMessages, "th");

/** ข้อความต้นฉบับภาษาไทยที่โค้ดเบื้องหลังโยน / คืน / เก็บลงฐานข้อมูล */
export function systemMessage(key: SystemKey, vars?: SystemVars): string {
  return thai(key, vars);
}

/** ตัวแปรที่อาจเป็นข้อความของระบบอีกชั้น → แปลซ้อน (ตัวแปรอื่นเป็นข้อมูล เช่น ชื่อเพจ / รหัส → คงเดิม) */
const NESTED = new Set(["detail", "note"]);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Pattern {
  key: SystemKey;
  names: string[];
  re: RegExp;
}

let patterns: Pattern[] | undefined;

/** แม่แบบ "ต่ออายุ token ไม่สำเร็จ: {detail}" → /^ต่ออายุ token ไม่สำเร็จ: ([\s\S]*?)$/ + รายชื่อตัวแปร (สร้างครั้งแรกที่ใช้) */
function compiled(): Pattern[] {
  patterns ??= (Object.keys(systemMessages.th) as SystemKey[]).map((key) => {
    const names: string[] = [];
    const source = systemMessages.th[key]
      .split(/\{(\w+)\}/)
      .map((part, i) => {
        if (i % 2 === 0) return escapeRegExp(part);
        names.push(part);
        return "([\\s\\S]*?)";
      })
      .join("");
    return { key, names, re: new RegExp(`^${source}$`) };
  });
  return patterns;
}

/**
 * ข้อความของระบบ (ภาษาไทยต้นฉบับ) → ภาษาที่เลือก
 * ไทย = คืนตามเดิมเสมอ, ไม่ตรงแม่แบบไหน = คืนตามเดิม (ข้อความจาก Meta เป็นภาษาอังกฤษอยู่แล้ว)
 */
export function localizeSystemMessage(message: string, locale: Locale): string {
  if (locale === "th") return message;
  const t = createT(systemMessages, locale);
  for (const { key, names, re } of compiled()) {
    const m = re.exec(message);
    if (!m) continue;
    const vars: Record<string, string> = {};
    names.forEach((name, i) => {
      const value = m[i + 1];
      vars[name] = NESTED.has(name) ? localizeSystemMessage(value, locale) : value;
    });
    return t(key, vars);
  }
  return message;
}
