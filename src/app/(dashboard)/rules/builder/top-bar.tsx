"use client";

import Link from "next/link";
import type { Ref } from "react";
import { ArrowLeft, CalendarClock, Check, Copy, Save, Trash2 } from "lucide-react";
import { Menu, MenuItem, MenuSeparator } from "@/components/menu";
import { Switch } from "@/components/switch";
import { Button, cx } from "@/components/ui";
import { useFormat, useT } from "@/lib/i18n/client";
import { commonMessages } from "@/lib/i18n/messages/common";
import { rulesMessages } from "@/lib/i18n/messages/rules";
import { folderHref } from "@/lib/rules/folders";
import { deleteRule, duplicateRule } from "../actions";
import type { RuleSummaryStats } from "./overview-panel";

interface Props {
  ruleId?: number;
  /** กฎอยู่ในโฟลเดอร์ → ปุ่มย้อนกลับไปหน้าโฟลเดอร์นั้น */
  folder?: { id: number; name: string };
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
  /** ตั้งเวลาของกฎ (ISO) — ปุ่ม "ตั้งเวลา" แสดงวันปิด/เริ่มถ้าตั้งไว้ */
  schedule: { startsAt: string | null; endsAt: string | null };
  onSchedule: () => void;
}

export function TopBar({
  ruleId,
  folder,
  name,
  nameRef,
  nameInvalid,
  active,
  dirty,
  pending,
  stats,
  onName,
  onActive,
  onSave,
  schedule,
  onSchedule,
}: Props) {
  const t = useT(rulesMessages);
  const tCommon = useT(commonMessages);
  const f = useFormat();
  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:gap-3 sm:px-4">
      <Link
        href={folderHref(folder ? folder.id : "all")}
        aria-label={folder ? t("backFolderAria", { folder: folder.name }) : t("backAria")}
        title={folder ? folder.name : t("backTitle")}
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
          aria-label={t("nameLabel")}
          aria-invalid={nameInvalid || undefined}
          placeholder={t("namePlaceholder")}
          className={cx(
            "block h-9 w-full min-w-0 truncate rounded-lg border border-transparent bg-transparent px-2 text-base font-semibold text-fg transition-colors placeholder:font-normal placeholder:text-fg-3 hover:border-line focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15 focus:outline-none sm:text-[17px]",
            nameInvalid && "placeholder:text-critical-text/70",
          )}
        />
        {stats && (
          <p className="hidden truncate px-2 text-xs text-fg-3 tabular sm:block">
            {t("topStats", { runs: stats.triggers, ctr: f.percent(stats.ctr) })}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {/* ตั้งเวลาเปิด–ปิด (อยู่ท้ายแผง "ทำงานเมื่อ…" — ปุ่มนี้พาไปเลย) */}
        <button
          type="button"
          onClick={onSchedule}
          title={t("scheduleTitle")}
          className={cx(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium whitespace-nowrap shadow-xs transition-colors",
            schedule.startsAt || schedule.endsAt
              ? "border-accent/30 bg-accent-soft text-accent hover:border-accent/50"
              : "border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2",
          )}
        >
          <CalendarClock size={17} aria-hidden="true" />
          {/* มือถือ: คำสั้น "ตั้งเวลา" · จอกว้าง: บอกวันปิด/เริ่มถ้าตั้งไว้ */}
          <span className={cx(schedule.startsAt || schedule.endsAt ? "lg:hidden" : "")}>{t("scheduleTitle")}</span>
          {(schedule.startsAt || schedule.endsAt) && (
            <span className="hidden lg:inline">
              {schedule.endsAt
                ? t("scheduleBadgeEnds", { when: f.dateTime(schedule.endsAt) })
                : t("scheduleBadgeStarts", { when: f.dateTime(schedule.startsAt) })}
            </span>
          )}
        </button>
        <span className="hidden md:block">
          <Switch checked={active} onChange={onActive} label={t("activeSwitch")} size="sm" />
        </span>
        {/* จอเล็ก: บอกสถานะสั้นๆ ข้างสวิตช์ (ไม่งั้นดูไม่ออกว่าสวิตช์นี้คืออะไร) */}
        <span className="flex items-center gap-1 md:hidden">
          <Switch checked={active} onChange={onActive} label={t("activeSwitch")} hideLabel size="sm" />
          <span aria-hidden="true" className={cx("text-xs font-medium", active ? "text-good-text" : "text-fg-3")}>
            {active ? t("activeShortOn") : t("activeShortOff")}
          </span>
        </span>

        <span
          aria-live="polite"
          className={cx("hidden items-center gap-1.5 text-xs whitespace-nowrap lg:flex", dirty ? "text-warning-text" : "text-fg-3")}
        >
          {dirty ? (
            <>
              <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
              {t("unsaved")}
            </>
          ) : ruleId ? (
            <>
              <Check size={14} aria-hidden="true" />
              {t("saved")}
            </>
          ) : null}
        </span>

        {ruleId && (
          <Menu label={t("ruleMenuLabel")}>
            <MenuItem
              action={duplicateRule}
              fields={{ id: ruleId }}
              icon={<Copy />}
              hint={dirty ? t("lastSavedVersion") : undefined}
              // ทำสำเนาแล้วจะไปหน้าของสำเนาทันที → ถามก่อนถ้ายังมีการแก้ที่ไม่ได้บันทึก
              confirm={
                dirty
                  ? {
                      title: t("duplicateDirtyTitle"),
                      description: t("duplicateDirtyBody"),
                      confirmLabel: t("duplicate"),
                      tone: "primary",
                    }
                  : undefined
              }
              successMessage={t("duplicated")}
            >
              {t("duplicate")}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              action={deleteRule}
              fields={{ id: ruleId, folder: folder?.id }}
              icon={<Trash2 />}
              tone="danger"
              confirm={{ title: t("deleteThisTitle"), description: t("deleteThisBody"), confirmLabel: t("deleteConfirm") }}
              successMessage={t("deleted")}
            >
              {t("deleteRule")}
            </MenuItem>
          </Menu>
        )}

        <Button onClick={onSave} loading={pending} icon={<Save />} title={t("saveShortcut")} className="relative max-sm:px-3">
          {pending ? (
            <>
              <span className="sm:hidden">{tCommon("save")}</span>
              <span className="max-sm:hidden">{tCommon("saving")}</span>
            </>
          ) : (
            tCommon("save")
          )}
          {dirty && !pending && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-warning lg:hidden" aria-hidden="true" />
          )}
        </Button>
      </div>
    </header>
  );
}
