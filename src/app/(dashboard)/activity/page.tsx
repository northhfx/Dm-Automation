import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { ReactNode } from "react";
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
import { NavTitle } from "@/components/localized";
import { SegmentedControl } from "@/components/segmented-control";
import { ButtonLink, Card, EmptyState, Notice, PageHeader, PlatformIcon, Section } from "@/components/ui";
import { env } from "@/lib/env";
import { createT, formatters, type Locale, type MessageKey, type TFunction } from "@/lib/i18n";
import type { activityMessages } from "@/lib/i18n/messages/activity";
import { commonMessages } from "@/lib/i18n/messages/common";
import { getT } from "@/lib/i18n/server";
import { localizeSystemMessage } from "@/lib/i18n/system";
import { FAILED_TYPES, failureSummary } from "./failure-summary";
import { FilterScroller } from "./filter-scroller";
import { loadEvents, type TimelineEvent } from "./load-events";
import { RelativeTime, TimelineItem } from "./timeline";

const PAGE_SIZE = 50;

type ActivityKey = MessageKey<typeof activityMessages>;
type T = TFunction<ActivityKey>;

const FILTERS = [
  { key: "all", label: "filterAll", types: null, icon: <ListFilter /> },
  { key: "incoming", label: "filterIncoming", types: ["comment_received", "dm_received"], icon: <MessagesSquare /> },
  { key: "sent", label: "filterSent", types: ["dm_sent", "public_reply_sent"], icon: <Send /> },
  { key: "clicks", label: "filterClicks", types: ["button_clicked", "link_clicked"], icon: <MousePointerClick /> },
  { key: "failed", label: "filterFailed", types: FAILED_TYPES, icon: <CircleX /> },
] as const satisfies readonly { key: string; label: ActivityKey; types: readonly string[] | null; icon: ReactNode }[];

const JOB_LABELS: Record<string, ActivityKey> = {
  comment: "jobComment",
  dm: "jobDm",
  read: "jobRead",
  send_dm: "jobSendDm",
};

const EMPTY_TEXT: Record<string, ActivityKey> = {
  incoming: "emptyIncoming",
  sent: "emptySent",
  clicks: "emptyClicks",
  failed: "emptyFailed",
};

/** แบ่งรายการเป็นกลุ่มตามวัน (ตามเขตเวลาของระบบ) — ชื่อวันตามภาษาที่เลือก */
function groupByDay(items: TimelineEvent[], now: Date, locale: Locale): { key: string; label: string; date: string; items: TimelineEvent[] }[] {
  // key ของวัน (YYYY-MM-DD) ใช้เทียบเท่านั้น ไม่ได้แสดง → ใช้ en-CA เสมอ
  const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: env.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const f = formatters(locale);
  const t = createT(commonMessages, locale);
  const longDate: Intl.DateTimeFormatOptions = { timeZone: env.timezone, weekday: "long", day: "numeric", month: "long" };
  const today = keyFormat.format(now);
  const yesterday = keyFormat.format(new Date(now.getTime() - 86_400_000));
  const groups: { key: string; label: string; date: string; items: TimelineEvent[] }[] = [];
  for (const item of items) {
    const key = keyFormat.format(item.createdAt);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const date = f.date(item.createdAt, longDate);
      group = { key, label: key === today ? t("today") : key === yesterday ? t("yesterday") : date, date, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** ข้อมูลมาจากไหน: source = ช่องทางที่ลายเซ็นตรง (instagram_login / facebook_login), object = ชนิดของข้อมูลจาก Meta */
function webhookSource(object: string | null, source: string | null, t: T): { label: string; platform: "facebook" | "instagram" | null } {
  if (source === "instagram_login") return { label: "Instagram (Instagram Login)", platform: "instagram" };
  if (object === "instagram") return { label: t("sourceInstagramViaPage"), platform: "instagram" };
  if (object === "page") return { label: "Facebook Page", platform: "facebook" };
  return { label: object ?? t("sourceUnknown"), platform: null };
}

/** สรุปว่าข้อมูลจาก Meta ก้อนนี้มีอะไรบ้าง เช่น "คอมเมนต์ · กดปุ่ม 2" (อ่านอย่างเดียว ไม่เชื่อโครงสร้างข้อมูล) */
function webhookSummary(body: unknown, t: T): string | null {
  const counts = new Map<string, number>();
  const add = (label: string) => counts.set(label, (counts.get(label) ?? 0) + 1);
  const entries = (body as { entry?: unknown } | null)?.entry;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const e = (entry ?? {}) as { changes?: unknown; messaging?: unknown };
    for (const change of Array.isArray(e.changes) ? e.changes : []) {
      const field = (change as { field?: unknown } | null)?.field;
      add(field === "feed" || field === "comments" ? t("whComment") : typeof field === "string" ? field : t("whOther"));
    }
    for (const m of Array.isArray(e.messaging) ? e.messaging : []) {
      const msg = (m ?? {}) as { message?: { is_echo?: unknown }; postback?: unknown; read?: unknown };
      if (msg.message) add(msg.message.is_echo ? t("whPageMessage") : t("whChat"));
      else if (msg.postback) add(t("whButton"));
      else if (msg.read) add(t("whRead"));
      else add(t("whOther"));
    }
  }
  if (counts.size === 0) return null;
  return [...counts].map(([label, n]) => (n > 1 ? t("whCount", { label, count: n }) : label)).join(" · ");
}

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const params = await searchParams;
  const filterKey = String(params.filter ?? "all");
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const before = Math.max(0, Math.floor(Number(params.before) || 0)) || null;
  const now = new Date();
  const db = getDb();

  const [t, { items, hasMore }, failedJobs, logs, recentFailed] = await Promise.all([
    getT("activity"),
    loadEvents(db, { types: filter.types, before, limit: PAGE_SIZE }),
    db.select().from(jobs).where(eq(jobs.status, "failed")).orderBy(desc(jobs.updatedAt)).limit(10),
    db.select().from(webhookLogs).orderBy(desc(webhookLogs.id)).limit(10),
    db
      .select({ type: events.type, n: count() })
      .from(events)
      .where(and(inArray(events.type, FAILED_TYPES), gte(events.createdAt, sql`now() - interval '24 hours'`)))
      .groupBy(events.type),
  ]);
  const locale = t.locale;
  const f = formatters(locale);
  const failures = failureSummary(Object.fromEntries(recentFailed.map((r) => [r.type, Number(r.n)])), locale);

  const filterHref = (key: string) => (key === "all" ? "/activity" : `/activity?filter=${key}`);
  const currentHref = filterHref(filter.key);
  const olderHref = items.length
    ? `/activity?${new URLSearchParams({ ...(filter.key !== "all" ? { filter: filter.key } : {}), before: String(items[items.length - 1].id) })}`
    : null;
  const groups = groupByDay(items, now, locale);

  return (
    <>
      <PageHeader
        title={<NavTitle name="activity" />}
        description={t("description")}
        actions={
          <ButtonLink href={currentHref} variant="secondary" icon={<RefreshCw />}>
            {t("refresh")}
          </ButtonLink>
        }
      />

      <div className="space-y-6">
        {failures && filter.key !== "failed" && (
          <Notice
            tone="critical"
            title={failures.title}
            actions={
              <ButtonLink href={failures.href} variant="secondary" size="sm" iconRight={<ArrowRight />}>
                {failures.action}
              </ButtonLink>
            }
          >
            {failures.description}
          </Notice>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {/* บนมือถือเลื่อนแถบตัวกรองซ้าย/ขวาได้ */}
          <FilterScroller className="no-scrollbar -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0">
            <SegmentedControl
              label={t("filterLabel")}
              value={filter.key}
              className="max-w-none!"
              options={FILTERS.map((o) => ({ value: o.key, label: t(o.label), icon: o.icon, href: filterHref(o.key) }))}
            />
          </FilterScroller>
          {items.length > 0 && (
            <p className="text-xs text-fg-3">{t(before ? "countOlder" : "countLatest", { count: items.length })}</p>
          )}
        </div>

        {before && (
          <Notice
            tone="neutral"
            icon={<History />}
            actions={
              <ButtonLink href={currentHref} variant="ghost" size="sm">
                {t("backToLatest")}
              </ButtonLink>
            }
          >
            {t("olderNotice")}
          </Notice>
        )}

        {items.length === 0 ? (
          filter.key === "all" && !before ? (
            <EmptyState
              title={t("emptyTitle")}
              icon={<Inbox />}
              action={
                <ButtonLink href="/guide" variant="secondary">
                  {t("emptyAction")}
                </ButtonLink>
              }
            >
              {t("emptyBody")}
            </EmptyState>
          ) : (
            <EmptyState
              title={t(before ? "emptyOlder" : (EMPTY_TEXT[filter.key] ?? "emptyOther"))}
              icon={filter.key === "failed" && !before ? <CircleCheck className="text-good-text" /> : undefined}
              compact
              action={
                <ButtonLink href="/activity" variant="secondary">
                  {t("emptyViewAll")}
                </ButtonLink>
              }
            >
              {filter.key === "failed" && !before ? t("emptyFailedBody") : undefined}
            </EmptyState>
          )
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <Card key={g.key} padding="none">
                <h2 className="flex items-baseline gap-2 rounded-t-xl border-b border-line bg-surface-2/60 px-4 py-2.5 text-sm font-semibold text-fg sm:px-5">
                  {g.label}
                  {g.label !== g.date && <span className="text-xs font-normal text-fg-3">{g.date}</span>}
                  <span className="ml-auto text-xs font-normal text-fg-3 tabular">{t("groupCount", { count: g.items.length })}</span>
                </h2>
                <ul>
                  {g.items.map((e, i) => (
                    <TimelineItem key={e.id} event={e} now={now} last={i === g.items.length - 1} locale={locale} />
                  ))}
                </ul>
              </Card>
            ))}
            {hasMore && olderHref && (
              <div className="flex justify-center pt-2">
                <ButtonLink href={olderHref} variant="secondary" icon={<History />}>
                  {t("loadOlder")}
                </ButtonLink>
              </div>
            )}
          </div>
        )}

        <Section
          title={t("debugTitle")}
          description={t("debugDescription")}
          className="pt-4"
        >
          {failedJobs.length > 0 && (
            <Card
              title={t("failedJobsTitle")}
              description={t("failedJobsDescription")}
              icon={<CircleX className="text-critical-text" />}
              padding="none"
            >
              <ul className="divide-y divide-line">
                {failedJobs.map((j) => (
                  <li key={j.id} className="px-5 py-3.5 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="font-medium text-fg">
                        {JOB_LABELS[j.type] ? t(JOB_LABELS[j.type]) : j.type} <span className="font-normal text-fg-3">#{j.id}</span>
                      </span>
                      <RelativeTime date={j.updatedAt} now={now} locale={locale} className="text-xs text-fg-3" />
                    </div>
                    {j.lastError && (
                      <p className="mt-1 text-sm break-words text-critical-text">{localizeSystemMessage(j.lastError, locale)}</p>
                    )}
                    <p className="mt-0.5 text-xs text-fg-3">{t("jobAttempts", { count: j.attempts })}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card
            title={t("webhookTitle")}
            description={t("webhookDescription")}
            padding="none"
          >
            {logs.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title={t("webhookEmptyTitle")}
                  compact
                  action={
                    <ButtonLink href="/guide" variant="secondary">
                      {t("webhookEmptyAction")}
                    </ButtonLink>
                  }
                >
                  {t("webhookEmptyBody")}
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {logs.map((log) => {
                  const source = webhookSource(log.object, log.source, t);
                  const summary = webhookSummary(log.body, t);
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
                          <span className="hidden text-xs text-fg-3 sm:inline">{f.dateTime(log.receivedAt)}</span>
                          <RelativeTime date={log.receivedAt} now={now} locale={locale} className="text-xs text-fg-3 sm:hidden" />
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
