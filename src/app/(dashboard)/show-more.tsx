"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/components/ui";

/*
 * ปุ่ม "แสดงอีก N รายการ" สำหรับรายการยาวในหน้าภาพรวม
 * - table: ส่งแถว <tr> ที่ซ่อนไว้เป็น children และจำนวนคอลัมน์ของตาราง
 * - list: ส่ง <li> ที่ซ่อนไว้เป็น children
 */
export function ShowMore({
  children,
  count,
  noun = "รายการ",
  table,
  listClassName,
}: {
  children: ReactNode;
  count: number;
  noun?: string;
  /** ใช้ภายใน <table>: จำนวนคอลัมน์ */
  table?: { colSpan: number };
  listClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const button = (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      className="inline-flex h-10 w-full items-center justify-center gap-1.5 text-[13px] font-medium text-fg-2 transition-colors hover:bg-surface-2/60 hover:text-fg"
    >
      {open ? "ย่อรายการ" : `แสดงอีก ${count} ${noun}`}
      <ChevronDown className={cx("size-4 transition-transform", open && "rotate-180")} aria-hidden />
    </button>
  );

  if (table) {
    return (
      <>
        <tbody hidden={!open}>{children}</tbody>
        <tbody>
          <tr className="border-t border-line">
            <td colSpan={table.colSpan} className="p-0">
              {button}
            </td>
          </tr>
        </tbody>
      </>
    );
  }
  return (
    <>
      <ul hidden={!open} className={listClassName}>
        {children}
      </ul>
      <div className="border-t border-line">{button}</div>
    </>
  );
}
