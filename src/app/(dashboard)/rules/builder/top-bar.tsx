"use client";

import Link from "next/link";
import type { MouseEvent, Ref } from "react";
import { ArrowLeft, Check, Copy, Save, Trash2 } from "lucide-react";
import { Menu, MenuItem, MenuSeparator } from "@/components/menu";
import { Switch } from "@/components/switch";
import { Button, cx, formatNumber, formatPercent } from "@/components/ui";
import { deleteRule, duplicateRule } from "../actions";
import type { RuleSummaryStats } from "./overview-panel";

interface Props {
  ruleId?: number;
  name: string;
  nameRef: Ref<HTMLInputElement>;
  nameInvalid: boolean;
  active: boolean;
  dirty: boolean;
  pending: boolean;
  stats?: RuleSummaryStats;
  onName: (name: string) => void;
  onActive: (active: boolean) => void;
  onSave: () => void;
  /** กดกลับขณะมีการแก้ที่ยังไม่บันทึก */
  onLeave: (e: MouseEvent<HTMLAnchorElement>) => void;
}

export function TopBar({ ruleId, name, nameRef, nameInvalid, active, dirty, pending, stats, onName, onActive, onSave, onLeave }: Props) {
  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:gap-3 sm:px-4">
      <Link
        href="/rules"
        onClick={onLeave}
        aria-label="กลับไปหน้ากฎทั้งหมด"
        title="กฎทั้งหมด"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </Link>
      <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={100}
          aria-label="ชื่อกฎ"
          aria-invalid={nameInvalid || undefined}
          placeholder="ตั้งชื่อกฎ เช่น คอมเมนต์ สนใจ → ส่งลิงก์"
          className={cx(
            "block h-9 w-full min-w-0 truncate rounded-lg border border-transparent bg-transparent px-2 text-base font-semibold text-fg transition-colors placeholder:font-normal placeholder:text-fg-3 hover:border-line focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15 focus:outline-none sm:text-[17px]",
            nameInvalid && "placeholder:text-critical-text/70",
          )}
        />
        {stats && (
          <p className="hidden truncate px-2 text-xs text-fg-3 tabular sm:block">
            ทำงาน {formatNumber(stats.triggers)} ครั้ง · CTR {formatPercent(stats.ctr)}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <span className="hidden md:block">
          <Switch checked={active} onChange={onActive} label="เปิดใช้งาน" size="sm" />
        </span>
        <span className="md:hidden">
          <Switch checked={active} onChange={onActive} label="เปิดใช้งาน" hideLabel size="sm" />
        </span>

        <span
          aria-live="polite"
          className={cx("hidden items-center gap-1.5 text-xs whitespace-nowrap lg:flex", dirty ? "text-warning-text" : "text-fg-3")}
        >
          {dirty ? (
            <>
              <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
              ยังไม่ได้บันทึก
            </>
          ) : ruleId ? (
            <>
              <Check size={14} aria-hidden="true" />
              บันทึกแล้ว
            </>
          ) : null}
        </span>

        {ruleId && (
          <Menu label="ตัวเลือกของกฎนี้">
            <MenuItem
              action={duplicateRule}
              fields={{ id: ruleId }}
              icon={<Copy />}
              hint={dirty ? "ฉบับที่บันทึกล่าสุด" : undefined}
              successMessage="ทำสำเนาแล้ว (ปิดไว้ก่อน)"
            >
              ทำสำเนา
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              action={deleteRule}
              fields={{ id: ruleId }}
              icon={<Trash2 />}
              tone="danger"
              confirm={{ title: "ลบกฎนี้?", description: "การ์ดและสถิติของกฎนี้จะหายไป ลบแล้วกู้คืนไม่ได้", confirmLabel: "ลบกฎ" }}
              successMessage="ลบกฎแล้ว"
            >
              ลบกฎ
            </MenuItem>
          </Menu>
        )}

        <Button onClick={onSave} loading={pending} icon={<Save />} title="บันทึก (Ctrl+S)" className="relative max-sm:px-3">
          {pending ? (
            <>
              <span className="sm:hidden">บันทึก</span>
              <span className="max-sm:hidden">กำลังบันทึก…</span>
            </>
          ) : (
            "บันทึก"
          )}
          {dirty && !pending && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-warning lg:hidden" aria-hidden="true" />
          )}
        </Button>
      </div>
    </header>
  );
}
