"use client";

import { useId, useSyncExternalStore } from "react";
import { CalendarClock, CalendarX2, Clock } from "lucide-react";
import { Switch } from "@/components/switch";
import { cx, Field, inputClass, textareaClass } from "@/components/ui";
import { useFormat, useT } from "@/lib/i18n/client";
import { rulesMessages } from "@/lib/i18n/messages/rules";
import { CLOSED_REPLY_MAX, scheduleState, type ScheduleState } from "@/lib/rules/schedule";

/*
 * ตั้งเวลาเปิด–ปิด + ข้อความปิดรับ (ใช้ทั้งในหน้าแก้กฎ และหน้าต่างแก้ไขโฟลเดอร์)
 * ค่าเป็น ISO (null = ไม่จำกัด) — ช่องวันเวลาใช้เวลาของเครื่องที่เปิดหน้าเว็บ
 */

export interface ScheduleValue {
  startsAt: string | null;
  endsAt: string | null;
  closedReply: string;
}

const DAY_MS = 24 * 60 * 60_000;
const QUICK_DAYS = [3, 7, 14, 30];

/** ISO → ค่าของ <input type="datetime-local"> (เวลาเครื่อง) */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** อีก N วันนับจาก from (หรือตอนนี้) ปิดตอน 23:59 ของวันนั้น */
function endAfterDays(fromIso: string | null, days: number): string {
  const from = fromIso ? new Date(fromIso) : new Date();
  const d = new Date(from.getTime() + days * DAY_MS);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

// เวลาตอนนี้ฝั่งเบราว์เซอร์ (ตอน render บนเซิร์ฟเวอร์ไม่แสดงสถานะ จะได้ไม่ขึ้นคนละอย่าง)
const noop = () => () => {};
function useNow(): number | null {
  return useSyncExternalStore(
    noop,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );
}

export function ScheduleStatus({ value, className }: { value: Pick<ScheduleValue, "startsAt" | "endsAt">; className?: string }) {
  const t = useT(rulesMessages);
  const f = useFormat();
  const now = useNow();
  if (now === null || (!value.startsAt && !value.endsAt)) return null;
  const state: ScheduleState = scheduleState(
    { startsAt: value.startsAt ? new Date(value.startsAt) : null, endsAt: value.endsAt ? new Date(value.endsAt) : null },
    new Date(now),
  );
  const when = (iso: string) => f.dateTime(iso);
  const text =
    state === "ended"
      ? t("scheduleStateEnded", { when: when(value.endsAt!) })
      : state === "upcoming"
        ? t("scheduleStateUpcoming", { when: when(value.startsAt!) })
        : value.endsAt
          ? t("scheduleStateOpen", { when: when(value.endsAt) })
          : t("scheduleStateOpenNoEnd");
  return (
    <p
      className={cx(
        "flex items-center gap-1.5 text-xs leading-5 font-medium [&_svg]:size-3.5 [&_svg]:shrink-0",
        state === "ended" ? "text-warning-text" : state === "upcoming" ? "text-accent" : "text-good-text",
        className,
      )}
    >
      {state === "ended" ? <CalendarX2 aria-hidden /> : <Clock aria-hidden />}
      {text}
    </p>
  );
}

export function ScheduleFields({
  value,
  onChange,
  channel,
}: {
  value: ScheduleValue;
  onChange: (patch: Partial<ScheduleValue>) => void;
  /** ตอบปิดรับทางไหน: comment = ใต้คอมเมนต์, dm = ในแชท, folder = ทุกกฎในโฟลเดอร์ */
  channel: "comment" | "dm" | "folder";
}) {
  const t = useT(rulesMessages);
  const ids = useId();
  const scheduled = Boolean(value.startsAt || value.endsAt);
  const replying = value.closedReply.trim() !== "";

  function toggleSchedule(on: boolean) {
    onChange(on ? { startsAt: null, endsAt: endAfterDays(null, 7) } : { startsAt: null, endsAt: null });
  }

  return (
    <div className="space-y-4">
      <Switch checked={scheduled} onChange={toggleSchedule} label={t("scheduleLabel")} description={t("scheduleHint")} />
      {scheduled && (
        <div className="space-y-4 rounded-lg border border-line bg-surface-2/50 p-3.5">
          <Field
            label={t("scheduleStart")}
            htmlFor={`${ids}-start`}
            hint={!value.startsAt ? t("scheduleStartNowHint") : undefined}
            aside={
              value.startsAt ? (
                <button type="button" className="font-medium text-accent hover:underline" onClick={() => onChange({ startsAt: null })}>
                  {t("scheduleStartNow")}
                </button>
              ) : undefined
            }
          >
            <input
              id={`${ids}-start`}
              type="datetime-local"
              value={toLocalInput(value.startsAt)}
              onChange={(e) => onChange({ startsAt: fromLocalInput(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label={t("scheduleEnd")} htmlFor={`${ids}-end`} hint={t("scheduleQuickHint")}>
            <input
              id={`${ids}-end`}
              type="datetime-local"
              value={toLocalInput(value.endsAt)}
              onChange={(e) => onChange({ endsAt: fromLocalInput(e.target.value) })}
              className={inputClass}
            />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("scheduleQuickLabel")}>
              {QUICK_DAYS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => onChange({ endsAt: endAfterDays(value.startsAt, days) })}
                  className="inline-flex h-8 items-center rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-fg-2 transition-colors hover:border-line-strong hover:text-fg"
                >
                  {t("scheduleDays", { days })}
                </button>
              ))}
            </div>
          </Field>
          <ScheduleStatus value={value} />
        </div>
      )}

      {scheduled && (
        <div className="space-y-3">
          <Switch
            checked={replying}
            onChange={(on) => onChange({ closedReply: on ? t("closedDefault") : "" })}
            label={t("closedLabel")}
            description={channel === "comment" ? t("closedHintComment") : channel === "dm" ? t("closedHintDm") : t("closedHintFolder")}
          />
          {replying && (
            <Field label={t("closedMessage")} htmlFor={`${ids}-closed`} aside={`${value.closedReply.length}/${CLOSED_REPLY_MAX}`}>
              <textarea
                id={`${ids}-closed`}
                rows={3}
                maxLength={CLOSED_REPLY_MAX}
                value={value.closedReply}
                onChange={(e) => onChange({ closedReply: e.target.value })}
                className={textareaClass}
              />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

/** ป้ายเล็กบนการ์ดกฎ / แถบโฟลเดอร์: ปิดเอง… / เริ่ม… / หมดเวลาแล้ว */
export function ScheduleBadge({ state, at, className }: { state: ScheduleState; at: string | null; className?: string }) {
  const t = useT(rulesMessages);
  const f = useFormat();
  if (state === "open" && !at) return null;
  const label =
    state === "ended" ? t("scheduleBadgeEnded") : state === "upcoming" ? t("scheduleBadgeStarts", { when: f.dateTime(at) }) : t("scheduleBadgeEnds", { when: f.dateTime(at) });
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
        state === "ended" ? "bg-warning-soft text-warning-text" : state === "upcoming" ? "bg-accent-soft text-accent" : "bg-surface-2 text-fg-2",
        className,
      )}
    >
      {state === "ended" ? <CalendarX2 aria-hidden /> : <CalendarClock aria-hidden />}
      {label}
    </span>
  );
}
