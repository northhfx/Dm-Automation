import Link from "next/link";
import type { ReactNode } from "react";
import { ChartNoAxesColumn, Database, MessageCircleReply, Send, Zap } from "lucide-react";
import { CopyField } from "@/components/copy-field";
import { LogoMark } from "@/components/logo";
import { Avatar, Badge, PlatformIcon, cx } from "@/components/ui";
import { ReloadButton } from "./login-form";

/*
 * โครงหน้าก่อนเข้าสู่ระบบ (เข้าสู่ระบบ / ตั้งรหัสผ่านครั้งแรก / ยังไม่ได้เชื่อมฐานข้อมูล)
 * - เดสก์ท็อป (lg ขึ้นไป): แบ่งครึ่ง ซ้ายเป็นแผงแนะนำระบบ ขวาเป็นฟอร์ม
 * - มือถือ: โลโก้ + ชื่อระบบอยู่เหนือการ์ดฟอร์ม
 */

const PRODUCT_NAME = "DM Automation";
const TAGLINE = "ตอบคอมเมนต์และส่ง DM อัตโนมัติ บน Facebook และ Instagram";

export function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <BrandPanel />
      <main className="flex min-h-dvh min-w-0 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-4 pt-10 pb-6 sm:px-6 sm:pt-14">
          <div className={cx("w-full", wide ? "max-w-[520px]" : "max-w-[400px]")}>
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <LogoMark size={44} />
              <p className="mt-3 text-lg leading-7 font-semibold tracking-tight text-fg">{PRODUCT_NAME}</p>
              <p className="mt-0.5 max-w-xs text-sm leading-6 text-fg-2">{TAGLINE}</p>
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

function AuthFooter() {
  const link = "inline-flex h-10 items-center rounded-md px-2 transition-colors hover:text-fg";
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-1 px-4 pb-4 text-xs text-fg-3">
      <Link href="/privacy" className={link}>
        นโยบายความเป็นส่วนตัว
      </Link>
      <span aria-hidden>·</span>
      <Link href="/data-deletion" className={link}>
        การลบข้อมูล
      </Link>
    </footer>
  );
}

// ---------------- แผงแนะนำระบบ (เดสก์ท็อปเท่านั้น) ----------------

const FEATURES = [
  { icon: <MessageCircleReply aria-hidden />, label: "ตอบคอมเมนต์ให้เอง" },
  { icon: <Send aria-hidden />, label: "ส่ง DM พร้อมปุ่มกด" },
  { icon: <ChartNoAxesColumn aria-hidden />, label: "ดูสถิติได้ทุกวัน" },
];

function BrandPanel() {
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
            <span className="block text-[11px] text-fg-3">ตอบแชทอัตโนมัติ</span>
          </span>
        </div>

        <div className="my-auto w-full max-w-[460px] self-center py-12">
          <p className="text-[28px] leading-[1.4] font-semibold tracking-tight text-fg">
            ลูกค้าคอมเมนต์ปุ๊บ
            <br />
            ตอบกลับและส่ง DM ให้ทันที
          </p>
          <p className="mt-3 text-[15px] leading-7 text-fg-2">
            ตั้งกฎครั้งเดียว ระบบจะตอบคอมเมนต์และส่งข้อความบน Facebook และ Instagram ให้ร้านคุณตลอด 24 ชั่วโมง
          </p>
          <ChatPreview />
        </div>

        <ul className="grid grid-cols-3 gap-4 border-t border-line pt-6">
          {FEATURES.map((f) => (
            <li key={f.label} className="flex items-center gap-2.5 text-sm leading-5 text-fg-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent [&_svg]:size-4">
                {f.icon}
              </span>
              {f.label}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** ภาพตัวอย่าง: คอมเมนต์ → ตอบใต้คอมเมนต์ → ส่ง DM พร้อมปุ่ม (เป็นภาพประกอบเท่านั้น กดไม่ได้) */
function ChatPreview() {
  const bubble = "rounded-2xl rounded-tl-md px-3 py-2 text-sm leading-6";
  return (
    <div aria-hidden className="mt-10 select-none">
      <div className="w-[88%] rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-fg-3">
          <PlatformIcon platform="instagram" size={14} />
          คอมเมนต์ใต้โพสต์
        </div>
        <div className="mt-3 flex items-start gap-2.5">
          <Avatar name="มะลิ" size="md" />
          <div className={cx(bubble, "bg-surface-2")}>
            <span className="block text-xs font-semibold text-fg">มะลิ</span>
            <span className="text-fg-2">สนใจค่ะ ราคาเท่าไหร่คะ</span>
          </div>
        </div>
        <div className="mt-2 ml-[42px] flex items-start gap-2">
          <Avatar name="ร้านของคุณ" size="sm" />
          <div className={cx(bubble, "bg-accent-soft text-fg")}>ส่งรายละเอียดทาง DM แล้วนะคะ</div>
        </div>
      </div>

      <div className="flex items-center gap-3 py-2 pl-9">
        <span className="h-8 border-l-2 border-dashed border-accent/40" />
        <Badge tone="accent" icon={<Zap aria-hidden />}>
          ส่ง DM อัตโนมัติ
        </Badge>
      </div>

      <div className="ml-auto w-[88%] rounded-xl border border-line bg-surface p-4 shadow-md">
        <div className="flex items-center gap-1.5 text-xs text-fg-3">
          <PlatformIcon platform="instagram" size={14} />
          ข้อความส่วนตัว
        </div>
        <div className={cx(bubble, "mt-3 bg-surface-2 text-fg")}>สวัสดีค่ะคุณมะลิ ราคาและโปรวันนี้อยู่ด้านล่างเลยค่ะ</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {["ดูราคา", "สั่งซื้อเลย"].map((label) => (
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
export function MissingDatabase() {
  return (
    <AuthShell wide>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-xl bg-warning-soft text-warning-text [&_svg]:size-[22px]">
          <Database aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl leading-9 font-semibold tracking-tight text-fg">อีกนิดเดียว: ยังไม่ได้เชื่อมฐานข้อมูล</h1>
        <p className="mt-1.5 text-sm leading-6 text-fg-2">ระบบเปิดขึ้นแล้ว แต่ยังหาฐานข้อมูลไม่เจอ ทำตาม 4 ขั้นนี้ใน Railway</p>

        <ol className="mt-6 space-y-5">
          <Step n={1}>
            ในโปรเจกต์ กด <b>+ Create</b> (หรือ + New) → <b>Database</b> → <b>PostgreSQL</b> (ถ้ายังไม่มี)
          </Step>
          <Step n={2}>
            คลิกกล่องของแอป (ไม่ใช่กล่อง Postgres) → แท็บ <b>Variables</b>
          </Step>
          <Step n={3}>
            กด <b>+ New Variable</b> แล้วคัดลอก 2 ค่านี้ไปวาง
            <div className="mt-3 space-y-3">
              <CopyField label="ชื่อ" value="DATABASE_URL" />
              <CopyField label="ค่า" value={"${{Postgres.DATABASE_URL}}"} />
            </div>
          </Step>
          <Step n={4}>
            กด <b>Deploy</b> แล้วรอสักครู่ จากนั้นกดปุ่มด้านล่าง
          </Step>
        </ol>

        <div className="mt-6 border-t border-line pt-5">
          <ReloadButton />
        </div>
      </div>
    </AuthShell>
  );
}
