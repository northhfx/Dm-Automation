"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, ChevronLeft, CircleAlert, SendHorizontal } from "lucide-react";
import { runAction, toFormData } from "@/components/action";
import { MessengerAppLink } from "@/components/messenger-app-link";
import { toast } from "@/components/toast";
import { Avatar, buttonStyle, cx, Notice, PlatformIcon, textareaClass } from "@/components/ui";
import type { Platform } from "@/db/schema";
import type { MessageKey, TFunction } from "@/lib/i18n";
import { useFormat, useT } from "@/lib/i18n/client";
import type { Formatters } from "@/lib/i18n/format";
import { chatMessages } from "@/lib/i18n/messages/chat";
import type { ReplyLink } from "@/lib/inbox/links";
import { markInboxDone } from "../../../actions";
import { sendChatReplyAction } from "./actions";

/*
 * ห้องแชทกับลูกค้าหนึ่งคน: ประวัติข้อความ + ช่องพิมพ์ตอบ (ส่งในนามเพจ / บัญชี Instagram)
 * - โหลดใหม่เองทุก 15 วินาทีตอนเปิดหน้านี้อยู่ (ข้อความใหม่จากลูกค้า) และทันทีที่กลับมาที่แท็บนี้
 * - Ctrl/⌘ + Enter = ส่ง (Enter เฉยๆ ขึ้นบรรทัดใหม่ — พิมพ์ภาษาไทยบนมือถือไม่ส่งโดยไม่ตั้งใจ)
 */

/** ข้อความหนึ่งอันในห้องแชท (ส่งจาก Server Component — วันที่เป็นข้อความ ISO) */
export type ChatEntryView =
  | { id: string; at: string; dir: "in"; kind: "text" | "button"; text: string }
  | { id: string; at: string; dir: "out"; kind: "auto"; text: string; ruleName: string | null }
  | { id: string; at: string; dir: "out"; kind: "manual"; text: string; status: "sent" | "failed"; error: string | null };

export interface ChatViewProps {
  platform: Platform;
  account: string;
  user: string;
  /** ชื่อที่แสดง (ชื่อ / @username / "ผู้ใช้ Facebook") */
  person: string;
  /** ชื่อจริงของลูกค้า (ใช้ค้นหาในแอป Messenger) */
  name: string | null;
  username: string | null;
  /** ชื่อเพจ / @username ของร้าน — null = ไม่พบบัญชีที่เชื่อมไว้แล้ว */
  accountName: string | null;
  entries: ChatEntryView[];
  /** ส่งจากหน้านี้ได้ถึงเมื่อไร (ISO) — null = ส่งไม่ได้ */
  windowEndsAt: string | null;
  /** ลูกค้าเคยทักแชท/กดปุ่มมาไหม (บอกเหตุผลที่ส่งไม่ได้ให้ตรง) */
  hasInbound: boolean;
  /** รายการในหน้าข้อความรอตอบที่ยังไม่เสร็จ (ปุ่ม "เสร็จแล้ว") */
  openInboxIds: number[];
  /** ลิงก์ไปคุยต่อในแอปของ Meta */
  external: ReplyLink;
  back: { href: string; label: string };
  /** เวลาของเซิร์ฟเวอร์ตอนแสดงหน้า (ISO) */
  now: string;
  textMax: number;
  historyDays: number;
}

const REFRESH_MS = 15_000;
const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

export function ChatView(props: ChatViewProps) {
  const { platform, person, entries, external } = props;
  const t = useT(chatMessages);
  const f = useFormat();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [sending, startSending] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const platformLabel = platform === "facebook" ? "Facebook" : "Instagram";
  const where = platform === "facebook" ? "Messenger" : "Instagram";
  const now = new Date(props.now);
  const windowEnd = props.windowEndsAt ? new Date(props.windowEndsAt) : null;
  const canSend = Boolean(windowEnd && props.accountName);

  // ข้อความใหม่ / มีข้อความ error → เลื่อนลงไปล่างสุด (ตอนเปิดหน้าด้วย)
  const lastId = entries.at(-1)?.id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastId, error]);

  // โหลดใหม่เป็นระยะตอนหน้านี้เปิดอยู่ (ไม่โหลดตอนกำลังส่ง)
  const busy = sending || refreshing;
  useEffect(() => {
    const reload = () => {
      if (document.visibilityState === "visible" && !busy) startRefresh(() => router.refresh());
    };
    const timer = setInterval(reload, REFRESH_MS);
    document.addEventListener("visibilitychange", reload);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [router, busy]);

  function send() {
    const message = text.trim();
    if (!message || sending) return;
    setError(null);
    startSending(async () => {
      let failure: string | null;
      try {
        failure = await sendChatReplyAction({ platform, account: props.account, user: props.user, text: message });
      } catch {
        failure = t("errFailedGeneric");
      }
      if (failure) {
        setError(failure);
        inputRef.current?.focus();
        return;
      }
      setText("");
      toast(t("sentToast"), { tone: "good" });
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  }

  function markDone() {
    startSending(async () => {
      if (await runAction(() => markInboxDone(toFormData({ ids: props.openInboxIds.join(",") })))) {
        toast(t("doneToast"), { tone: "good" });
      }
    });
  }

  const linkClass = cx(buttonStyle("secondary", "sm"), "text-accent!");
  const externalLabel = (target: string) => (
    <>
      {t("openIn", { where: target })}
      <ArrowUpRight aria-hidden />
    </>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link
        href={props.back.href}
        className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 text-sm text-fg-2 transition-colors hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {props.back.label}
      </Link>

      <section className="min-w-0 rounded-xl border border-line bg-surface shadow-xs">
        {/* หัวห้องแชท */}
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-line px-4 py-3 sm:px-5">
          <span className="relative shrink-0">
            <Avatar name={props.name ?? props.username} size="lg" />
            <PlatformIcon platform={platform} size={14} title={platformLabel} className="absolute -right-0.5 -bottom-0.5 ring-2 ring-surface" />
          </span>
          <div className="min-w-0 flex-1 basis-40">
            <h1 className="truncate text-base leading-6 font-semibold text-fg">
              {person}
              {props.name && props.username && <span className="font-normal text-fg-3"> @{props.username}</span>}
            </h1>
            {props.accountName && <p className="truncate text-xs leading-5 text-fg-3">{t("replyingAs", { account: props.accountName })}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {external.messengerApp ? (
              <>
                <span className="contents pointer-fine:hidden">
                  <MessengerAppLink chatUrl={external.href} name={props.name} ariaLabel={t("openInAppAria", { person })} className={linkClass}>
                    {externalLabel("Messenger")}
                  </MessengerAppLink>
                </span>
                <span className="hidden pointer-fine:contents">
                  <a href={external.href} {...EXTERNAL} aria-label={t("openInAria", { person, where: external.where })} className={linkClass}>
                    {externalLabel("Business Suite")}
                  </a>
                </span>
              </>
            ) : (
              <>
                <span className={external.desktopHref ? "contents pointer-fine:hidden" : "contents"}>
                  <a href={external.href} {...EXTERNAL} aria-label={t("openInAria", { person, where: external.where })} className={linkClass}>
                    {externalLabel("Instagram")}
                  </a>
                </span>
                {external.desktopHref && (
                  <span className="hidden pointer-fine:contents">
                    <a href={external.desktopHref} {...EXTERNAL} aria-label={t("openInAria", { person, where: external.where })} className={linkClass}>
                      {externalLabel("Instagram")}
                    </a>
                  </span>
                )}
              </>
            )}
            {props.openInboxIds.length > 0 && (
              <button
                type="button"
                onClick={markDone}
                disabled={sending}
                aria-label={t("markDoneAria", { person })}
                className={cx(buttonStyle("secondary", "sm"), "text-fg-2!")}
              >
                <Check aria-hidden className="text-good" />
                {t("markDone")}
              </button>
            )}
          </div>
        </header>

        {/* ข้อความ */}
        <div role="log" aria-label={t("historyLabel", { person })} className="space-y-3 px-4 py-4 sm:px-5">
          <p className="text-center text-xs leading-5 text-fg-3">{t("historyNote", { days: props.historyDays })}</p>
          {entries.length === 0 && <p className="py-6 text-center text-sm text-fg-3">{t("empty")}</p>}
          {entries.map((entry, i) => {
            const at = new Date(entry.at);
            const prev = entries[i - 1];
            const day = dayKey(f, at);
            return (
              <div key={entry.id} className="space-y-3">
                {(!prev || dayKey(f, new Date(prev.at)) !== day) && (
                  <p className="flex items-center gap-3 text-xs text-fg-3 before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
                    {dayLabel(f, at, now, t)}
                  </p>
                )}
                <Bubble entry={entry} time={f.date(at, { hour: "numeric", minute: "2-digit" })} title={f.dateTime(at)} />
              </div>
            );
          })}
        </div>

        {/* ช่องพิมพ์ (ติดขอบล่างของจอเวลาเลื่อนดูข้อความเก่า) */}
        <div className="sticky bottom-0 rounded-b-xl border-t border-line bg-surface px-4 py-3 sm:px-5">
          {!props.accountName ? (
            <Notice tone="warning">{t("errNoConnection")}</Notice>
          ) : !canSend ? (
            <Notice tone="warning" title={props.hasInbound ? t("windowClosedTitle") : t("noInboundTitle")}>
              {props.hasInbound ? t("windowClosedBody", { platform: platformLabel, where }) : t("noInboundBody", { platform: platformLabel, where })}
            </Notice>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="space-y-2"
            >
              {error && (
                <p role="alert" className="flex items-start gap-1.5 text-sm leading-6 text-critical-text">
                  <CircleAlert className="mt-[3px] size-4 shrink-0" aria-hidden />
                  {error}
                </p>
              )}
              <div className="flex items-end gap-2">
                <label htmlFor="chat-reply" className="sr-only">
                  {t("inputLabel")}
                </label>
                <textarea
                  id="chat-reply"
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t("placeholder")}
                  maxLength={props.textMax}
                  rows={2}
                  className={cx(textareaClass, "max-h-48 min-h-[44px] flex-1")}
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className={cx(buttonStyle("primary", "md"), "shrink-0")}
                >
                  <SendHorizontal aria-hidden />
                  {sending ? t("sending") : t("send")}
                </button>
              </div>
              <p className="flex flex-wrap justify-between gap-x-3 text-xs leading-5 text-fg-3">
                {windowEnd && <span>{t("windowOpen", { time: f.dateTime(windowEnd) })}</span>}
                {text.length > props.textMax * 0.8 && (
                  <span className="tabular">{t("charCount", { count: text.length, max: props.textMax })}</span>
                )}
              </p>
            </form>
          )}
        </div>
        {/* จุดล่างสุดของห้องแชท (ใต้ช่องพิมพ์) — เลื่อนมาที่นี่แล้วข้อความล่าสุดจะอยู่เหนือช่องพิมพ์พอดี ไม่ถูกบัง */}
        <div ref={endRef} />
      </section>
    </div>
  );
}

type T = TFunction<MessageKey<typeof chatMessages>>;

/** วันที่ตามเขตเวลาของระบบ (ใช้แบ่งกลุ่มข้อความตามวัน) */
function dayKey(f: Formatters, d: Date): string {
  return f.date(d, { year: "numeric", month: "2-digit", day: "2-digit" });
}

function dayLabel(f: Formatters, d: Date, now: Date, t: T): string {
  const key = dayKey(f, d);
  if (key === dayKey(f, now)) return t("today");
  if (key === dayKey(f, new Date(now.getTime() - 24 * 60 * 60_000))) return t("yesterday");
  const sameYear = f.date(d, { year: "numeric" }) === f.date(now, { year: "numeric" });
  return f.date(d, { day: "numeric", month: "long", year: sameYear ? undefined : "numeric" });
}

function Bubble({ entry, time, title }: { entry: ChatEntryView; time: string; title: string }) {
  const t = useT(chatMessages);
  const out = entry.dir === "out";
  const failed = entry.kind === "manual" && entry.status === "failed";
  const body =
    entry.kind === "button"
      ? entry.text
        ? t("buttonTap", { title: entry.text })
        : t("buttonTapNoTitle")
      : entry.text.trim() || t("attachmentOnly");
  const label =
    entry.kind === "auto"
      ? entry.ruleName
        ? t("autoFromRule", { rule: entry.ruleName })
        : t("auto")
      : entry.kind === "manual"
        ? failed
          ? t("failed")
          : t("you")
        : null;
  return (
    <div className={cx("flex flex-col", out ? "items-end" : "items-start")}>
      <div
        className={cx(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-6 [overflow-wrap:anywhere] whitespace-pre-line sm:max-w-[75%]",
          !out && "rounded-bl-md bg-surface-2 text-fg",
          entry.kind === "button" && "italic text-fg-2",
          entry.kind === "auto" && "rounded-br-md border border-dashed border-line-strong bg-surface text-fg-2",
          entry.kind === "manual" && !failed && "rounded-br-md bg-accent text-accent-fg",
          failed && "rounded-br-md border border-critical/40 bg-critical-soft text-fg",
          !entry.text.trim() && entry.kind === "text" && "text-fg-3 italic",
        )}
      >
        {body}
      </div>
      <p className={cx("mt-1 px-1 text-[11px] leading-4", failed ? "text-critical-text" : "text-fg-3")} title={title}>
        {label ? `${label} · ${time}` : time}
      </p>
      {failed && entry.error && <p className="max-w-[85%] px-1 text-[11px] leading-4 text-fg-3 sm:max-w-[75%]">{entry.error}</p>}
    </div>
  );
}
