import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  ArrowRight,
  ChevronRight,
  CircleCheck,
  CircleX,
  History,
  Inbox,
  ListFilter,
  MessagesSquare,
  MousePointerClick,
  RefreshCw,
  Send,
} from "lucide-react";
import { getDb } from "@/db/client";
import { events, jobs, webhookLogs } from "@/db/schema";
import { SegmentedControl } from "@/components/segmented-control";
import {
  ButtonLink,
  Card,
  EmptyState,
  formatDateTime,
  formatNumber,
  Notice,
  PageHeader,
  PlatformIcon,
  Section,
} from "@/components/ui";
import { env } from "@/lib/env";
import { FilterScroller } from "./filter-scroller";
import { loadEvents, type TimelineEvent } from "./load-events";
import { RelativeTime, TimelineItem } from "./timeline";

const PAGE_SIZE = 50;
const FAILED_TYPES = ["dm_failed", "public_reply_failed"];

const FILTERS = [
  { key: "all", label: "ทั้งหมด", types: null, icon: <ListFilter /> },
  { key: "incoming", label: "ข้อความเข้า", types: ["comment_received", "dm_received"], icon: <MessagesSquare /> },
  { key: "sent", label: "ส่งแล้ว", types: ["dm_sent", "public_reply_sent"], icon: <Send /> },
  { key: "clicks", label: "กดปุ่ม/คลิก", types: ["button_clicked", "link_clicked"], icon: <MousePointerClick /> },
  { key: "failed", label: "ไม่สำเร็จ", types: FAILED_TYPES, icon: <CircleX /> },
] as const;

const JOB_LABELS: Record<string, string> = {
  comment: "จัดการคอมเมนต์",
  dm: "จัดการข้อความแชท",
  read: "อัปเดตสถานะอ่านแล้ว",
  send_dm: "ส่ง DM",
};

const EMPTY_TEXT: Record<string, string> = {
  incoming: "ยังไม่มีคอมเมนต์หรือแชทเข้ามา",
  sent: "ยังไม่มีข้อความที่ระบบส่งออกไป",
  clicks: "ยังไม่มีใครกดปุ่มหรือคลิกลิงก์",
  failed: "ไม่มีรายการที่ส่งไม่สำเร็จ",
};

/** แบ่งรายการเป็นกลุ่มตามวัน (ตามเขตเวลาของระบบ) */
function groupByDay(items: TimelineEvent[], now: Date): { key: string; label: string; date: string; items: TimelineEvent[] }[] {
  const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: env.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const longFormat = new Intl.DateTimeFormat("th-TH", { timeZone: env.timezone, weekday: "long", day: "numeric", month: "long" });
  const today = keyFormat.format(now);
  const yesterday = keyFormat.format(new Date(now.getTime() - 86_400_000));
  const groups: { key: string; label: string; date: string; items: TimelineEvent[] }[] = [];
  for (const item of items) {
    const key = keyFormat.format(item.createdAt);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const date = longFormat.format(item.createdAt);
      group = { key, label: key === today ? "วันนี้" : key === yesterday ? "เมื่อวาน" : date, date, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

function webhookSource(object: string | null): { label: string; platform: "facebook" | "instagram" | null } {
  if (object === "instagram") return { label: "Instagram", platform: "instagram" };
  if (object === "page") return { label: "Facebook Page", platform: "facebook" };
  return { label: object ?? "ไม่ทราบที่มา", platform: null };
}

/** สรุปว่าข้อมูลจาก Meta ก้อนนี้มีอะไรบ้าง เช่น "คอมเมนต์ · กดปุ่ม 2" (อ่านอย่างเดียว ไม่เชื่อโครงสร้างข้อมูล) */
function webhookSummary(body: unknown): string | null {
  const counts = new Map<string, number>();
  const add = (label: string) => counts.set(label, (counts.get(label) ?? 0) + 1);
  const entries = (body as { entry?: unknown } | null)?.entry;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const e = (entry ?? {}) as { changes?: unknown; messaging?: unknown };
    for (const change of Array.isArray(e.changes) ? e.changes : []) {
      const field = (change as { field?: unknown } | null)?.field;
      add(field === "feed" || field === "comments" ? "คอมเมนต์" : typeof field === "string" ? field : "อื่นๆ");
    }
    for (const m of Array.isArray(e.messaging) ? e.messaging : []) {
      const msg = (m ?? {}) as { message?: { is_echo?: unknown }; postback?: unknown; read?: unknown };
      if (msg.message) add(msg.message.is_echo ? "ข้อความจากเพจ" : "แชท");
      else if (msg.postback) add("กดปุ่ม");
      else if (msg.read) add("อ่านแล้ว");
      else add("อื่นๆ");
    }
  }
  if (counts.size === 0) return null;
  return [...counts].map(([label, n]) => (n > 1 ? `${label} ${formatNumber(n)}` : label)).join(" · ");
}

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const params = await searchParams;
  const filterKey = String(params.filter ?? "all");
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const before = Math.max(0, Math.floor(Number(params.before) || 0)) || null;
  const now = new Date();
  const db = getDb();

  const [{ items, hasMore }, failedJobs, logs, recentFailed] = await Promise.all([
    loadEvents(db, { types: filter.types, before, limit: PAGE_SIZE }),
    db.select().from(jobs).where(eq(jobs.status, "failed")).orderBy(desc(jobs.updatedAt)).limit(10),
    db.select().from(webhookLogs).orderBy(desc(webhookLogs.id)).limit(10),
    db
      .select({ n: count() })
      .from(events)
      .where(and(inArray(events.type, FAILED_TYPES), gte(events.createdAt, sql`now() - interval '24 hours'`))),
  ]);
  const failedToday = Number(recentFailed[0]?.n ?? 0);

  const filterHref = (key: string) => (key === "all" ? "/activity" : `/activity?filter=${key}`);
  const currentHref = filterHref(filter.key);
  const olderHref = items.length
    ? `/activity?${new URLSearchParams({ ...(filter.key !== "all" ? { filter: filter.key } : {}), before: String(items[items.length - 1].id) })}`
    : null;
  const groups = groupByDay(items, now);

  return (
    <>
      <PageHeader
        title="กิจกรรม"
        description="ทุกอย่างที่ระบบได้รับและทำไป เรียงจากล่าสุด ใช้ดูว่าระบบตอบลูกค้าแล้วหรือยัง และหาสาเหตุเวลาระบบไม่ตอบ"
        actions={
          <ButtonLink href={currentHref} variant="secondary" icon={<RefreshCw />}>
            อัปเดตรายการ
          </ButtonLink>
        }
      />

      <div className="space-y-6">
        {failedToday > 0 && filter.key !== "failed" && (
          <Notice
            tone="critical"
            title={`ส่งไม่สำเร็จ ${formatNumber(failedToday)} รายการ ใน 24 ชั่วโมงที่ผ่านมา`}
            actions={
              <ButtonLink href="/activity?filter=failed" variant="secondary" size="sm" iconRight={<ArrowRight />}>
                ดูสาเหตุ
              </ButtonLink>
            }
          >
            กดดูสาเหตุและวิธีแก้ของแต่ละรายการ
          </Notice>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {/* บนมือถือเลื่อนแถบตัวกรองซ้าย/ขวาได้ */}
          <FilterScroller className="no-scrollbar -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0">
            <SegmentedControl
              label="กรองตามประเภท"
              value={filter.key}
              className="max-w-none!"
              options={FILTERS.map((f) => ({ value: f.key, label: f.label, icon: f.icon, href: filterHref(f.key) }))}
            />
          </FilterScroller>
          {items.length > 0 && (
            <p className="text-xs text-fg-3">
              {before ? "รายการที่เก่ากว่า" : "ล่าสุด"} {formatNumber(items.length)} รายการ
            </p>
          )}
        </div>

        {before && (
          <Notice
            tone="neutral"
            icon={<History />}
            actions={
              <ButtonLink href={currentHref} variant="ghost" size="sm">
                กลับไปรายการล่าสุด
              </ButtonLink>
            }
          >
            กำลังดูรายการย้อนหลัง
          </Notice>
        )}

        {items.length === 0 ? (
          filter.key === "all" && !before ? (
            <EmptyState
              title="ยังไม่มีกิจกรรม"
              icon={<Inbox />}
              action={
                <ButtonLink href="/guide" variant="secondary">
                  เปิดคู่มือตั้งค่า
                </ButtonLink>
              }
            >
              ลองคอมเมนต์หรือทักแชทเพจของคุณดู ถ้าตั้งค่าถูกต้อง รายการจะขึ้นที่นี่ภายในไม่กี่วินาที
            </EmptyState>
          ) : (
            <EmptyState
              title={before ? "ไม่มีรายการที่เก่ากว่านี้" : (EMPTY_TEXT[filter.key] ?? "ไม่มีรายการ")}
              icon={filter.key === "failed" && !before ? <CircleCheck className="text-good-text" /> : undefined}
              compact
              action={
                <ButtonLink href="/activity" variant="secondary">
                  ดูกิจกรรมทั้งหมด
                </ButtonLink>
              }
            >
              {filter.key === "failed" && !before ? "ระบบตอบลูกค้าได้ตามปกติ" : undefined}
            </EmptyState>
          )
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <Card key={g.key} padding="none">
                <h2 className="flex items-baseline gap-2 rounded-t-xl border-b border-line bg-surface-2/60 px-4 py-2.5 text-sm font-semibold text-fg sm:px-5">
                  {g.label}
                  {g.label !== g.date && <span className="text-xs font-normal text-fg-3">{g.date}</span>}
                  <span className="ml-auto text-xs font-normal text-fg-3 tabular">{formatNumber(g.items.length)} รายการ</span>
                </h2>
                <ul>
                  {g.items.map((e, i) => (
                    <TimelineItem key={e.id} event={e} now={now} last={i === g.items.length - 1} />
                  ))}
                </ul>
              </Card>
            ))}
            {hasMore && olderHref && (
              <div className="flex justify-center pt-2">
                <ButtonLink href={olderHref} variant="secondary" icon={<History />}>
                  ดูรายการที่เก่ากว่า
                </ButtonLink>
              </div>
            )}
          </div>
        )}

        <Section
          title="สำหรับตรวจสอบปัญหา"
          description="ข้อมูลทางเทคนิค ใช้ดูเวลาระบบไม่ตอบ หรือส่งให้คนที่ช่วยดูแลระบบ"
          className="pt-4"
        >
          {failedJobs.length > 0 && (
            <Card
              title="งานที่ล้มเหลว"
              description="ระบบลองใหม่จนครบจำนวนครั้งแล้วยังไม่สำเร็จ"
              icon={<CircleX className="text-critical-text" />}
              padding="none"
            >
              <ul className="divide-y divide-line">
                {failedJobs.map((j) => (
                  <li key={j.id} className="px-5 py-3.5 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="font-medium text-fg">
                        {JOB_LABELS[j.type] ?? j.type} <span className="font-normal text-fg-3">#{j.id}</span>
                      </span>
                      <RelativeTime date={j.updatedAt} now={now} className="text-xs text-fg-3" />
                    </div>
                    {j.lastError && <p className="mt-1 text-sm break-words text-critical-text">{j.lastError}</p>}
                    <p className="mt-0.5 text-xs text-fg-3">ลองไปแล้ว {formatNumber(j.attempts)} ครั้ง</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card
            title="ข้อมูลที่ Meta ส่งเข้ามาล่าสุด (webhook)"
            description="ข้อมูลดิบจาก Meta เก็บไว้ 7 วัน ถ้าว่างแปลว่า Meta ยังไม่ได้ส่งข้อมูลเข้ามาที่ระบบ"
            padding="none"
          >
            {logs.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="ยังไม่เคยได้รับข้อมูลจาก Meta"
                  compact
                  action={
                    <ButtonLink href="/guide" variant="secondary">
                      ตรวจขั้นตอนตั้งค่า
                    </ButtonLink>
                  }
                >
                  ตรวจขั้นตอนตั้งค่า Webhook ในคู่มือ แล้วลองคอมเมนต์ที่เพจอีกครั้ง
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {logs.map((log) => {
                  const source = webhookSource(log.object);
                  const summary = webhookSummary(log.body);
                  return (
                    <li key={log.id}>
                      <details className="group">
                        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-surface-2/50 [&::-webkit-details-marker]:hidden">
                          <ChevronRight className="size-4 shrink-0 text-fg-3 transition-transform group-open:rotate-90" aria-hidden />
                          {source.platform && <PlatformIcon platform={source.platform} size={16} />}
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium text-fg">{source.label}</span>
                            {summary && <span className="text-fg-3"> · {summary}</span>}
                          </span>
                          <span className="hidden text-xs text-fg-3 sm:inline">{formatDateTime(log.receivedAt)}</span>
                          <RelativeTime date={log.receivedAt} now={now} className="text-xs text-fg-3 sm:hidden" />
                        </summary>
                        <pre className="scroll-thin mx-5 mb-4 max-h-72 overflow-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs leading-5 text-fg-2">
                          {JSON.stringify(log.body, null, 2)}
                        </pre>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </Section>
      </div>
    </>
  );
}
