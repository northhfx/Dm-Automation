"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ChevronRight, LogOut, Menu as MenuIcon, Rocket, TriangleAlert, X } from "lucide-react";
import { Avatar, cx, IconButton, PlatformIcon, ProgressBar, Spinner } from "@/components/ui";
import { Dialog } from "@/components/dialog";
import { LogoMark } from "@/components/logo";
import { logout } from "../login/actions";
import { currentNavLabel, NavLinks } from "./nav-links";

export interface ShellPage {
  id: string;
  name: string;
  igUsername: string | null;
  /** ยังไม่รับข้อความจากเพจนี้ (subscribe ไม่สำเร็จ) */
  hasError: boolean;
}

export interface ShellData {
  /** null = อ่านสถานะไม่ได้ (ไม่แสดงการ์ดความคืบหน้า) */
  setup: { done: number; total: number } | null;
  pages: ShellPage[];
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
  const title = currentNavLabel(pathname) ?? "DM Automation";

  return (
    <div className="min-h-dvh lg:pl-[var(--app-sidebar-w)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        ข้ามไปเนื้อหาหลัก
      </a>

      {/* เดสก์ท็อป: แถบด้านซ้าย */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--app-sidebar-w)] border-r border-line bg-sidebar lg:flex">
        <SidebarContent data={data} />
      </aside>

      {/* มือถือ/แท็บเล็ต: แถบด้านบน + ลิ้นชักเมนู */}
      <header className="sticky top-0 z-30 flex h-[var(--app-topbar-h)] items-center gap-1 border-b border-line bg-surface/90 px-2 backdrop-blur-md lg:hidden">
        <IconButton icon={<MenuIcon />} label="เปิดเมนู" onClick={() => setDrawerPath(pathname)} aria-expanded={drawerOpen} />
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1" aria-label="DM Automation หน้าแรก">
          <LogoMark size={28} />
          <span className="truncate text-[15px] font-semibold text-fg">{title}</span>
        </Link>
        {data.setup && data.setup.done < data.setup.total && pathname !== "/guide" && (
          <Link
            href="/guide"
            className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-xs font-semibold text-warning-text"
          >
            <Rocket className="size-3.5" aria-hidden />
            ตั้งค่า {data.setup.done}/{data.setup.total}
          </Link>
        )}
      </header>
      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerPath(null)}
        placement="left"
        ariaLabel="เมนู"
        hideClose
        bodyClassName="p-0"
      >
        <SidebarContent
          data={data}
          onNavigate={() => setDrawerPath(null)}
          closeButton={<IconButton icon={<X />} label="ปิดเมนู" size="md" onClick={() => setDrawerPath(null)} />}
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
  const incomplete = setup && setup.done < setup.total;
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <Link href="/" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5">
          <LogoMark size={30} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold tracking-tight text-fg">DM Automation</span>
            <span className="block truncate text-[11px] text-fg-3">ตอบแชทอัตโนมัติ</span>
          </span>
        </Link>
        {closeButton}
      </div>

      <div className="px-3 pb-4">
        <PageChip pages={data.pages} onNavigate={onNavigate} />
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <NavLinks onNavigate={onNavigate} setupBadge={incomplete ? `${setup.done}/${setup.total}` : null} />
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
              <span className="flex-1">ตั้งค่าให้เสร็จ</span>
              <span className="text-xs text-fg-3 tabular">
                {setup.done}/{setup.total}
              </span>
            </div>
            <ProgressBar value={setup.done} max={setup.total} size="sm" className="mt-2.5" label={`ตั้งค่าเสร็จ ${setup.done} จาก ${setup.total} ขั้น`} />
            <p className="mt-2 flex items-center gap-1 text-xs text-fg-2">
              อีก {setup.total - setup.done} ขั้นก็พร้อมใช้งาน
              <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </p>
          </Link>
        )}
        <form action={logout}>
          <LogoutButton />
        </form>
      </div>
    </div>
  );
}

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-60 lg:h-9"
    >
      {pending ? <Spinner className="size-[18px]" /> : <LogOut className="size-[18px] text-fg-3" strokeWidth={1.9} aria-hidden />}
      ออกจากระบบ
    </button>
  );
}

/** เพจที่เชื่อมต่ออยู่ (กดเพื่อไปหน้าตั้งค่า) */
function PageChip({ pages, onNavigate }: { pages: ShellPage[]; onNavigate?: () => void }) {
  if (pages.length === 0) {
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
          <span className="block font-medium text-fg">ยังไม่ได้เชื่อมเพจ</span>
          <span className="block text-xs text-accent">เชื่อมต่อเพจ</span>
        </span>
      </Link>
    );
  }
  const page = pages[0];
  const anyError = pages.some((p) => p.hasError);
  return (
    <Link
      href="/settings"
      onClick={onNavigate}
      title="เพจที่เชื่อมต่อ — กดเพื่อจัดการ"
      className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-xs transition hover:border-line-strong hover:shadow-sm"
    >
      <span className="relative shrink-0">
        <Avatar name={page.name} size="md" />
        <span className="absolute -right-1 -bottom-1 rounded-full ring-2 ring-surface">
          <PlatformIcon platform="facebook" size={14} />
        </span>
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-medium text-fg">{page.name}</span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-fg-3">
          {anyError ? (
            <>
              <TriangleAlert className="size-3 shrink-0 text-warning-text" aria-hidden />
              <span className="text-warning-text">ยังไม่พร้อมใช้งาน</span>
            </>
          ) : page.igUsername ? (
            <>
              <PlatformIcon platform="instagram" size={12} />
              <span className="truncate">@{page.igUsername}</span>
            </>
          ) : (
            "Facebook เพจ"
          )}
          {pages.length > 1 && <span className="shrink-0">· +{pages.length - 1} เพจ</span>}
        </span>
      </span>
    </Link>
  );
}
