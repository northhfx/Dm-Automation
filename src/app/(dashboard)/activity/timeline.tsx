import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  CircleAlert,
  Hourglass,
  KeyRound,
  Link2,
  MailX,
  MessageCircle,
  MessageCircleX,
  MessagesSquare,
  MousePointerClick,
  Pin,
  Reply,
  Send,
  SkipForward,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cx, PlatformIcon } from "@/components/ui";
import { createT, DEFAULT_LOCALE, formatters, type Locale, type MessageKey, type TFunction } from "@/lib/i18n";
import { activityMessages } from "@/lib/i18n/messages/activity";
import { localizeSystemMessage } from "@/lib/i18n/system";
import { inboxCutoff } from "@/lib/inbox/retention";
import { INSTAGRAM_MESSAGE_ACCESS_MENU } from "@/lib/meta/setup-info";
import type { TimelineEvent } from "./load-events";

/*
 * ส่วนแสดงผลกิจกรรม (ใช้ทั้งหน้ากิจกรรมและหน้าภาพรวม) — Server Component เท่านั้น
 * เพราะใช้ formatRelativeTime ซึ่งคำนวณจากเวลาปัจจุบันฝั่งเซิร์ฟเวอร์
 * ภาษา: คอมโพเนนต์ในไฟล์นี้ไม่ใช่ async จึงอ่านคุกกี้เองไม่ได้ → หน้าที่เรียกส่ง locale มา (ไม่ส่ง = ไทย)
 */

type Tone = "neutral" | "good" | "critical" | "accent" | "warning";

type ActivityKey = MessageKey<typeof activityMessages>;
type T = TFunction<ActivityKey>;

const tOf = (locale: Locale): T => createT(activityMessages, locale);

interface EventType {
  /** key ของชื่อกิจกรรมใน activityMessages */
  label: ActivityKey;
  tone: Tone;
  icon: LucideIcon;
  /** คำนำหน้าชื่อลูกค้า เช่น "จาก Ploy" / "ถึง Ploy" (whoAccount = บัญชี Instagram ของร้าน) */
  who: "whoFrom" | "whoTo" | "whoBy" | "whoAccount";
}

export const EVENT_TYPES: Record<string, EventType> = {
  comment_received: { label: "evCommentReceived", tone: "neutral", icon: MessageCircle, who: "whoFrom" },
  dm_received: { label: "evDmReceived", tone: "neutral", icon: MessagesSquare, who: "whoFrom" },
  rule_triggered: { label: "evRuleTriggered", tone: "accent", icon: Zap, who: "whoFrom" },
  public_reply_sent: { label: "evPublicReplySent", tone: "good", icon: Reply, who: "whoTo" },
  public_reply_failed: { label: "evPublicReplyFailed", tone: "critical", icon: MessageCircleX, who: "whoTo" },
  dm_sent: { label: "evDmSent", tone: "good", icon: Send, who: "whoTo" },
  dm_failed: { label: "evDmFailed", tone: "critical", icon: MailX, who: "whoTo" },
  button_clicked: { label: "evButtonClicked", tone: "accent", icon: MousePointerClick, who: "whoBy" },
  link_clicked: { label: "evLinkClicked", tone: "accent", icon: Link2, who: "whoBy" },
  skipped: { label: "evSkipped", tone: "warning", icon: SkipForward, who: "whoFrom" },
  post_bound: { label: "evPostBound", tone: "accent", icon: Pin, who: "whoBy" },
  token_refresh_failed: { label: "evTokenRefreshFailed", tone: "critical", icon: KeyRound, who: "whoAccount" },
  // Meta ขอให้ชะลอ → ระบบพักแล้วส่งต่อเอง (ไม่ใช่ความผิดพลาด จึงเป็นสีเตือน ไม่ใช่สีแดง)
  dm_rate_limited: { label: "evDmRateLimited", tone: "warning", icon: Hourglass, who: "whoAccount" },
};

/** ประเภทที่ไม่รู้จัก: ใช้ชื่อประเภทตามที่บันทึกไว้เป็นชื่อกิจกรรม */
const FALLBACK: Omit<EventType, "label"> = { tone: "neutral", icon: Activity, who: "whoFrom" };

/**
 * กิจกรรมที่ระบบเขียนข้อความ (text) เอง — แปลตามภาษาได้ (ประเภทอื่น text คือข้อความของลูกค้า/ร้าน ห้ามแปล)
 * dm_rate_limited: system.rateLimitNotice
 */
const SYSTEM_TEXT_TYPES = new Set(["dm_rate_limited"]);

/** ข้อความของกิจกรรม + สาเหตุที่ผิดพลาด ตามภาษา (ข้อความของระบบเก็บเป็นภาษาไทยต้นฉบับ / ข้อความจาก Meta คงเดิม) */
function localized(event: TimelineEvent, locale: Locale): Pick<TimelineEvent, "text" | "error"> {
  const { text, error } = event;
  return {
    text: text && SYSTEM_TEXT_TYPES.has(event.type) ? localizeSystemMessage(text, locale) : text,
    error: error?.message ? { ...error, message: localizeSystemMessage(error.message, locale) } : error,
  };
}

/** ประเภทกิจกรรม + ชื่อตามภาษา */
export function eventType(type: string, locale: Locale = DEFAULT_LOCALE): Omit<EventType, "label"> & { label: string } {
  const known = EVENT_TYPES[type];
  return known ? { ...known, label: tOf(locale)(known.label) } : { ...FALLBACK, label: type };
}

const CHIP_TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-2",
  good: "bg-good-soft text-good-text",
  critical: "bg-critical-soft text-critical-text",
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning-text",
};

/** ไอคอนวงกลมของแต่ละประเภทกิจกรรม */
export function EventIcon({ type, size = "md", className }: { type: string; size?: "sm" | "md"; className?: string }) {
  const { tone, icon: Icon } = EVENT_TYPES[type] ?? FALLBACK;
  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "sm" ? "size-7 [&_svg]:size-3.5" : "size-8 [&_svg]:size-4",
        CHIP_TONES[tone],
        className,
      )}
    >
      <Icon aria-hidden strokeWidth={2} />
    </span>
  );
}

/** เวลาแบบ "5 นาทีที่ผ่านมา" — ชี้เมาส์เพื่อดูวันเวลาเต็ม */
export function RelativeTime({
  date,
  now,
  className,
  locale = DEFAULT_LOCALE,
}: {
  date: Date | string | null;
  now?: Date;
  className?: string;
  locale?: Locale;
}) {
  if (!date) return <span className={className}>–</span>;
  const d = typeof date === "string" ? new Date(date) : date;
  const f = formatters(locale);
  return (
    <time dateTime={d.toISOString()} title={f.dateTime(d)} className={cx("whitespace-nowrap tabular", className)}>
      {f.relativeTime(d, now)}
    </time>
  );
}

const SKIP_REASONS: Record<string, ActivityKey> = {
  once_per_user: "skipOncePerUser",
  rule_inactive: "skipRuleInactive",
  button_target_missing: "skipButtonTargetMissing",
  rule_ended: "skipRuleEnded",
  next_post_lookup_failed: "skipNextPostLookupFailed",
};

/**
 * เมนูเดียวกับ INSTAGRAM_MESSAGE_ACCESS_MENU (ชื่อเมนูในแอป Instagram ภาษาไทย) แต่เป็นชื่อในแอป Instagram ภาษาอังกฤษ
 * เป็นชื่อปุ่มในแอปของ Meta จึงเขียนตามแอปเป๊ะๆ ไม่ได้แปลเอง
 */
const INSTAGRAM_MESSAGE_ACCESS_MENU_EN = [
  "Profile",
  "☰",
  "Settings and activity",
  "Messages and story replies",
  "Message controls",
  "Connected tools",
];

/** คำอธิบายภาษาคนของรหัสผิดพลาดที่พบบ่อยจาก Meta */
export function errorHint(code: string | null, locale: Locale = DEFAULT_LOCALE): string | null {
  const t = tOf(locale);
  const [main, sub] = code?.split(" / ") ?? [];
  if (sub === "2018278" || sub === "2534022") return t("hint24h");
  if (sub === "2534041") {
    const menu = locale === "en" ? INSTAGRAM_MESSAGE_ACCESS_MENU_EN : INSTAGRAM_MESSAGE_ACCESS_MENU;
    return t("hintIgMessageAccess", { menu: menu.join(" → ") });
  }
  switch (main) {
    case "190":
      return t("hintToken");
    case "10":
    case "200":
      return t("hintPermission");
    case "551":
      return t("hintUnavailable");
    case "4":
    case "32":
    case "613":
      return t("hintRateLimit");
    default:
      return null;
  }
}

/** ข้อความยาว → แสดง 3 บรรทัดแรก กดเพื่อดูทั้งหมด (ไม่ต้องใช้ JavaScript) */
function Expandable({ text, t, className, lines = 3 }: { text: string; t: T; className?: string; lines?: 2 | 3 }) {
  const long = text.length > 140 || text.split("\n").length > lines;
  const clamp = lines === 2 ? "line-clamp-2" : "line-clamp-3";
  if (!long) return <span className={cx("block break-words whitespace-pre-line", className)}>{text}</span>;
  return (
    <details className="group/more">
      <summary className="cursor-pointer list-none rounded-md [&::-webkit-details-marker]:hidden">
        <span className={cx("break-words whitespace-pre-line group-open/more:line-clamp-none", clamp, className)}>{text}</span>
        <span className="mt-1 inline-block text-xs font-medium text-accent group-open/more:hidden">{t("expandMore")}</span>
        <span className="mt-1 hidden text-xs font-medium text-accent group-open/more:inline-block">{t("expandLess")}</span>
      </summary>
    </details>
  );
}

/**
 * คอมเมนต์ / แชทที่ไม่ตรงกฎ: ระบบไม่เก็บว่าใครส่ง ส่งว่าอะไร จึงไม่มีชื่อและข้อความให้แสดง
 * ไม่ตรงได้หลายสาเหตุ (คำ, โพสต์ที่เลือกไว้, แพลตฟอร์ม, กฎปิดอยู่) — ห้ามบอกว่าเป็นเพราะคำไม่ตรงอย่างเดียว
 * ไม่งั้นเจ้าของร้านที่ลองคอมเมนต์ผิดโพสต์จะไปแก้คำในกฎแทนที่จะดูว่าเลือกโพสต์ไว้ถูกหรือเปล่า
 */
export function unmatchedNote(type: string, locale: Locale = DEFAULT_LOCALE): string {
  const t = tOf(locale);
  const where = type === "comment_received" ? t("unmatchedWhereComment") : t("unmatchedWhereDm");
  return t("unmatchedNote", { where });
}

/**
 * กิจกรรมไม่เก็บชื่อ/ข้อความของคนที่ไม่ตรงกฎ แต่หน้า "ข้อความรอตอบ" เก็บไว้ให้ตามตอบเอง (ลบเองเมื่อครบอายุ)
 * → ชี้ทางไปที่นั่น เฉพาะกิจกรรมที่ยังไม่เกินอายุของหน้านั้น (เก่ากว่านั้นไม่มีให้ดูแล้ว)
 */
function UnmatchedInboxLink({ event, now, t }: { event: TimelineEvent; now: Date; t: T }) {
  if (!event.unmatched || event.createdAt < inboxCutoff(now)) return null;
  return (
    <Link href="/inbox" className="inline-flex items-center gap-0.5 rounded font-medium text-accent hover:underline">
      {t("viewInInbox")}
      <ArrowRight className="size-3" aria-hidden />
    </Link>
  );
}

function UnmatchedTag({ event, t }: { event: TimelineEvent; t: T }) {
  if (!event.unmatched) return null;
  return <span className="font-normal text-fg-3"> {t("unmatchedTag")}</span>;
}

function Person({ event, t }: { event: TimelineEvent; t: T }) {
  if (!event.person) return null;
  const who = (EVENT_TYPES[event.type] ?? FALLBACK).who;
  return <span className="text-fg-2">{t.rich(who, { person: <span className="font-medium text-fg">{event.person}</span> })}</span>;
}

/** ไอคอนประเภทกิจกรรม + ป้ายแพลตฟอร์มเล็กๆ ที่มุมขวาล่าง */
function EventMark({ event, size = "md", className }: { event: TimelineEvent; size?: "sm" | "md"; className?: string }) {
  return (
    <span className={cx("relative shrink-0 self-start", className)}>
      <EventIcon type={event.type} size={size} />
      {event.platform && (
        <PlatformIcon
          platform={event.platform}
          size={size === "sm" ? 12 : 14}
          title={event.platform === "instagram" ? "Instagram" : "Facebook"}
          className="absolute -right-1 -bottom-1 ring-2 ring-surface"
        />
      )}
    </span>
  );
}

/** รายการกิจกรรมแบบเต็ม (หน้ากิจกรรม) */
export function TimelineItem({
  event,
  now,
  last,
  locale = DEFAULT_LOCALE,
}: {
  event: TimelineEvent;
  now: Date;
  last?: boolean;
  locale?: Locale;
}) {
  const t = tOf(locale);
  const type = eventType(event.type, locale);
  const { text, error } = localized(event, locale);
  const isButton = event.type === "button_clicked";
  const skipKey = event.skipReason ? SKIP_REASONS[event.skipReason] : undefined;
  const skip = skipKey ? t(skipKey) : event.skipReason;
  const hint = error ? errorHint(error.code, locale) : null;

  return (
    <li className="relative flex gap-3 px-4 py-3.5 sm:px-5">
      {/* เส้นเชื่อมระหว่างไอคอน */}
      {!last && <span aria-hidden className="absolute top-[50px] -bottom-2.5 left-[31.5px] w-px bg-line sm:left-[35.5px]" />}
      <EventMark event={event} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 text-sm leading-6">
            <span className={cx("font-semibold", type.tone === "critical" ? "text-critical-text" : "text-fg")}>{type.label}</span>
            <UnmatchedTag event={event} t={t} />
            {isButton && event.text && <span className="text-fg"> “{event.text}”</span>} <Person event={event} t={t} />
          </p>
          <RelativeTime
            date={event.createdAt}
            now={now}
            locale={locale}
            className="mt-0.5 hidden shrink-0 text-xs leading-5 text-fg-3 sm:block"
          />
        </div>

        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-5 text-fg-3">
          <RelativeTime date={event.createdAt} now={now} locale={locale} className="sm:hidden" />
          {event.ruleId !== null && event.ruleName !== null && (
            <Link href={`/rules/${event.ruleId}`} className="inline-flex max-w-full min-w-0 items-center gap-1 rounded hover:text-accent">
              <Zap className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{t("ruleName", { rule: event.ruleName })}</span>
            </Link>
          )}
          {event.unmatched && <span>{unmatchedNote(event.type, locale)}</span>}
          <UnmatchedInboxLink event={event} now={now} t={t} />
        </div>

        {!isButton && (text || event.buttons.length > 0) && (
          <div className="mt-2 max-w-2xl rounded-xl bg-surface-2 px-3 py-2 text-sm leading-6 text-fg-2">
            {text && <Expandable text={text} t={t} />}
            {event.buttons.length > 0 && (
              <div className={cx("flex flex-wrap gap-1.5", text && "mt-2")} role="group" aria-label={t("buttonsAria")}>
                {event.buttons.map((b, i) => (
                  // แค่บอกว่าข้อความมีปุ่มอะไร (กดไม่ได้) → เส้นประ สีเทา ไม่ให้ดูเหมือนปุ่มจริง
                  <span
                    key={i}
                    className="inline-flex h-7 max-w-full items-center gap-1 rounded-md border border-dashed border-line-strong px-2 text-xs text-fg-2"
                  >
                    <MousePointerClick size={12} className="shrink-0 text-fg-3" aria-hidden="true" />
                    <span className="sr-only">{t("buttonSr")} </span>
                    <span className="truncate">{b}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {skip && <p className="mt-1.5 text-sm text-warning-text">{skip}</p>}

        {error && (
          <div className="mt-2 flex max-w-2xl gap-2 rounded-xl border border-critical/25 bg-critical-soft px-3 py-2 text-sm leading-6">
            <CircleAlert className="mt-1 size-4 shrink-0 text-critical-text" aria-hidden />
            <div className="min-w-0 flex-1">
              <Expandable
                text={t("errorReason", { message: error.message ?? t("errorUnknown") })}
                t={t}
                className="text-critical-text"
                lines={2}
              />
              {hint && <p className="mt-1 text-fg-2">{hint}</p>}
              {error.code && <p className="mt-0.5 text-xs text-fg-3">{t("errorCode", { code: error.code })}</p>}
              {event.type === "token_refresh_failed" && (
                <Link
                  href="/settings#instagram"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent underline-offset-2 hover:underline"
                >
                  {t("goToInstagramSettings")}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/** รายการกิจกรรมแบบย่อ (การ์ด "กิจกรรมล่าสุด" ในหน้าภาพรวม) */
export function TimelineItemCompact({ event, now, locale = DEFAULT_LOCALE }: { event: TimelineEvent; now: Date; locale?: Locale }) {
  const t = tOf(locale);
  const type = eventType(event.type, locale);
  const { text, error } = localized(event, locale);
  const detail: ReactNode =
    event.type === "button_clicked" && text
      ? `“${text}”`
      : error
        ? (error.message ?? t("errorUnknown"))
        : event.unmatched
          ? unmatchedNote(event.type, locale)
          : (text ?? (event.ruleName ? t("ruleName", { rule: event.ruleName }) : null));
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <EventMark event={event} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-sm leading-6">
            <span className={cx("font-medium", type.tone === "critical" ? "text-critical-text" : "text-fg")}>{type.label}</span>
            <UnmatchedTag event={event} t={t} /> <Person event={event} t={t} />
          </p>
          <RelativeTime date={event.createdAt} now={now} locale={locale} className="mt-0.5 shrink-0 text-xs leading-5 text-fg-3" />
        </div>
        {detail && <p className={cx("truncate text-xs leading-5", error ? "text-critical-text" : "text-fg-3")}>{detail}</p>}
      </div>
    </li>
  );
}
