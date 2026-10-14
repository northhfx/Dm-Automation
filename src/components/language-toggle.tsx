"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/locale";
import { appearanceMessages } from "@/lib/i18n/messages/appearance";
import { SegmentedControl } from "./segmented-control";
import { cx } from "./ui";

/*
 * ปุ่มเลือกภาษา: ไทย | English
 * - กดแล้วเขียนคุกกี้ "lang" แล้ว router.refresh() → Server Component ทุกตัวเรนเดอร์ใหม่ด้วยภาษาใหม่
 *   (root layout ส่งภาษาใหม่ให้ I18nProvider → Client Component เปลี่ยนตามเอง) ไม่ต้องโหลดหน้าใหม่ทั้งหน้า
 * - ระหว่างรอเซิร์ฟเวอร์ ปุ่มแสดงภาษาที่เลือกไปก่อน (useOptimistic)
 * - ชื่อภาษาเขียนเป็นภาษาของตัวเองเสมอ (ไทย / English) คนที่อ่านอีกภาษาไม่ออกจะได้หาทางกลับเจอ
 * - วางได้หลายที่ (แถบเมนู + หน้าตั้งค่า) ทุกอันอ่านภาษาจาก I18nProvider ตัวเดียวกัน
 */

function writeCookie(locale: Locale) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function LanguageToggle({
  variant = "full",
  className,
}: {
  /** full = ปุ่มขนาดปกติ (หน้าตั้งค่า), compact = ปุ่มเล็ก (แถบเมนูด้านข้างที่แคบ) */
  variant?: "full" | "compact";
  className?: string;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useT(appearanceMessages);
  const [shown, setShown] = useOptimistic(locale);
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === shown) return;
    writeCookie(next);
    // ให้โปรแกรมอ่านหน้าจอ / currentLocale() รู้ภาษาใหม่ทันที (root layout จะใส่ค่าเดียวกันหลัง refresh)
    document.documentElement.lang = next;
    startTransition(() => {
      setShown(next);
      router.refresh();
    });
  }

  return (
    <>
      <SegmentedControl
        label={t("languageLabel")}
        options={LOCALES.map((l) => ({
          value: l,
          // lang: ให้โปรแกรมอ่านหน้าจออ่านชื่อภาษาด้วยสำเนียงที่ถูก
          label: <span lang={l}>{LOCALE_NAMES[l]}</span>,
        }))}
        value={shown}
        onChange={choose}
        size={variant === "compact" ? "sm" : "md"}
        block
        // แถบด้านซ้ายแคบ (ป้าย "Language" ภาษาอังกฤษกินที่) — ให้ "English" กว้างตามข้อความ ไม่ถูกตัดเป็น "Engli…"
        equalWidth={variant !== "compact"}
        className={cx("transition-opacity", pending && "opacity-70", className)}
      />
      {/* sr-only เป็น position:absolute จึงไม่กินช่องในแถว grid/flex ของผู้เรียก */}
      <span role="status" className="sr-only">
        {pending ? t("languageSwitching") : ""}
      </span>
    </>
  );
}
