"use client";

import { useEffect, useOptimistic, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, MessageCircle, MessagesSquare, Undo2 } from "lucide-react";
import { runAction, toFormData } from "@/components/action";
import { Switch } from "@/components/switch";
import { toast } from "@/components/toast";
import { Avatar, buttonStyle, Card, cx, PlatformIcon } from "@/components/ui";
import type { InboxKind, Platform } from "@/db/schema";
import { useFormat, useT } from "@/lib/i18n/client";
import { inboxMessages } from "@/lib/i18n/messages/inbox";
import type { ReplyLink } from "@/lib/inbox/links";
import { markInboxDone, markInboxWaiting } from "./actions";

/*
 * รายการในหน้าข้อความรอตอบ (ส่วนที่กดได้)
 * - "เสร็จแล้ว": แถวหายทันที (ไม่ต้องรอเซิร์ฟเวอร์) แล้วขึ้น toast ที่มีปุ่ม "เลิกทำ"
 * - เปิด "แสดงที่เสร็จแล้ว": แถวที่เสร็จแล้วจางลงและมีปุ่ม "ยังไม่เสร็จ"
 * - หลังแสดงผล ขอให้เซิร์ฟเวอร์ถาม Meta หาชื่อ/ลิงก์ที่ยังขาด (POST /api/inbox/details) ได้แล้วค่อยโหลดใหม่
 */

/** ข้อมูลหนึ่งแถว (ส่งจาก Server Component — วันที่เป็นข้อความ ISO) */
export interface InboxRowView {
  key: string;
  ids: number[];
  kind: InboxKind;
  platform: Platform;
  senderName: string | null;
  senderUsername: string | null;
  text: string;
  createdAt: string;
  handledAt: string | null;
  messageCount: number;
  reply: ReplyLink;
  postUrl: string | null;
}

const PLATFORM_LABEL: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram" };

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

export function InboxList({
  rows,
  now,
  showDone,
  detailsIds,
  footer,
}: {
  rows: InboxRowView[];
  /** เวลาของเซิร์ฟเวอร์ตอนแสดงหน้า (ISO) — ใช้คำนวณ "5 นาทีที่ผ่านมา" ให้ตรงกันทั้งสองฝั่ง */
  now: string;
  showDone: boolean;
  /** รายการที่ยังขาดชื่อ/ลิงก์ (ขอให้เซิร์ฟเวอร์ถาม Meta) */
  detailsIds: number[];
  footer?: ReactNode;
}) {
  const t = useT(inboxMessages);
  const router = useRouter();
  const [, startTransition] = useTransition();
  // สถานะที่เพิ่งกด (ยังรอเซิร์ฟเวอร์) — key แถว → เสร็จแล้วหรือยัง
  const [pending, setPending] = useOptimistic<Record<string, boolean>, { key: string; done: boolean }>({}, (state, change) => ({
    ...state,
    [change.key]: change.done,
  }));

  const requested = useRef(new Set<number>());
  const detailsKey = detailsIds.join(",");
  useEffect(() => {
    const ids = detailsKey
      .split(",")
      .map(Number)
      .filter((id) => id > 0 && !requested.current.has(id));
    if (ids.length === 0) return;
    for (const id of ids) requested.current.add(id);
    fetch("/api/inbox/details", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) })
      .then((res) => (res.ok ? (res.json() as Promise<{ updated?: number }>) : null))
      .then((data) => {
        if (data?.updated) startTransition(() => router.refresh());
      })
      // ไม่ได้ชื่อก็ยังใช้หน้าได้ตามปกติ
      .catch(() => {});
  }, [detailsKey, router]);

  function moveBack(ids: number[]) {
    startTransition(async () => {
      if (await runAction(() => markInboxWaiting(toFormData({ ids: ids.join(",") })))) toast(t("waitingToast"), { tone: "good" });
    });
  }

  function setDone(row: InboxRowView, done: boolean) {
    startTransition(async () => {
      setPending({ key: row.key, done });
      if (!done) {
        if (await runAction(() => markInboxWaiting(toFormData({ ids: row.ids.join(",") })))) toast(t("waitingToast"), { tone: "good" });
        return;
      }
      if (await runAction(() => markInboxDone(toFormData({ ids: row.ids.join(",") })))) {
        toast(t("doneToast"), { tone: "good", action: { label: t("undo"), onClick: () => moveBack(row.ids) } });
      }
    });
  }

  const visible = rows.flatMap((row) => {
    const done = pending[row.key] ?? row.handledAt !== null;
    return showDone || !done ? [{ row, done }] : [];
  });

  return (
    <Card padding="none" footer={footer}>
      <ul className="divide-y divide-line">
        {visible.map(({ row, done }) => (
          <InboxRowItem key={row.key} row={row} done={done} now={now} onDone={() => setDone(row, !done)} />
        ))}
      </ul>
    </Card>
  );
}

function InboxRowItem({ row, done, now, onDone }: { row: InboxRowView; done: boolean; now: string; onDone: () => void }) {
  const t = useT(inboxMessages);
  const f = useFormat();
  const nowDate = new Date(now);
  const person = row.senderName ?? (row.senderUsername ? `@${row.senderUsername}` : t("unknownPerson", { platform: PLATFORM_LABEL[row.platform] }));
  const named = Boolean(row.senderName || row.senderUsername);
  const KindIcon = row.kind === "dm" ? MessagesSquare : MessageCircle;
  const created = new Date(row.createdAt);
  const btn = buttonStyle("secondary", "sm");
  // ปุ่มหลักของแถวคือ "ตอบ" (ตัวอักษรสีหลัก) — "เสร็จแล้ว" เป็นปุ่มรอง (! = ทับสีตัวอักษรของปุ่ม secondary)
  const replyLabel = t("replyAria", { person, where: row.reply.where });

  return (
    <li className={cx("flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5", done && "bg-surface-2/40")}>
      <div className="flex min-w-0 flex-1 gap-3">
        <span className={cx("relative shrink-0 self-start", done && "opacity-60")}>
          <Avatar name={row.senderName ?? row.senderUsername} size="lg" />
          <PlatformIcon
            platform={row.platform}
            size={14}
            title={PLATFORM_LABEL[row.platform]}
            className="absolute -right-0.5 -bottom-0.5 ring-2 ring-surface"
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm leading-6">
              <span className={named ? "font-medium text-fg" : "text-fg-2"}>{person}</span>
              {row.senderName && row.senderUsername && <span className="text-fg-3"> @{row.senderUsername}</span>}
            </p>
            <time dateTime={created.toISOString()} title={f.dateTime(created)} className="shrink-0 text-xs whitespace-nowrap text-fg-3 tabular">
              {f.relativeTime(created, nowDate)}
            </time>
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs leading-5 text-fg-3">
            <KindIcon className="size-3.5 shrink-0" aria-hidden />
            <span>{row.kind === "dm" ? t("kindChat") : t("kindComment")}</span>
            {row.postUrl && (
              <>
                <span aria-hidden>·</span>
                <a
                  href={row.postUrl}
                  {...EXTERNAL}
                  aria-label={t("openPostAria", { person })}
                  className="inline-flex items-center gap-0.5 rounded-sm text-accent hover:underline"
                >
                  {t("onPost")}
                  <ArrowUpRight className="size-3" aria-hidden />
                </a>
              </>
            )}
            {done && row.handledAt && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 text-good-text">
                  <Check className="size-3.5" aria-hidden />
                  {t("doneAt", { time: f.relativeTime(row.handledAt, nowDate) })}
                </span>
              </>
            )}
          </p>
          <p
            className={cx(
              "mt-1 line-clamp-3 text-sm leading-6 [overflow-wrap:anywhere] whitespace-pre-line",
              done ? "text-fg-2" : "text-fg",
              !row.text.trim() && "text-fg-3 italic",
            )}
          >
            {row.text.trim() || t("attachmentOnly")}
          </p>
          {row.messageCount > 1 && <p className="text-xs leading-5 text-fg-3">{t("messageCount", { count: row.messageCount })}</p>}
        </div>
      </div>

      {/* มือถือ: ปุ่มอยู่ใต้ข้อความ (เยื้องตรงกับข้อความ) · จอใหญ่: ด้านขวา */}
      <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
        {/* ig.me เปิดบนเว็บ instagram.com ไม่ได้ → เครื่องที่ใช้เมาส์ใช้ลิงก์สำรอง */}
        <span className={row.reply.desktopHref ? "contents pointer-fine:hidden" : "contents"}>
          <a href={row.reply.href} {...EXTERNAL} aria-label={replyLabel} title={t(row.reply.hint)} className={cx(btn, "text-accent!")}>
            {t("reply")}
            <ArrowUpRight aria-hidden />
          </a>
        </span>
        {row.reply.desktopHref && (
          <span className="hidden pointer-fine:contents">
            <a
              href={row.reply.desktopHref}
              {...EXTERNAL}
              aria-label={replyLabel}
              title={t(row.reply.desktopHint ?? row.reply.hint)}
              className={cx(btn, "text-accent!")}
            >
              {t("reply")}
              <ArrowUpRight aria-hidden />
            </a>
          </span>
        )}
        <button
          type="button"
          onClick={onDone}
          aria-label={done ? t("markWaitingAria", { person }) : t("doneAria", { person })}
          className={cx(btn, "text-fg-2!")}
        >
          {done ? <Undo2 aria-hidden /> : <Check aria-hidden className="text-good" />}
          {done ? t("markWaiting") : t("done")}
        </button>
      </div>
    </li>
  );
}

/** สวิตช์ "แสดงที่เสร็จแล้ว" — เปลี่ยน URL (ตัวกรองอื่นคงเดิม) */
export function ShowDoneSwitch({ checked, href, className }: { checked: boolean; href: string; className?: string }) {
  const t = useT(inboxMessages);
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  return (
    <Switch
      checked={checked}
      busy={busy}
      size="sm"
      label={t("showDone")}
      className={className}
      onChange={() => startTransition(() => router.push(href, { scroll: false }))}
    />
  );
}
