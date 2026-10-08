import { sql, type SQL } from "drizzle-orm";
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
  buttonTaps: number;
  /** จำนวนคน (ไม่ซ้ำ) ที่ได้รับ DM จากระบบ */
  reachedContacts: number;
  /** จำนวนคน (ไม่ซ้ำ) ที่กดปุ่มหรือกดลิงก์อย่างน้อย 1 ครั้ง */
  engagedContacts: number;
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
  reached: number;
  engaged: number;
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

  const [eventRows, messageRows, linkRow, contactRow, dailyRows, ruleRows, engagementRow] = await Promise.all([
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
          count(*) FILTER (WHERE type IN ('link_clicked', 'button_clicked'))::int AS clicks,
          count(*) FILTER (WHERE type = 'rule_triggered')::int AS triggers
        FROM events WHERE created_at >= ${since}
        GROUP BY 1
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
        coalesce(counts.sent, 0) AS sent, coalesce(counts.clicks, 0) AS clicks, coalesce(counts.triggers, 0) AS triggers
      FROM days LEFT JOIN counts ON counts.day = days.day
      ORDER BY days.day
    `),
    db.execute<Row>(ruleStatsSql(since)),
    db.execute<Row>(sql`
      SELECT
        (SELECT count(DISTINCT contact_id)::int FROM messages WHERE status = 'sent' AND sent_at >= ${since}) AS reached,
        (SELECT count(DISTINCT contact_id)::int FROM events
          WHERE type IN ('button_clicked', 'link_clicked') AND contact_id IS NOT NULL AND created_at >= ${since}) AS engaged
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
    buttonTaps: 0,
    reachedContacts: num(engagementRow.rows[0]?.reached),
    engagedContacts: num(engagementRow.rows[0]?.engaged),
    newContacts: num(contactRow.rows[0]?.n),
  };

  for (const row of eventRows.rows) {
    const platform = row.platform as Platform | null;
    const n = num(row.n);
    if (row.type === "public_reply_sent") totals.publicReplies += n;
    if (row.type === "button_clicked") totals.buttonTaps += n;
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
    rules: ruleRows.rows.map(toRuleStats),
  };
}

/** สถิติของแต่ละกฎ (since = null คือนับทั้งหมดตั้งแต่เริ่มใช้) */
function ruleStatsSql(since: SQL | null): SQL {
  const eventsSince = since ? sql`AND created_at >= ${since}` : sql``;
  const sentSince = since ? sql`AND sent_at >= ${since}` : sql``;
  return sql`
    SELECT r.id, r.name, r.trigger, r.platforms, r.active,
      coalesce(e.triggers, 0)::int AS triggers,
      coalesce(m.sent, 0)::int AS sent, coalesce(m.failed, 0)::int AS failed, coalesce(m.read, 0)::int AS read,
      coalesce(m.reached, 0)::int AS reached, coalesce(c.engaged, 0)::int AS engaged
    FROM rules r
    LEFT JOIN (
      SELECT rule_id, count(*) AS triggers FROM events
      WHERE type = 'rule_triggered' ${eventsSince} GROUP BY rule_id
    ) e ON e.rule_id = r.id
    LEFT JOIN (
      SELECT rule_id, count(*) FILTER (WHERE status = 'sent') AS sent, count(*) FILTER (WHERE status = 'failed') AS failed,
        count(read_at) AS read, count(DISTINCT contact_id) FILTER (WHERE status = 'sent') AS reached
      FROM messages WHERE true ${sentSince} GROUP BY rule_id
    ) m ON m.rule_id = r.id
    LEFT JOIN (
      SELECT rule_id, count(DISTINCT contact_id) AS engaged FROM events
      WHERE type IN ('button_clicked', 'link_clicked') AND contact_id IS NOT NULL ${eventsSince} GROUP BY rule_id
    ) c ON c.rule_id = r.id
    ORDER BY coalesce(e.triggers, 0) DESC, r.id
  `;
}

function toRuleStats(r: Row): RuleStats {
  return {
    id: num(r.id),
    name: String(r.name),
    trigger: r.trigger as "comment" | "dm",
    platforms: r.platforms as Platform[],
    active: Boolean(r.active),
    triggers: num(r.triggers),
    sent: num(r.sent),
    failed: num(r.failed),
    read: num(r.read),
    reached: num(r.reached),
    engaged: num(r.engaged),
  };
}

/** สถิติทั้งหมดของทุกกฎ ใช้ในหน้ารายการกฎ (แบบ "66 ครั้ง · CTR 87.9%") */
export async function getAllTimeRuleStats(db: Db): Promise<Map<number, RuleStats>> {
  const result = await db.execute<Row>(ruleStatsSql(null));
  return new Map(result.rows.map((r) => [num(r.id), toRuleStats(r)]));
}

export interface StepStats {
  sent: number;
  /** จำนวนคน (ไม่ซ้ำ) ที่กดปุ่มหรือลิงก์ในข้อความนี้ */
  engaged: number;
  reached: number;
}

/** สถิติของแต่ละข้อความในกฎ (ทั้งหมดตั้งแต่เริ่มใช้) — key คือ stepId */
export async function getStepStats(db: Db, ruleId: number): Promise<Record<string, StepStats>> {
  const result = await db.execute<Row>(sql`
    WITH sent AS (
      SELECT step_id, count(*)::int AS sent, count(DISTINCT contact_id)::int AS reached
      FROM messages WHERE rule_id = ${ruleId} AND status = 'sent' AND step_id IS NOT NULL GROUP BY step_id
    ),
    engaged AS (
      SELECT step_id, count(DISTINCT contact_id)::int AS engaged FROM (
        SELECT meta->>'stepId' AS step_id, contact_id FROM events
          WHERE type = 'button_clicked' AND rule_id = ${ruleId} AND contact_id IS NOT NULL
        UNION
        SELECT step_id, contact_id FROM links
          WHERE rule_id = ${ruleId} AND clicks > 0 AND contact_id IS NOT NULL AND step_id IS NOT NULL
      ) x GROUP BY step_id
    )
    SELECT coalesce(s.step_id, e.step_id) AS step_id, coalesce(s.sent, 0) AS sent, coalesce(s.reached, 0) AS reached,
      coalesce(e.engaged, 0) AS engaged
    FROM sent s FULL OUTER JOIN engaged e ON e.step_id = s.step_id
  `);
  const out: Record<string, StepStats> = {};
  for (const r of result.rows) {
    out[String(r.step_id)] = { sent: num(r.sent), reached: num(r.reached), engaged: num(r.engaged) };
  }
  return out;
}

/** อัตราส่วนเป็น % (คืน null ถ้าตัวหารเป็น 0 เพื่อแสดง "–" แทน 0%) */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}
