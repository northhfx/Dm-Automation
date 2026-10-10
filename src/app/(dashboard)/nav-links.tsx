"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, ListChecks, Settings, Users, Workflow, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** เมนูหลัก แบ่งเป็น 2 กลุ่ม: งานประจำวัน / ระบบ */
export const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "ภาพรวม", icon: LayoutDashboard },
      { href: "/rules", label: "กฎอัตโนมัติ", icon: Workflow },
      { href: "/contacts", label: "รายชื่อลูกค้า", icon: Users },
      { href: "/activity", label: "กิจกรรม", icon: Activity },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { href: "/guide", label: "คู่มือตั้งค่า", icon: ListChecks },
      { href: "/settings", label: "ตั้งค่า", icon: Settings },
    ],
  },
];

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** ชื่อเมนูของหน้าปัจจุบัน (ใช้เป็นหัวข้อบนแถบด้านบนของมือถือ) */
export function currentNavLabel(pathname: string): string | null {
  for (const group of NAV_GROUPS) for (const item of group.items) if (isActivePath(pathname, item.href)) return item.label;
  return null;
}

export function NavLinks({ onNavigate, setupBadge }: { onNavigate?: () => void; setupBadge?: string | null }) {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูหลัก" className="space-y-5">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi}>
          {group.label && <div className="px-3 pb-1.5 text-xs font-medium text-fg-3">{group.label}</div>}
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
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.href === "/guide" && setupBadge && (
                      <span className="rounded-full bg-warning-soft px-1.5 text-[11px] leading-[18px] font-semibold text-warning-text tabular">
                        {setupBadge}
                      </span>
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
