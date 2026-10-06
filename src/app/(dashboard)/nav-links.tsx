"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/", label: "ภาพรวม" },
  { href: "/rules", label: "กฎอัตโนมัติ" },
  { href: "/contacts", label: "รายชื่อลูกค้า" },
  { href: "/activity", label: "กิจกรรม" },
  { href: "/settings", label: "ตั้งค่า" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3 md:pb-0">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cx(
              "rounded-lg px-3 py-2 text-sm whitespace-nowrap",
              active ? "bg-accent-soft font-medium text-accent" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
