import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { createT, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { legalMessages } from "@/lib/i18n/messages/legal";
import { LanguageToggle } from "./language-toggle";
import { LogoMark } from "./logo";
import { cx } from "./ui";

/*
 * หน้าเอกสารสาธารณะ (นโยบายความเป็นส่วนตัว / การลบข้อมูล) — เปิดได้โดยไม่ต้องล็อกอิน
 * เนื้อหาใส่เป็น <h2> <p> <ul> <ol> <a> ธรรมดา ไฟล์นี้จัดรูปแบบให้อ่านง่าย (ความกว้างบรรทัดไม่เกิน ~70 ตัวอักษร)
 * ภาษาตามคุกกี้ "lang" เหมือนหน้าอื่น: หน้าที่เรียกอ่านภาษาด้วย getT("legal") แล้วส่ง locale มา (ไม่ส่ง = ไทย)
 * มีปุ่มเลือกภาษาที่หัวหน้า — ผู้ตรวจของ Meta ที่เปิดลิงก์มาครั้งแรก (ไม่มีคุกกี้ = ไทย) กดเปลี่ยนเป็น English ได้เอง
 */

const DOCS = [
  { href: "/privacy", label: "navPrivacy" },
  { href: "/data-deletion", label: "navDataDeletion" },
] as const;

export type LegalDoc = (typeof DOCS)[number]["href"];

export function LegalPage({
  title,
  subtitle,
  description,
  current,
  brand = "DM Automation",
  locale = DEFAULT_LOCALE,
  children,
}: {
  title: string;
  /** ชื่อภาษาอังกฤษเหนือหัวข้อ เช่น "Privacy Policy" (ผู้ตรวจของ Meta อ่านได้) — แสดงเฉพาะหน้าภาษาไทย (หน้าอังกฤษหัวข้อเป็นชื่อนี้อยู่แล้ว) */
  subtitle?: string;
  description?: ReactNode;
  /** เอกสารที่กำลังเปิด (ไฮไลต์ในแถบเอกสาร) */
  current?: LegalDoc;
  /** ชื่อที่แสดงข้างโลโก้ด้านบน */
  brand?: string;
  /** ภาษาของหน้า (จากคุกกี้ — getT("legal").locale) */
  locale?: Locale;
  children: ReactNode;
}) {
  const t = createT(legalMessages, locale);
  return (
    <div lang={locale} className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2.5 px-4 sm:px-6">
          <LogoMark size={28} />
          <span className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-fg">{brand}</span>
          <div className="ml-auto shrink-0">
            <LanguageToggle variant="compact" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        <Link
          href="/"
          className="-ml-1 inline-flex h-10 items-center gap-0.5 rounded-md px-1 text-sm text-fg-2 transition-colors hover:text-fg"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t("backHome")}
        </Link>

        <div className="mt-2">
          {subtitle && locale !== "en" && (
            <p lang="en" className="text-xs font-semibold tracking-wide text-accent uppercase">
              {subtitle}
            </p>
          )}
          <h1 className="mt-1 text-2xl leading-9 font-semibold tracking-tight text-fg sm:text-[28px] sm:leading-10">{title}</h1>
          {description && <div className="mt-2 max-w-[68ch] text-[15px] leading-7 text-fg-2">{description}</div>}
        </div>

        <nav aria-label={t("relatedDocs")} className="mt-6 flex flex-wrap gap-2">
          {DOCS.map((d) => {
            const active = d.href === current;
            return (
              <Link
                key={d.href}
                href={d.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                  active ? "border-accent/30 bg-accent-soft text-accent" : "border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg",
                )}
              >
                {t(d.label)}
              </Link>
            );
          })}
        </nav>

        <article
          className={cx(
            "mt-6 rounded-xl border border-line bg-surface px-5 py-6 shadow-xs sm:px-10 sm:py-9",
            // จัดรูปแบบเนื้อหาเอกสาร
            "[&>*]:max-w-[68ch] [&>*+*]:mt-4 text-[15px] leading-7 text-fg-2",
            "[&_h2]:text-lg [&_h2]:leading-7 [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-fg [&>h2]:mt-9 [&>h2:first-child]:mt-0 [&>h2+*]:mt-2",
            "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_li]:pl-1 [&_li]:marker:text-fg-3",
            "[&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_a]:decoration-accent/40 [&_a]:underline-offset-2 [&_a:hover]:decoration-accent",
            "[&_strong]:font-semibold [&_strong]:text-fg",
          )}
        >
          {children}
        </article>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-1 px-4 py-3 text-xs text-fg-3 sm:px-6">
          <span className="mr-auto py-2">{brand}</span>
          {DOCS.map((d) => (
            <Link key={d.href} href={d.href} className="inline-flex h-10 items-center rounded-md px-2 transition-colors hover:text-fg">
              {t(d.label)}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
