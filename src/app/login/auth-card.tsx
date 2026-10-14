import Link from "next/link";
import type { ReactNode } from "react";
import { ChartNoAxesColumn, Database, MessageCircleReply, Send, Zap } from "lucide-react";
import { CopyField } from "@/components/copy-field";
import { LogoMark } from "@/components/logo";
import { Avatar, Badge, PlatformIcon, cx } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { ReloadButton } from "./login-form";

/*
 * โครงหน้าก่อนเข้าสู่ระบบ (เข้าสู่ระบบ / ตั้งรหัสผ่านครั้งแรก / ยังไม่ได้เชื่อมฐานข้อมูล)
 * - เดสก์ท็อป (lg ขึ้นไป): แบ่งครึ่ง ซ้ายเป็นแผงแนะนำระบบ ขวาเป็นฟอร์ม
 * - มือถือ: โลโก้ + ชื่อระบบอยู่เหนือการ์ดฟอร์ม
 */

const PRODUCT_NAME = "DM Automation";

export async function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const t = await getT("auth");
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <BrandPanel />
      <main className="flex min-h-dvh min-w-0 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-4 pt-10 pb-6 sm:px-6 sm:pt-14">
          <div className={cx("w-full", wide ? "max-w-[520px]" : "max-w-[400px]")}>
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <LogoMark size={44} />
              <p className="mt-3 text-lg leading-7 font-semibold tracking-tight text-fg">{PRODUCT_NAME}</p>
              <p className="mt-0.5 text-sm leading-6 text-fg-2">
                {t("taglineLine1")}
                <br />
                {t("taglineLine2")}
              </p>
            </div>
            {children}
          </div>
        </div>
        <AuthFooter />
      </main>
    </div>
  );
}

/** การ์ดฟอร์มกลางหน้า — eyebrow = ป้ายเล็กเหนือหัวข้อ, footer = ส่วนท้ายในการ์ด (เช่น "ลืมรหัสผ่าน?") */
export function AuthCard({
  title,
  description,
  eyebrow,
  footer,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AuthShell>
      <div className="rounded-2xl border border-line bg-surface shadow-sm">
        <div className="p-6 sm:p-8">
          {eyebrow && <div className="mb-4">{eyebrow}</div>}
          <h1 className="text-2xl leading-9 font-semibold tracking-tight text-fg">{title}</h1>
          {description && <p className="mt-1.5 text-sm leading-6 text-fg-2">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="border-t border-line px-6 sm:px-8">{footer}</div>}
      </div>
    </AuthShell>
  );
}

async function AuthFooter() {
  const t = await getT("auth");
  const link = "inline-flex h-10 items-center rounded-md px-2 transition-colors hover:text-fg";
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-1 px-4 pb-4 text-xs text-fg-3">
      <Link href="/privacy" className={link}>
        {t("privacy")}
      </Link>
      <span aria-hidden>·</span>
      <Link href="/data-deletion" className={link}>
        {t("dataDeletion")}
      </Link>
    </footer>
  );
}

// ---------------- แผงแนะนำระบบ (เดสก์ท็อปเท่านั้น) ----------------

const FEATURES = [
  { icon: <MessageCircleReply aria-hidden />, label: "featureReplies" },
  { icon: <Send aria-hidden />, label: "featureDm" },
  { icon: <ChartNoAxesColumn aria-hidden />, label: "featureStats" },
] as const;

async function BrandPanel() {
  const [t, tCommon] = await Promise.all([getT("auth"), getT("common")]);
  return (
    <aside className="relative hidden min-w-0 overflow-hidden border-r border-line bg-surface lg:flex lg:flex-col">
      {/* พื้นหลังลายจุดแบบเดียวกับหน้าสร้างกฎ + แสงสีหลักจางๆ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, color-mix(in oklab, var(--fg-3) 28%, transparent) 1px, transparent 1.4px)",
          backgroundSize: "20px 20px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 100%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -top-48 -left-48 size-[560px] rounded-full bg-accent/10 blur-3xl" />

      <div className="relative flex flex-1 flex-col px-12 py-10 xl:px-16">
        <div className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight text-fg">{PRODUCT_NAME}</span>
            <span className="block text-[11px] text-fg-3">{tCommon("tagline")}</span>
          </span>
        </div>

        <div className="my-auto w-full max-w-[480px] py-12">
          <p className="text-[28px] leading-[1.4] font-semibold tracking-tight text-fg">
            {t("headlineLine1")}
            <br />
            {t("headlineLine2")}
          </p>
          <p className="mt-3 text-[15px] leading-7 text-fg-2">{t("brandBody")}</p>
          <ChatPreview />
        </div>

        <ul className="grid grid-cols-3 gap-4 border-t border-line pt-6">
          {FEATURES.map((f) => (
            <li key={f.label} className="flex flex-col items-start gap-2 text-sm leading-5 text-fg-2 xl:flex-row xl:items-center xl:gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent [&_svg]:size-4">
                {f.icon}
              </span>
              {t(f.label)}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** ภาพตัวอย่าง: คอมเมนต์ → ตอบใต้คอมเมนต์ → ส่ง DM พร้อมปุ่ม (เป็นภาพประกอบเท่านั้น กดไม่ได้) */
async function ChatPreview() {
  const t = await getT("auth");
  const bubble = "rounded-2xl rounded-tl-md px-3 py-2 text-sm leading-6";
  return (
    <div aria-hidden className="mt-10 select-none">
      <div className="w-[88%] rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-fg-3">
          <PlatformIcon platform="instagram" size={14} />
          {t("previewCommentLabel")}
        </div>
        <div className="mt-3 flex items-start gap-2.5">
          <Avatar name={t("previewCustomer")} size="md" />
          <div className={cx(bubble, "bg-surface-2")}>
            <span className="block text-xs font-semibold text-fg">{t("previewCustomer")}</span>
            <span className="text-fg-2">{t("previewComment")}</span>
          </div>
        </div>
        <div className="mt-2 ml-[42px] flex items-start gap-2">
          <Avatar name={t("previewShop")} size="sm" />
          <div className={cx(bubble, "bg-accent-soft text-fg")}>{t("previewReply")}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 py-2 pl-9">
        <span className="h-8 border-l-2 border-dashed border-accent/40" />
        <Badge tone="accent" icon={<Zap aria-hidden />}>
          {t("previewAutoDm")}
        </Badge>
      </div>

      <div className="ml-auto w-[88%] rounded-xl border border-line bg-surface p-4 shadow-md">
        <div className="flex items-center gap-1.5 text-xs text-fg-3">
          <PlatformIcon platform="instagram" size={14} />
          {t("previewDmLabel")}
        </div>
        <div className={cx(bubble, "mt-3 bg-surface-2 text-fg")}>{t("previewDm")}</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[t("previewButtonPrice"), t("previewButtonOrder")].map((label) => (
            <span
              key={label}
              className="rounded-lg border border-line-strong bg-surface py-1.5 text-center text-sm font-medium text-accent"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- ยังไม่ได้เชื่อมฐานข้อมูล ----------------

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-fg-2 tabular ring-1 ring-line ring-inset">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-sm leading-7 text-fg-2 [&_b]:font-semibold [&_b]:text-fg">{children}</div>
    </li>
  );
}

/** แสดงเมื่อยังไม่ได้เชื่อมฐานข้อมูลบน Railway (ผู้ใช้จะเห็นหน้านี้แทนหน้า error) */
export async function MissingDatabase() {
  const t = await getT("auth");
  return (
    <AuthShell wide>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-xl bg-warning-soft text-warning-text [&_svg]:size-[22px]">
          <Database aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl leading-9 font-semibold tracking-tight text-fg">{t("noDbTitle")}</h1>
        <p className="mt-1.5 text-sm leading-6 text-fg-2">{t("noDbDescription")}</p>

        <ol className="mt-6 space-y-5">
          <Step n={1}>{t.rich("noDbStep1", { create: <b>+ Create</b>, database: <b>Database</b>, postgres: <b>PostgreSQL</b> })}</Step>
          <Step n={2}>{t.rich("noDbStep2", { variables: <b>Variables</b> })}</Step>
          <Step n={3}>
            {t.rich("noDbStep3", { newVariable: <b>+ New Variable</b> })}
            <div className="mt-3 space-y-3">
              <CopyField label={t("variableName")} value="DATABASE_URL" />
              <CopyField label={t("variableValue")} value={"${{Postgres.DATABASE_URL}}"} />
            </div>
          </Step>
          <Step n={4}>{t.rich("noDbStep4", { deploy: <b>Deploy</b> })}</Step>
        </ol>

        <div className="mt-6 border-t border-line pt-5">
          <ReloadButton />
        </div>
      </div>
    </AuthShell>
  );
}
