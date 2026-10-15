import { and, desc, gte, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import { events, instagramAccounts, linkChecks, pages, rules, type Platform } from "@/db/schema";
import { env } from "@/lib/env";
import { LINK_ALERT_AFTER, linkUrlsOf } from "@/lib/link-health";
import type { PlatformCounts } from "@/lib/stats";

/*
 * ตัวเลขแบบ "นับเป็นคน" ของหน้าภาพรวม (funnel): พิมพ์ keyword → คลิกลิงก์
 * - หน่วยนับคือ "คน × กฎ": คนเดิมพิมพ์ keyword เดิมซ้ำในช่วงเดียวกัน = 1, พิมพ์ keyword ของ 2 กฎ = 2
 * - คนคลิกลิงก์ = คนที่พิมพ์ keyword ในช่วงนั้น แล้วคลิกลิงก์ในข้อความของกฎเดียวกันอย่างน้อย 1 ครั้ง (ไม่นับการกดปุ่มไปข้อความถัดไป)
 *   → อัตราคลิก = คนคลิกลิงก์ ÷ คนพิมพ์ keyword ไม่เกิน 100%
 * - Contact ใหม่ = คนที่ระบบเพิ่งรู้จักในช่วงนี้ (contacts.first_seen_at อยู่ในช่วง หรือยังไม่มี contact) · Contact เดิม = รู้จักก่อนช่วงนี้
 * ระบุตัวคน: contact_id ถ้ามี (แชท / คอมเมนต์ที่ส่ง DM สำเร็จแล้ว) ไม่งั้นใช้ id ของคนคอมเมนต์ (actor_id)
 */

export interface FunnelTotals {
  typed: PlatformCounts;
  clicked: PlatformCounts;
  /** ใหม่ + เดิม = typed ทั้งหมด */
  newPeople: number;
  returningPeople: number;
}

export interface FunnelDay {
  date: string; // YYYY-MM-DD ตามเขตเวลาของระบบ
  typed: PlatformCounts;
  clicked: PlatformCounts;
}

export interface RuleFunnel {
  typed: number;
  clicked: number;
}

export interface Funnel {
  totals: FunnelTotals;
  /** วันละแถว ตามรายการวันที่ส่งมา */
  daily: FunnelDay[];
  byRule: Map<number, RuleFunnel>;
}

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);
const empty = (): PlatformCounts => ({ facebook: 0, instagram: 0 });
const isPlatform = (p: unknown): p is Platform => p === "facebook" || p === "instagram";

/** จุดเริ่มของวัน (ตามเขตเวลาของระบบ) ย้อนหลัง back วันจากวันนี้ */
export function dayStart(back: number): SQL {
  const tz = env.timezone;
  return sql`((date_trunc('day', now() AT TIME ZONE ${tz}) - ${back} * interval '1 day') AT TIME ZONE ${tz})`;
}

async function funnelRows(db: Db, start: SQL, end: SQL | null) {
  const tz = env.timezone;
  const endCond = end ? sql`AND e.created_at < ${end}` : sql``;
  return db.execute<Row>(sql`
    WITH pairs AS (
      SELECT e.rule_id,
        coalesce('c' || e.contact_id::text, 'a' || e.platform || ':' || coalesce(e.actor_id, e.id::text)) AS person,
        min(e.platform) AS platform,
        max(e.contact_id) AS contact_id,
        min(e.created_at) AS first_at
      FROM events e
      WHERE e.type = 'rule_triggered' AND e.rule_id IS NOT NULL AND e.platform IS NOT NULL
        AND e.created_at >= ${start} ${endCond}
      GROUP BY 1, 2
    ),
    clicks AS (
      SELECT l.rule_id, l.contact_id, min(coalesce(l.first_clicked_at, l.created_at)) AS clicked_at
      FROM links l
      WHERE l.clicks > 0 AND l.rule_id IS NOT NULL AND l.contact_id IS NOT NULL AND l.created_at >= ${start}
      GROUP BY 1, 2
    )
    SELECT p.rule_id, p.platform,
      to_char(p.first_at AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS typed_day,
      to_char(c.clicked_at AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS clicked_day,
      c.clicked_at IS NOT NULL AS clicked,
      coalesce(ct.first_seen_at < ${start}, false) AS returning
    FROM pairs p
    LEFT JOIN clicks c ON c.rule_id = p.rule_id AND c.contact_id = p.contact_id
    LEFT JOIN contacts ct ON ct.id = p.contact_id
  `);
}

/** funnel ของ N วันล่าสุด (นับรวมวันนี้) — dates = วันที่ของกราฟ (YYYY-MM-DD เรียงจากเก่า) */
export async function getFunnel(db: Db, days: number, dates: string[]): Promise<Funnel> {
  const rows = await funnelRows(db, dayStart(days - 1), null);
  const totals: FunnelTotals = { typed: empty(), clicked: empty(), newPeople: 0, returningPeople: 0 };
  const daily = new Map(dates.map((date) => [date, { date, typed: empty(), clicked: empty() } as FunnelDay]));
  const byRule = new Map<number, RuleFunnel>();
  for (const r of rows.rows) {
    if (!isPlatform(r.platform)) continue;
    const ruleId = num(r.rule_id);
    const rule = byRule.get(ruleId) ?? { typed: 0, clicked: 0 };
    byRule.set(ruleId, rule);
    totals.typed[r.platform]++;
    rule.typed++;
    if (r.returning) totals.returningPeople++;
    else totals.newPeople++;
    const typedDay = daily.get(String(r.typed_day));
    if (typedDay) typedDay.typed[r.platform]++;
    if (r.clicked) {
      totals.clicked[r.platform]++;
      rule.clicked++;
      const clickedDay = daily.get(String(r.clicked_day));
      if (clickedDay) clickedDay.clicked[r.platform]++;
    }
  }
  return { totals, daily: [...daily.values()], byRule };
}

/** ตัวเลข funnel ของช่วงก่อนหน้าที่ยาวเท่ากัน (ใช้เทียบ "+12%") */
export async function getPreviousFunnel(db: Db, days: number): Promise<FunnelTotals> {
  const start = dayStart(2 * days - 1);
  const rows = await funnelRows(db, start, dayStart(days - 1));
  const totals: FunnelTotals = { typed: empty(), clicked: empty(), newPeople: 0, returningPeople: 0 };
  for (const r of rows.rows) {
    if (!isPlatform(r.platform)) continue;
    totals.typed[r.platform]++;
    if (r.clicked) totals.clicked[r.platform]++;
    if (r.returning) totals.returningPeople++;
    else totals.newPeople++;
  }
  return totals;
}

// ---------------- ปัญหาที่ต้องดู ----------------

export interface BrokenLink {
  url: string;
  status: number | null;
  error: string | null;
  ruleNames: string[];
  checkedAt: Date;
}

export interface Problems {
  /** ส่ง DM ไม่สำเร็จ (ทั้งหมด / เฉพาะข้อความถัดไปหลังลูกค้ากดปุ่ม) */
  failedSends: number;
  failedAfterTap: number;
  /** ลูกค้ากดปุ่มแล้วไม่มีข้อความถัดไป (กฎปิดอยู่ / ปุ่มในข้อความเก่าที่ถูกแก้หรือลบ) */
  deadTaps: number;
  brokenLinks: BrokenLink[];
  /** การเชื่อมต่อที่มีปัญหา (เพจ / บัญชี Instagram ที่บันทึก error ไว้) */
  connections: { name: string; platform: Platform }[];
}

export async function getProblems(db: Db, days: number): Promise<Problems> {
  const since = dayStart(days - 1);
  const [failedRows, deadRows, checkRows, activeRules, pageRows, igRows] = await Promise.all([
    db.execute<Row>(sql`
      SELECT count(*)::int AS n, count(*) FILTER (WHERE source = 'button')::int AS after_tap
      FROM messages WHERE status = 'failed' AND sent_at >= ${since}
    `),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(events)
      .where(
        and(
          sql`${events.type} = 'skipped'`,
          gte(events.createdAt, sql`${since}`),
          inArray(sql`${events.meta}->>'reason'`, ["rule_inactive", "button_target_missing"]),
        ),
      ),
    db
      .select()
      .from(linkChecks)
      .where(sql`${linkChecks.ok} = false AND ${linkChecks.failures} >= ${LINK_ALERT_AFTER}`)
      .orderBy(desc(linkChecks.checkedAt)),
    db.select({ name: rules.name, steps: rules.steps, active: rules.active }).from(rules),
    db.select({ name: pages.name }).from(pages).where(isNotNull(pages.lastError)),
    db.select({ username: instagramAccounts.username }).from(instagramAccounts).where(isNotNull(instagramAccounts.lastError)),
  ]);

  const brokenLinks: BrokenLink[] = checkRows.map((c) => ({
    url: c.url,
    status: c.status,
    error: c.error,
    checkedAt: c.checkedAt,
    ruleNames: activeRules.filter((r) => r.active && linkUrlsOf(r.steps).includes(c.url)).map((r) => r.name),
  }));

  return {
    failedSends: num(failedRows.rows[0]?.n),
    failedAfterTap: num(failedRows.rows[0]?.after_tap),
    deadTaps: num(deadRows[0]?.n),
    // ลิงก์ที่ไม่อยู่ในกฎที่เปิดอยู่แล้ว (เพิ่งแก้กฎ) ไม่ต้องเตือน
    brokenLinks: brokenLinks.filter((l) => l.ruleNames.length > 0),
    connections: [
      ...pageRows.map((p) => ({ name: p.name, platform: "facebook" as const })),
      ...igRows.map((a) => ({ name: `@${a.username}`, platform: "instagram" as const })),
    ],
  };
}

/** กฎไหนมีปุ่มลิงก์บ้าง (กฎที่ไม่มีลิงก์แสดงคนคลิก / อัตราคลิกเป็น "–") */
export async function rulesWithLinks(db: Db): Promise<Set<number>> {
  const rows = await db.select({ id: rules.id, steps: rules.steps }).from(rules);
  return new Set(rows.filter((r) => linkUrlsOf(r.steps).length > 0).map((r) => r.id));
}
