/*
 * ธีมสี: สว่าง / มืด / ตามเครื่อง (ใช้ได้ทั้งฝั่ง Server และ Client — ไฟล์นี้ไม่มี import ฝั่งเซิร์ฟเวอร์)
 * - ค่าที่เลือกเก็บในคุกกี้ "theme" (ไม่มีคุกกี้ = ตามเครื่อง)
 * - root layout ใส่ data-theme="light" | "dark" ที่ <html> ตั้งแต่ฝั่งเซิร์ฟเวอร์ → เปิดหน้ามาไม่กะพริบ
 * - "ตามเครื่อง" ไม่ใส่ data-theme เลย ให้ CSS (@media prefers-color-scheme ใน globals.css) จัดการเอง
 */

export const THEME_COOKIE = "theme";

/** อายุคุกกี้ธีม (วินาที) = 1 ปี */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type ThemePref = "light" | "dark" | "system";

/** ค่าจากคุกกี้ → ธีม (ค่าอื่นที่ไม่ใช่ "light" / "dark" ถือเป็น "ตามเครื่อง") */
export function parseTheme(v: string | undefined | null): ThemePref {
  return v === "light" || v === "dark" ? v : "system";
}

/** สีแถบเบราว์เซอร์บนมือถือ (meta theme-color) — ตรงกับ --surface ใน globals.css ให้กลืนกับแถบด้านบนของแอป */
export const THEME_COLORS = { light: "#ffffff", dark: "#14171d" } as const;

export interface ThemeColorTag {
  media?: string;
  color: string;
}

/**
 * meta theme-color ที่ควรมีสำหรับแต่ละธีม
 * - บังคับสว่าง/มืด: แท็กเดียว ไม่มี media
 * - ตามเครื่อง: สองแท็ก แยกตาม prefers-color-scheme
 */
export function themeColorTags(pref: ThemePref): ThemeColorTag[] {
  if (pref === "system") {
    return [
      { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
      { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
    ];
  }
  return [{ color: THEME_COLORS[pref] }];
}
