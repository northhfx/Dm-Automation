import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, type ThemePref } from "@/lib/theme";

/** ธีมที่ผู้ใช้เลือกไว้ (อ่านจากคุกกี้ของคำขอนี้) — ใช้ใน Server Component / generateViewport เท่านั้น */
export async function getThemePref(): Promise<ThemePref> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
