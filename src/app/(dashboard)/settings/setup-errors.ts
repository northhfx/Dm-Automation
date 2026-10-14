import type { MessageKey, TFunction } from "@/lib/i18n/core";
import { settingsMessages } from "@/lib/i18n/messages/settings";

/*
 * ข้อความ error / ข้อความแจ้งภาษาไทยที่มาจาก lib/instagram/* (รวมถึง lastError ที่เก็บในฐานข้อมูล)
 * โค้ดส่วนนั้นเทียบข้อความกันเอง (เช่น INSTAGRAM_ERRORS) จึงแปลที่ต้นทางไม่ได้ → แปลตอนแสดงผลแทน
 * ภาษาไทยของ key เหล่านี้ใน messages/settings.ts คือต้นฉบับ (ตรงทุกตัวอักษร) ใช้เป็นแม่แบบจับคู่ {ตัวแปร}
 * ไม่ตรงแม่แบบไหนเลย (เช่น ข้อความจาก Meta) → แสดงตามเดิม
 * ใช้ได้ทั้งฝั่ง Server (actions.ts) และ Client (instagram-list-view.tsx)
 */

type SettingsKey = MessageKey<typeof settingsMessages>;

const LIB_MESSAGE_KEYS = [
  "errConnectFailed",
  "libIgTokenInvalid",
  "libIgTokenWrongKind",
  "libIgTokenMissing",
  "libIgTokenFacebook",
  "libIgSecretMissing",
  "libIgTokenNotIg",
  "libIgSubscribeFailed",
  "libIgLinkedNotice",
  "libIgIdMismatch",
  "libIgAccountNotFound",
  "libIgTokenDecrypt",
  "libIgTokenTooNew",
  "libIgTokenRejected",
  "libIgTokenExpired",
  "libIgRefreshFailed",
] as const satisfies readonly SettingsKey[];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** แม่แบบ "ต่ออายุ token ไม่สำเร็จ: {detail}" → /^ต่ออายุ token ไม่สำเร็จ: ([\s\S]*?)$/ + รายชื่อตัวแปร */
const PATTERNS = LIB_MESSAGE_KEYS.map((key) => {
  const names: string[] = [];
  const source = settingsMessages.th[key]
    .split(/\{(\w+)\}/)
    .map((part, i) => {
      if (i % 2 === 0) return escapeRegExp(part);
      names.push(part);
      return "([\\s\\S]*?)";
    })
    .join("");
  return { key, names, re: new RegExp(`^${source}$`) };
});

/** แปลข้อความจาก lib/instagram/* ตามภาษาของ t (ภาษาไทยคืนต้นฉบับเสมอ) */
export function localizeSetupMessage(message: string, t: TFunction<SettingsKey>): string {
  if (t.locale === "th") return message;
  for (const { key, names, re } of PATTERNS) {
    const m = re.exec(message);
    if (m) return t(key, Object.fromEntries(names.map((name, i) => [name, m[i + 1]])));
  }
  return message;
}
