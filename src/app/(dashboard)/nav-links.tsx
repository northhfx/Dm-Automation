"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Inbox, LayoutDashboard, ListChecks, Settings, Users, Workflow, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui";
import { useFormat, useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/core";
import { navMessages } from "@/lib/i18n/messages/nav";

type NavKey = MessageKey<typeof navMessages>;

interface NavItem {
  href: string;
  /** key ใน navMessages (src/lib/i18n/messages/nav.ts) */
  label: NavKey;
  icon: LucideIcon;
}

/** เมนูหลัก แบ่งเป็น 2 กลุ่ม: งานประจำวัน / ระบบ */
export const NAV_GROUPS: { label?: NavKey; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "dashboard", icon: LayoutDashboard },
      { href: "/rules", label: "automation", icon: Workflow },
      { href: "/contacts", label: "contacts", icon: Users },
      { href: "/inbox", label: "inbox", icon: Inbox },
      { href: "/activity", label: "activity", icon: Activity },
    ],
  },
  {
    label: "groupSystem",
    items: [
      { href: "/guide", label: "guide", icon: ListChecks },
      { href: "/settings", label: "settings", icon: Settings },
    ],
  },
];

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** key ชื่อเมนูของหน้าปัจจุบัน (ใช้เป็นหัวข้อบนแถบด้านบนของมือถือ) — แปลด้วย useT(navMessages) */
export function currentNavKey(pathname: string): NavKey | null {
  for (const group of NAV_GROUPS) for (const item of group.items) if (isActivePath(pathname, item.href)) return item.label;
  return null;
}

/** ตัวเลขบนเมนูไม่เกิน 2 หลัก (100 ขึ้นไปแสดง "99+") */
const BADGE_MAX = 99;

export function NavLinks({
  onNavigate,
  setupBadge,
  inboxCount = 0,
}: {
  onNavigate?: () => void;
  setupBadge?: string | null;
  /** จำนวนข้อความรอตอบ (0 = ไม่แสดงตัวเลข) */
  inboxCount?: number;
}) {
  const pathname = usePathname();
  const t = useT(navMessages);
  const f = useFormat();
  return (
    <nav aria-label={t("mainMenu")} className="space-y-5">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi}>
          {group.label && <div className="px-3 pb-1.5 text-xs font-medium text-fg-3">{t(group.label)}</div>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors lg:h-9",
                      active ? "bg-accent-soft text-accent" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Icon
                      aria-hidden
                      strokeWidth={1.9}
                      className={cx("size-[18px] shrink-0", active ? "text-accent" : "text-fg-3 group-hover:text-fg-2")}
                    />
                    <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
                    {item.href === "/guide" && setupBadge && (
                      <span className="rounded-full bg-warning-soft px-1.5 text-[11px] leading-[18px] font-semibold text-warning-text tabular">
                        {setupBadge}
                      </span>
                    )}
                    {item.href === "/inbox" && inboxCount > 0 && (
                      <>
                        <span
                          aria-hidden
                          className="min-w-[18px] rounded-full bg-accent px-1.5 text-center text-[11px] leading-[18px] font-semibold text-accent-fg tabular"
                        >
                          {inboxCount > BADGE_MAX ? `${BADGE_MAX}+` : f.number(inboxCount)}
                        </span>
                        <span className="sr-only">{`(${t("inboxWaiting", { count: inboxCount })})`}</span>
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
