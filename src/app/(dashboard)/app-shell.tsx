"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ChevronRight, LogOut, Menu as MenuIcon, Rocket, TriangleAlert, X } from "lucide-react";
import { Avatar, cx, IconButton, PlatformIcon, ProgressBar, Spinner } from "@/components/ui";
import { Dialog } from "@/components/dialog";
import { LanguageToggle } from "@/components/language-toggle";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useT } from "@/lib/i18n/client";
import { commonMessages } from "@/lib/i18n/messages/common";
import { navMessages } from "@/lib/i18n/messages/nav";
import { shellMessages } from "@/lib/i18n/messages/shell";
import type { ThemePref } from "@/lib/theme";
import { logout } from "../login/actions";
import { currentNavKey, NavLinks } from "./nav-links";

export interface ShellPage {
  id: string;
  name: string;
  igUsername: string | null;
  /** ยังไม่รับข้อความจากเพจนี้ (subscribe ไม่สำเร็จ) */
  hasError: boolean;
}

/** บัญชี Instagram ที่เชื่อมผ่าน Instagram Login */
export interface ShellInstagram {
  id: string;
  username: string;
  /** critical = ระบบตอบบัญชีนี้ไม่ได้, warning = ยังใช้ได้แต่ควรตรวจสอบ (instagramHealthLevel) */
  status: "critical" | "warning" | "ok";
}

export interface ShellData {
  /** null = อ่านสถานะไม่ได้ (ไม่แสดงการ์ดความคืบหน้า) */
  setup: { done: number; total: number } | null;
  pages: ShellPage[];
  instagram: ShellInstagram[];
  /** ธีมที่ผู้ใช้เลือกไว้ (จาก cookie) */
  theme: ThemePref;
  /** จำนวนข้อความรอตอบ (countOpenInboxItems) — ไม่มี/0 = ไม่แสดงตัวเลขบนเมนู */
  inboxCount?: number;
}

/** หน้าที่เป็นผืนผ้าใบเต็มจอ (ตัวสร้างกฎ): ไม่มีกรอบ/ระยะขอบ และหน้าไม่เลื่อน */
export function isFullBleedPath(pathname: string): boolean {
  return /^\/rules\/(new|\d+)\/?$/.test(pathname);
}

export function AppShell({ data, children }: { data: ShellData; children: ReactNode }) {
  const pathname = usePathname();
  // เก็บ path ที่เปิดลิ้นชักไว้ → เปลี่ยนหน้าเมื่อไร ลิ้นชักปิดเอง
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawerOpen = drawerPath === pathname;
  const fullBleed = isFullBleedPath(pathname);
  const t = useT(shellMessages);
  const tNav = useT(navMessages);
  const navKey = currentNavKey(pathname);
  const title = navKey ? tNav(navKey) : "DM Automation";

  return (
    <div className="min-h-dvh lg:pl-[var(--app-sidebar-w)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("skipToContent")}
      </a>

      {/* เดสก์ท็อป: แถบด้านซ้าย */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--app-sidebar-w)] border-r border-line bg-sidebar lg:flex">
        <SidebarContent data={data} />
      </aside>

      {/* มือถือ/แท็บเล็ต: แถบด้านบน + ลิ้นชักเมนู */}
      <header className="sticky top-0 z-30 flex h-[var(--app-topbar-h)] items-center gap-1 border-b border-line bg-surface/90 px-2 backdrop-blur-md lg:hidden">
        <IconButton icon={<MenuIcon />} label={t("openMenu")} onClick={() => setDrawerPath(pathname)} aria-expanded={drawerOpen} />
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1" aria-label={t("home")}>
          <LogoMark size={28} />
          <span className="truncate text-[15px] font-semibold text-fg">{title}</span>
        </Link>
        {data.setup && data.setup.done < data.setup.total && pathname !== "/guide" && (
          <Link
            href="/guide"
            className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-xs font-semibold text-warning-text"
          >
            <Rocket className="size-3.5" aria-hidden />
            {t("setupChip", { done: data.setup.done, total: data.setup.total })}
          </Link>
        )}
      </header>
      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerPath(null)}
        placement="left"
        ariaLabel={t("menu")}
        hideClose
        bodyClassName="p-0"
      >
        <SidebarContent
          data={data}
          onNavigate={() => setDrawerPath(null)}
          closeButton={<IconButton icon={<X />} label={t("closeMenu")} size="md" onClick={() => setDrawerPath(null)} />}
        />
      </Dialog>

      <main
        id="main"
        className={cx(
          fullBleed
            ? "flex h-[calc(100dvh-var(--app-topbar-h))] min-h-0 flex-col overflow-hidden"
            : "mx-auto w-full max-w-[1200px] px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10",
        )}
      >
        {children}
      </main>
    </div>
  );
}

function SidebarContent({ data, onNavigate, closeButton }: { data: ShellData; onNavigate?: () => void; closeButton?: ReactNode }) {
  const { setup } = data;
  const t = useT(shellMessages);
  const tCommon = useT(commonMessages);
  const incomplete = setup && setup.done < setup.total;
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <Link href="/" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5">
          <LogoMark size={30} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold tracking-tight text-fg">DM Automation</span>
            <span className="block truncate text-[11px] text-fg-3">{tCommon("tagline")}</span>
          </span>
        </Link>
        {closeButton}
      </div>

      <div className="px-3 pb-4">
        <PageChip pages={data.pages} instagram={data.instagram} onNavigate={onNavigate} />
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <NavLinks
          onNavigate={onNavigate}
          setupBadge={incomplete ? `${setup.done}/${setup.total}` : null}
          inboxCount={data.inboxCount ?? 0}
        />
      </div>

      <div className="shrink-0 space-y-2 border-t border-line p-3">
        {incomplete && (
          <Link
            href="/guide"
            onClick={onNavigate}
            className="group block rounded-xl border border-line bg-surface p-3 shadow-xs transition hover:border-line-strong hover:shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-fg">
              <span className="flex size-6 items-center justify-center rounded-md bg-accent-soft text-accent">
                <Rocket className="size-3.5" aria-hidden />
              </span>
              <span className="flex-1">{t("finishSetup")}</span>
              <span className="text-xs text-fg-3 tabular">
                {setup.done}/{setup.total}
              </span>
            </div>
            <ProgressBar value={setup.done} max={setup.total} size="sm" className="mt-2.5" label={t("setupProgress", { done: setup.done, total: setup.total })} />
            <p className="mt-2 flex items-center gap-1 text-xs text-fg-2">
              {t("stepsLeft", { count: setup.total - setup.done })}
              <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </p>
          </Link>
        )}
        {/* ธีม + ภาษา: ป้ายชื่ออยู่คอลัมน์ซ้ายกว้างเท่ากัน ปุ่มสองแถวจึงตรงกัน */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 px-3">
          <span className="text-xs font-medium text-fg-3">{t("theme")}</span>
          <ThemeToggle initial={data.theme} variant="compact" />
          <span className="text-xs font-medium text-fg-3">{t("language")}</span>
          <LanguageToggle variant="compact" />
        </div>
        <form action={logout}>
          <LogoutButton />
        </form>
      </div>
    </div>
  );
}

function LogoutButton() {
  const { pending } = useFormStatus();
  const t = useT(shellMessages);
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-60 lg:h-9"
    >
      {pending ? <Spinner className="size-[18px]" /> : <LogOut className="size-[18px] text-fg-3" strokeWidth={1.9} aria-hidden />}
      {t("logout")}
    </button>
  );
}

/** เพจ / บัญชี Instagram ที่เชื่อมต่ออยู่ (กดเพื่อไปหน้าตั้งค่า) */
function PageChip({ pages, instagram, onNavigate }: { pages: ShellPage[]; instagram: ShellInstagram[]; onNavigate?: () => void }) {
  const t = useT(shellMessages);
  if (pages.length === 0 && instagram.length === 0) {
    return (
      <Link
        href="/settings"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-sm transition-colors hover:border-accent hover:bg-accent-soft/40"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2">
          <PlatformIcon platform="facebook" variant="mono" size={16} className="text-fg-3" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-medium text-fg">{t("noPage")}</span>
          <span className="block text-xs text-accent">{t("connectPage")}</span>
        </span>
      </Link>
    );
  }
  const page = pages[0] as ShellPage | undefined;
  const ig = instagram[0] as ShellInstagram | undefined;
  const anyError = pages.some((p) => p.hasError) || instagram.some((a) => a.status === "critical");
  const anyWarning = !anyError && instagram.some((a) => a.status === "warning");
  // เพจหลัก: ชื่อเพจ + IG (บัญชีที่เชื่อมผ่าน Instagram Login ก่อน ไม่มีค่อยใช้ IG ที่ผูกกับเพจ)
  // ไม่มีเพจ (ใช้แค่ Instagram): @username + "Instagram"
  const title = page ? page.name : `@${ig?.username}`;
  const igUsername = ig?.username ?? page?.igUsername ?? null;
  const extra = page
    ? pages.length > 1
      ? t("morePages", { count: pages.length - 1 })
      : null
    : instagram.length > 1
      ? t("moreAccounts", { count: instagram.length - 1 })
      : null;
  return (
    <Link
      href="/settings"
      onClick={onNavigate}
      title={t("chipTitle")}
      className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-xs transition hover:border-line-strong hover:shadow-sm"
    >
      <span className="relative shrink-0">
        <Avatar name={page ? page.name : ig?.username} size="md" />
        <span className="absolute -right-1 -bottom-1 rounded-full ring-2 ring-surface">
          <PlatformIcon platform={page ? "facebook" : "instagram"} size={14} />
        </span>
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-medium text-fg">{title}</span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-fg-3">
          {anyError || anyWarning ? (
            <>
              <TriangleAlert className="size-3 shrink-0 text-warning-text" aria-hidden />
              <span className="text-warning-text">{anyError ? t("notReady") : t("needsCheck")}</span>
            </>
          ) : !page ? (
            "Instagram"
          ) : igUsername ? (
            <>
              <PlatformIcon platform="instagram" size={12} />
              <span className="truncate">@{igUsername}</span>
            </>
          ) : (
            t("facebookPage")
          )}
          {extra && <span className="shrink-0">· {extra}</span>}
        </span>
      </span>
    </Link>
  );
}
