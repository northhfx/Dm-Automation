import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import type { Platform } from "@/db/schema";
import { env } from "@/lib/env";

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export function parseRange(value: string | string[] | undefined): RangeDays {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (RANGE_OPTIONS as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

export interface PlatformCounts {
  facebook: number;
  instagram: number;
}

export interface OverviewTotals {
  commentsReceived: PlatformCounts;
  dmsReceived: PlatformCounts;
  triggers: PlatformCounts;
  publicReplies: number;
  dmsSent: PlatformCounts;
  dmsFailed: number;
  dmsRead: number;
  linksSent: number;
  linksClicked: number;
  totalClicks: number;
  newContacts: number;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD ตามเขตเวลาของระบบ
  sent: number;
  clicks: number;
  triggers: number;
}

export interface RuleStats {
  id: number;
  name: string;
  trigger: "comment" | "dm";
  platforms: Platform[];
  active: boolean;
  triggers: number;
  sent: number;
  failed: number;
  read: number;
  linksSent: number;
  linksClicked: number;
}

export interface Overview {
  days: number;
  totals: OverviewTotals;
  daily: DailyPoint[];
  rules: RuleStats[];
}

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

function emptyPlatformCounts(): PlatformCounts {
  return { facebook: 0, instagram: 0 };
}

export function sum(counts: PlatformCounts): number {
  return counts.facebook + counts.instagram;
}

/** สถิติทั้งหมดของหน้าภาพรวม ในช่วง N วันล่าสุด (นับรวมวันนี้) */
export async function getOverview(db: Db, days: number): Promise<Overview> {
  const tz = env.timezone;
  const since = sql`((date_trunc('day', now() AT TIME ZONE ${tz}) - ${days - 1} * interval '1 day') AT TIME ZONE ${tz})`;

  const [eventRows, messageRows, linkRow, contactRow, dailyRows, ruleRows] = await Promise.all([
    db.execute<Row>(sql`
      SELECT type, platform, count(*)::int AS n FROM events
      WHERE created_at >= ${since} GROUP BY type, platform
    `),
    db.execute<Row>(sql`
      SELECT status, platform, count(*)::int AS n, count(read_at)::int AS read FROM messages
      WHERE sent_at >= ${since} GROUP BY status, platform
    `),
    db.execute<Row>(sql`
      SELECT count(*)::int AS sent, count(*) FILTER (WHERE clicks > 0)::int AS clicked, coalesce(sum(clicks), 0)::int AS clicks
      FROM links WHERE created_at >= ${since}
    `),
    db.execute<Row>(sql`SELECT count(*)::int AS n FROM contacts WHERE first_seen_at >= ${since}`),
    db.execute<Row>(sql`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', now() AT TIME ZONE ${tz}) - ${days - 1} * interval '1 day',
          date_trunc('day', now() AT TIME ZONE ${tz}),
          interval '1 day'
        ) AS day
      ),
      counts AS (
        SELECT date_trunc('day', created_at AT TIME ZONE ${tz}) AS day,
          count(*) FILTER (WHERE type = 'dm_sent')::int AS sent,
          count(*) FILTER (WHERE type = 'link_clicked')::int AS clicks,
          count(*) FILTER (WHERE type = 'rule_triggered')::int AS triggers
        FROM events WHERE created_at >= ${since}
        GROUP BY 1
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
        coalesce(counts.sent, 0) AS sent, coalesce(counts.clicks, 0) AS clicks, coalesce(counts.triggers, 0) AS triggers
      FROM days LEFT JOIN counts ON counts.day = days.day
      ORDER BY days.day
    `),
    db.execute<Row>(sql`
      SELECT r.id, r.name, r.trigger, r.platforms, r.active,
        coalesce(e.triggers, 0)::int AS triggers,
        coalesce(m.sent, 0)::int AS sent, coalesce(m.failed, 0)::int AS failed, coalesce(m.read, 0)::int AS read,
        coalesce(l.sent, 0)::int AS links_sent, coalesce(l.clicked, 0)::int AS links_clicked
      FROM rules r
      LEFT JOIN (
        SELECT rule_id, count(*) AS triggers FROM events
        WHERE type = 'rule_triggered' AND created_at >= ${since} GROUP BY rule_id
      ) e ON e.rule_id = r.id
      LEFT JOIN (
        SELECT rule_id, count(*) FILTER (WHERE status = 'sent') AS sent, count(*) FILTER (WHERE status = 'failed') AS failed,
          count(read_at) AS read
        FROM messages WHERE sent_at >= ${since} GROUP BY rule_id
      ) m ON m.rule_id = r.id
      LEFT JOIN (
        SELECT rule_id, count(*) AS sent, count(*) FILTER (WHERE clicks > 0) AS clicked
        FROM links WHERE created_at >= ${since} GROUP BY rule_id
      ) l ON l.rule_id = r.id
      ORDER BY coalesce(e.triggers, 0) DESC, r.id
    `),
  ]);

  const totals: OverviewTotals = {
    commentsReceived: emptyPlatformCounts(),
    dmsReceived: emptyPlatformCounts(),
    triggers: emptyPlatformCounts(),
    publicReplies: 0,
    dmsSent: emptyPlatformCounts(),
    dmsFailed: 0,
    dmsRead: 0,
    linksSent: num(linkRow.rows[0]?.sent),
    linksClicked: num(linkRow.rows[0]?.clicked),
    totalClicks: num(linkRow.rows[0]?.clicks),
    newContacts: num(contactRow.rows[0]?.n),
  };

  for (const row of eventRows.rows) {
    const platform = row.platform as Platform | null;
    const n = num(row.n);
    if (row.type === "public_reply_sent") totals.publicReplies += n;
    if (!platform) continue;
    if (row.type === "comment_received") totals.commentsReceived[platform] += n;
    if (row.type === "dm_received") totals.dmsReceived[platform] += n;
    if (row.type === "rule_triggered") totals.triggers[platform] += n;
  }

  for (const row of messageRows.rows) {
    const platform = row.platform as Platform;
    if (row.status === "sent") {
      totals.dmsSent[platform] += num(row.n);
      totals.dmsRead += num(row.read);
    } else {
      totals.dmsFailed += num(row.n);
    }
  }

  return {
    days,
    totals,
    daily: dailyRows.rows.map((r) => ({
      date: String(r.date),
      sent: num(r.sent),
      clicks: num(r.clicks),
      triggers: num(r.triggers),
    })),
    rules: ruleRows.rows.map((r) => ({
      id: num(r.id),
      name: String(r.name),
      trigger: r.trigger as "comment" | "dm",
      platforms: r.platforms as Platform[],
      active: Boolean(r.active),
      triggers: num(r.triggers),
      sent: num(r.sent),
      failed: num(r.failed),
      read: num(r.read),
      linksSent: num(r.links_sent),
      linksClicked: num(r.links_clicked),
    })),
  };
}

/** อัตราส่วนเป็น % (คืน null ถ้าตัวหารเป็น 0 เพื่อแสดง "–" แทน 0%) */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}
