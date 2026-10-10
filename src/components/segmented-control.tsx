"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./ui";

/*
 * ตัวเลือกแบบปุ่มติดกัน (เช่น 7 วัน / 30 วัน / 90 วัน, หรือ คอมเมนต์ / DM)
 * - แบบควบคุมเอง: value + onChange (คีย์บอร์ด: ลูกศรซ้าย/ขวา)
 * - แบบลิงก์ (ใช้ในหน้า Server ได้): ใส่ href ในแต่ละตัวเลือก ไม่ต้องมี onChange
 */

export interface SegmentOption<V extends string = string> {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
  /** ตัวเลขเล็กๆ ต่อท้าย เช่น จำนวนรายการ */
  count?: number;
  /** ถ้ามี จะเป็นลิงก์ไปหน้านั้น */
  href?: string;
  disabled?: boolean;
}

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  block,
  className,
}: {
  options: SegmentOption<V>[];
  value: V;
  onChange?: (value: V) => void;
  /** ชื่อกลุ่มสำหรับโปรแกรมอ่านหน้าจอ เช่น "ช่วงเวลา" */
  label: string;
  size?: "sm" | "md";
  /** ยืดเต็มความกว้าง (แบ่งเท่าๆ กัน) */
  block?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const isLinks = options.some((o) => o.href);
  // ช่องที่รับโฟกัสด้วยปุ่ม Tab: ตัวที่เลือกอยู่ (ถ้าไม่มี ใช้ตัวแรกที่กดได้)
  const selectedIndex = options.findIndex((o) => o.value === value);
  const tabIndexAt = selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled);

  function onKeyDown(e: KeyboardEvent, index: number) {
    if (isLinks) return;
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(index);
    let next: number | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = enabled[(pos + 1) % enabled.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (next === undefined) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange?.(options[next].value);
  }

  const item = (active: boolean, disabled?: boolean) =>
    cx(
      "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[color,background-color,box-shadow] [&_svg]:size-4 [&_svg]:shrink-0",
      // มือถือ: ปุ่มสูงอย่างน้อย 36–40px ให้แตะง่าย, จอใหญ่กลับไปขนาดกะทัดรัด
      size === "sm" ? "h-9 px-2.5 text-[13px] sm:h-7" : "h-10 px-3 text-sm sm:h-8",
      block && "flex-1",
      active ? "bg-surface-raised text-fg shadow-sm ring-1 ring-line" : "text-fg-2 hover:text-fg",
      disabled && "pointer-events-none opacity-50",
    );

  return (
    <div
      role={isLinks ? "group" : "radiogroup"}
      aria-label={label}
      className={cx("no-scrollbar max-w-full gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1", block ? "flex" : "inline-flex", className)}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        const content = (
          <>
            {o.icon}
            <span className="truncate">{o.label}</span>
            {o.count !== undefined && (
              <span className={cx("rounded-full px-1.5 text-xs tabular", active ? "bg-accent-soft text-accent" : "bg-surface-3 text-fg-3")}>
                {o.count}
              </span>
            )}
          </>
        );
        if (o.href) {
          return (
            <Link key={o.value} href={o.href} aria-current={active ? "page" : undefined} className={item(active, o.disabled)} scroll={false}>
              {content}
            </Link>
          );
        }
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={i === tabIndexAt ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange?.(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={item(active, o.disabled)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
