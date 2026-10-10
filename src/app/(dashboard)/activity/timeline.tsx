import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  CircleAlert,
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
import { cx, formatDateTime, formatRelativeTime, PlatformIcon } from "@/components/ui";
import type { TimelineEvent } from "./load-events";

/*
 * ส่วนแสดงผลกิจกรรม (ใช้ทั้งหน้ากิจกรรมและหน้าภาพรวม) — Server Component เท่านั้น
 * เพราะใช้ formatRelativeTime ซึ่งคำนวณจากเวลาปัจจุบันฝั่งเซิร์ฟเวอร์
 */

type Tone = "neutral" | "good" | "critical" | "accent" | "warning";

interface EventType {
  label: string;
  tone: Tone;
  icon: LucideIcon;
  /** คำนำหน้าชื่อลูกค้า เช่น "จาก Ploy" / "ถึง Ploy" */
  who: "จาก" | "ถึง" | "โดย";
}

export const EVENT_TYPES: Record<string, EventType> = {
  comment_received: { label: "มีคนคอมเมนต์", tone: "neutral", icon: MessageCircle, who: "จาก" },
  dm_received: { label: "มีคนทักแชท", tone: "neutral", icon: MessagesSquare, who: "จาก" },
  rule_triggered: { label: "ตรงกับกฎ", tone: "accent", icon: Zap, who: "จาก" },
  public_reply_sent: { label: "ตอบใต้คอมเมนต์แล้ว", tone: "good", icon: Reply, who: "ถึง" },
  public_reply_failed: { label: "ตอบใต้คอมเมนต์ไม่สำเร็จ", tone: "critical", icon: MessageCircleX, who: "ถึง" },
  dm_sent: { label: "ส่ง DM แล้ว", tone: "good", icon: Send, who: "ถึง" },
  dm_failed: { label: "ส่ง DM ไม่สำเร็จ", tone: "critical", icon: MailX, who: "ถึง" },
  button_clicked: { label: "กดปุ่ม", tone: "accent", icon: MousePointerClick, who: "โดย" },
  link_clicked: { label: "คลิกลิงก์", tone: "accent", icon: Link2, who: "โดย" },
  skipped: { label: "ข้าม ไม่ได้ส่ง", tone: "warning", icon: SkipForward, who: "จาก" },
  post_bound: { label: "กฎเริ่มใช้กับโพสต์ใหม่แล้ว", tone: "accent", icon: Pin, who: "โดย" },
};

const FALLBACK: EventType = { label: "กิจกรรม", tone: "neutral", icon: Activity, who: "จาก" };

export function eventType(type: string): EventType {
  return EVENT_TYPES[type] ?? { ...FALLBACK, label: type };
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
  const t = eventType(type);
  const Icon = t.icon;
  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "sm" ? "size-7 [&_svg]:size-3.5" : "size-8 [&_svg]:size-4",
        CHIP_TONES[t.tone],
        className,
      )}
    >
      <Icon aria-hidden strokeWidth={2} />
    </span>
  );
}

/** เวลาแบบ "5 นาทีที่ผ่านมา" — ชี้เมาส์เพื่อดูวันเวลาเต็ม */
export function RelativeTime({ date, now, className }: { date: Date | string | null; now?: Date; className?: string }) {
  if (!date) return <span className={className}>–</span>;
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <time dateTime={d.toISOString()} title={formatDateTime(d)} className={cx("whitespace-nowrap tabular", className)}>
      {formatRelativeTime(d, now)}
    </time>
  );
}

const SKIP_REASONS: Record<string, string> = {
  once_per_user: "คนนี้เคยได้รับจากกฎนี้แล้ว (ตั้งไว้ให้ส่งครั้งเดียวต่อคน)",
  rule_inactive: "กฎนี้ปิดอยู่ จึงไม่ส่งข้อความถัดไป",
  next_post_lookup_failed: "เช็คกับ Meta ไม่ได้ว่าโพสต์นี้เป็นโพสต์ถัดไปของกฎหรือเปล่า จึงยังไม่ส่ง (คอมเมนต์ถัดไปจะลองเช็คใหม่)",
};

/** คำอธิบายภาษาคนของรหัสผิดพลาดที่พบบ่อยจาก Meta */
function errorHint(code: string | null): string | null {
  const [main, sub] = code?.split(" / ") ?? [];
  if (sub === "2018278") return "เกิน 24 ชั่วโมงหลังจากลูกค้าทักมาครั้งล่าสุด Meta จึงไม่ให้ส่งข้อความนี้";
  switch (main) {
    case "190":
      return "สิทธิ์ของเพจหมดอายุ ไปที่หน้าตั้งค่าแล้วเชื่อมต่อเพจใหม่";
    case "10":
    case "200":
      return "แอปยังไม่ได้รับสิทธิ์นี้ ถ้ายังไม่ผ่าน App Review จะส่งได้เฉพาะบัญชีผู้ทดสอบของแอป";
    case "551":
      return "ผู้รับไม่สามารถรับข้อความได้ในตอนนี้";
    case "4":
    case "32":
    case "613":
      return "ส่งถี่เกินไป Meta จำกัดจำนวนชั่วคราว รอสักครู่แล้วระบบจะใช้งานได้ตามปกติ";
    default:
      return null;
  }
}

/** ข้อความยาว → แสดง 3 บรรทัดแรก กดเพื่อดูทั้งหมด (ไม่ต้องใช้ JavaScript) */
function Expandable({ text, className, lines = 3 }: { text: string; className?: string; lines?: 2 | 3 }) {
  const long = text.length > 140 || text.split("\n").length > lines;
  const clamp = lines === 2 ? "line-clamp-2" : "line-clamp-3";
  if (!long) return <span className={cx("block break-words whitespace-pre-line", className)}>{text}</span>;
  return (
    <details className="group/more">
      <summary className="cursor-pointer list-none rounded-md [&::-webkit-details-marker]:hidden">
        <span className={cx("break-words whitespace-pre-line group-open/more:line-clamp-none", clamp, className)}>{text}</span>
        <span className="mt-1 inline-block text-xs font-medium text-accent group-open/more:hidden">ดูทั้งหมด</span>
        <span className="mt-1 hidden text-xs font-medium text-accent group-open/more:inline-block">ย่อ</span>
      </summary>
    </details>
  );
}

function Person({ event }: { event: TimelineEvent }) {
  if (!event.person) return null;
  return (
    <span className="text-fg-2">
      {eventType(event.type).who} <span className="font-medium text-fg">{event.person}</span>
    </span>
  );
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
export function TimelineItem({ event, now, last }: { event: TimelineEvent; now: Date; last?: boolean }) {
  const t = eventType(event.type);
  const isButton = event.type === "button_clicked";
  const skip = event.skipReason ? (SKIP_REASONS[event.skipReason] ?? event.skipReason) : null;
  const hint = event.error ? errorHint(event.error.code) : null;

  return (
    <li className="relative flex gap-3 px-4 py-3.5 sm:px-5">
      {/* เส้นเชื่อมระหว่างไอคอน */}
      {!last && <span aria-hidden className="absolute top-[50px] -bottom-2.5 left-[31.5px] w-px bg-line sm:left-[35.5px]" />}
      <EventMark event={event} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 text-sm leading-6">
            <span className={cx("font-semibold", t.tone === "critical" ? "text-critical-text" : "text-fg")}>{t.label}</span>
            {isButton && event.text && <span className="text-fg"> “{event.text}”</span>} <Person event={event} />
          </p>
          <RelativeTime date={event.createdAt} now={now} className="mt-0.5 hidden shrink-0 text-xs leading-5 text-fg-3 sm:block" />
        </div>

        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-5 text-fg-3">
          <RelativeTime date={event.createdAt} now={now} className="sm:hidden" />
          {event.ruleId !== null && event.ruleName !== null && (
            <Link href={`/rules/${event.ruleId}`} className="inline-flex max-w-full min-w-0 items-center gap-1 rounded hover:text-accent">
              <Zap className="size-3 shrink-0" aria-hidden />
              <span className="truncate">กฎ: {event.ruleName}</span>
            </Link>
          )}
        </div>

        {!isButton && (event.text || event.buttons.length > 0) && (
          <div className="mt-2 max-w-2xl rounded-xl bg-surface-2 px-3 py-2 text-sm leading-6 text-fg-2">
            {event.text && <Expandable text={event.text} />}
            {event.buttons.length > 0 && (
              <div className={cx("flex flex-wrap gap-1.5", event.text && "mt-2")} role="group" aria-label="ปุ่มในข้อความ">
                {event.buttons.map((b, i) => (
                  <span
                    key={i}
                    className="inline-flex h-7 max-w-full items-center truncate rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-accent"
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {skip && <p className="mt-1.5 text-sm text-warning-text">{skip}</p>}

        {event.error && (
          <div className="mt-2 flex max-w-2xl gap-2 rounded-xl border border-critical/25 bg-critical-soft px-3 py-2 text-sm leading-6">
            <CircleAlert className="mt-1 size-4 shrink-0 text-critical-text" aria-hidden />
            <div className="min-w-0 flex-1">
              <Expandable text={`สาเหตุ: ${event.error.message}`} className="text-critical-text" lines={2} />
              {hint && <p className="mt-1 text-fg-2">{hint}</p>}
              {event.error.code && <p className="mt-0.5 text-xs text-fg-3">รหัสจาก Meta: {event.error.code}</p>}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/** รายการกิจกรรมแบบย่อ (การ์ด "กิจกรรมล่าสุด" ในหน้าภาพรวม) */
export function TimelineItemCompact({ event, now }: { event: TimelineEvent; now: Date }) {
  const t = eventType(event.type);
  const detail: ReactNode =
    event.type === "button_clicked" && event.text
      ? `“${event.text}”`
      : event.error
        ? event.error.message
        : (event.text ?? (event.ruleName ? `กฎ: ${event.ruleName}` : null));
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <EventMark event={event} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-sm leading-6">
            <span className={cx("font-medium", t.tone === "critical" ? "text-critical-text" : "text-fg")}>{t.label}</span>{" "}
            <Person event={event} />
          </p>
          <RelativeTime date={event.createdAt} now={now} className="mt-0.5 shrink-0 text-xs leading-5 text-fg-3" />
        </div>
        {detail && <p className={cx("truncate text-xs leading-5", event.error ? "text-critical-text" : "text-fg-3")}>{detail}</p>}
      </div>
    </li>
  );
}
