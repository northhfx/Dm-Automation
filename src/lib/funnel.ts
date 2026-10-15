import { and, desc, gte, inArray, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import { events, linkChecks, rules, type Platform } from "@/db/schema";
import { env } from "@/lib/env";
import { instagramAccountHealth, instagramHealthLevel, listInstagramAccounts } from "@/lib/instagram/accounts";
import { LINK_ALERT_AFTER, linkUrlsOf } from "@/lib/link-health";
import { listConnectedPages } from "@/lib/pages";
import type { PlatformCounts } from "@/lib/stats";

/*
 * ตัวเลขแบบ "นับเป็นคน" ของหน้าภาพรวม (funnel): พิมพ์ keyword → คลิกลิงก์
 * - หน่วยนับคือ "คน × กฎ": คนเดิมพิมพ์ keyword เดิมซ้ำในช่วงเดียวกัน = 1, พิมพ์ keyword ของ 2 กฎ = 2
 *   "พิมพ์ keyword" = ตรงกับกฎ (rule_triggered) หรือถูกข้ามเพราะกฎตอบคนละครั้งเดียว (skipped/once_per_user — พิมพ์มาแต่ไม่ได้ส่งซ้ำ)
 * - คนคลิกลิงก์ = คนที่พิมพ์ keyword ในช่วงนั้น แล้วคลิกลิงก์ของกฎเดียวกันในช่วงเดียวกันอย่างน้อย 1 ครั้ง
 *   (นับจาก link_clicked — ไม่นับการกดปุ่มไปข้อความถัดไป) → อัตราคลิก = คนคลิกลิงก์ ÷ คนพิมพ์ keyword ไม่เกิน 100%
 * - Contact ใหม่ = ระบบเพิ่งรู้จักในช่วงนี้ (contacts.first_seen_at อยู่ในช่วง หรือยังไม่มี contact) · Contact เดิม = รู้จักก่อนช่วงนี้
 * ระบุตัวคน: contact_id ของกิจกรรม → ถ้าไม่มี (คอมเมนต์ที่ DM ยังไม่ส่ง / ส่งไม่สำเร็จ / ข้อมูลก่อนมีการผูก contact)
 * หาจากกิจกรรมอื่นของคนเดียวกัน (actor_id เดียวกันที่รู้ contact แล้ว) หรือ contact ที่มี id ตรงกัน (Instagram / แชท)
 * ไม่งั้นใช้ id ของคนคอมเมนต์ (actor_id)
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

/** ช่วงของ N วันล่าสุด (นับรวมวันนี้ถึงตอนนี้) — previous = ช่วงก่อนหน้าที่ยาวเท่ากัน (จบที่เวลาเดียวกันของ N วันก่อน) */
function rangeOf(days: number, previous: boolean): { start: SQL; end: SQL } {
  return previous
    ? { start: dayStart(2 * days - 1), end: sql`(now() - ${days} * interval '1 day')` }
    : { start: dayStart(days - 1), end: sql`now()` };
}

async function funnelRows(db: Db, start: SQL, end: SQL) {
  const tz = env.timezone;
  return db.execute<Row>(sql`
    WITH typing AS (
      SELECT e.id, e.rule_id, e.platform, e.page_id, e.actor_id, e.contact_id, e.created_at
      FROM events e
      WHERE e.rule_id IS NOT NULL AND e.platform IS NOT NULL
        AND (e.type = 'rule_triggered' OR (e.type = 'skipped' AND e.meta->>'reason' = 'once_per_user'))
        AND e.created_at >= ${start} AND e.created_at < ${end}
    ),
    known AS (
      SELECT k.platform, k.page_id, k.actor_id, max(k.contact_id) AS contact_id
      FROM events k
      WHERE k.type IN ('rule_triggered', 'dm_sent') AND k.contact_id IS NOT NULL
        AND k.actor_id IN (SELECT actor_id FROM typing WHERE contact_id IS NULL)
      GROUP BY 1, 2, 3
    ),
    resolved AS (
      SELECT t.id, t.rule_id, t.platform, t.actor_id, t.created_at, coalesce(t.contact_id, kn.contact_id, cu.id) AS contact_id
      FROM typing t
      LEFT JOIN known kn ON t.contact_id IS NULL
        AND kn.platform = t.platform AND kn.page_id IS NOT DISTINCT FROM t.page_id AND kn.actor_id = t.actor_id
      LEFT JOIN contacts cu ON t.contact_id IS NULL AND kn.contact_id IS NULL
        AND cu.platform = t.platform AND cu.page_id = t.page_id AND cu.platform_user_id = t.actor_id
    ),
    pairs AS (
      SELECT rule_id,
        coalesce('c' || contact_id::text, 'a' || platform || ':' || coalesce(actor_id, id::text)) AS person,
        min(platform) AS platform,
        max(contact_id) AS contact_id,
        min(created_at) AS first_at
      FROM resolved
      GROUP BY 1, 2
    ),
    clicks AS (
      SELECT rule_id, contact_id, min(created_at) AS clicked_at
      FROM events
      WHERE type = 'link_clicked' AND rule_id IS NOT NULL AND contact_id IS NOT NULL
        AND created_at >= ${start} AND created_at < ${end}
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
  const { start, end } = rangeOf(days, false);
  const rows = await funnelRows(db, start, end);
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
  const { start, end } = rangeOf(days, true);
  const rows = await funnelRows(db, start, end);
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
  /** ส่ง DM ไม่สำเร็จ (ทั้งหมด / เฉพาะข้อความถัดไปหลังลูกค้ากดปุ่ม) — รวม token ใช้ไม่ได้ (ไม่ได้ลองส่งเลย) */
  failedSends: number;
  failedAfterTap: number;
  /** ส่งไม่สำเร็จแยกตามกฎ (ตารางกฎ) */
  failedByRule: Map<number, number>;
  /** ลูกค้ากดปุ่มแล้วไม่มีข้อความถัดไป (กฎปิดอยู่ / ปุ่มในข้อความเก่าที่ถูกแก้หรือลบ) */
  deadTaps: number;
  /** ชื่อกฎของปุ่มเหล่านั้น (กฎที่ถูกลบไปแล้วไม่มีชื่อ) */
  deadTapRules: string[];
  brokenLinks: BrokenLink[];
  /** การเชื่อมต่อที่ระบบตอบลูกค้าไม่ได้ (กติกาเดียวกับแถบเมนู / หน้าตั้งค่า — คำเตือนชั่วคราวไม่นับ) */
  connections: { name: string; platform: Platform }[];
}

export async function getProblems(db: Db, days: number): Promise<Problems> {
  const since = dayStart(days - 1);
  const [failedRows, deadRows, checkRows, allRules, pageRows, igRows] = await Promise.all([
    // นับจากกิจกรรม dm_failed: ครอบคลุมทั้งส่งแล้ว Meta ปฏิเสธ และส่งไม่ได้เลย (token ใช้ไม่ได้ / ข้อความถูกลบระหว่างรอส่ง)
    db.execute<Row>(sql`
      SELECT rule_id, count(*)::int AS n, count(*) FILTER (WHERE meta->>'source' = 'button')::int AS after_tap
      FROM events WHERE type = 'dm_failed' AND created_at >= ${since}
      GROUP BY rule_id
    `),
    db
      .select({ ruleId: events.ruleId, n: sql<number>`count(*)::int` })
      .from(events)
      .where(
        and(
          sql`${events.type} = 'skipped'`,
          gte(events.createdAt, sql`${since}`),
          inArray(sql`${events.meta}->>'reason'`, ["rule_inactive", "button_target_missing"]),
        ),
      )
      .groupBy(events.ruleId),
    db
      .select()
      .from(linkChecks)
      .where(sql`${linkChecks.ok} = false AND ${linkChecks.failures} >= ${LINK_ALERT_AFTER}`)
      .orderBy(desc(linkChecks.checkedAt)),
    db.select({ id: rules.id, name: rules.name, steps: rules.steps, active: rules.active }).from(rules),
    listConnectedPages(db),
    listInstagramAccounts(db),
  ]);

  const failedByRule = new Map<number, number>();
  let failedSends = 0;
  let failedAfterTap = 0;
  for (const r of failedRows.rows) {
    failedSends += num(r.n);
    failedAfterTap += num(r.after_tap);
    if (r.rule_id != null) failedByRule.set(num(r.rule_id), num(r.n));
  }

  const ruleName = new Map(allRules.map((r) => [r.id, r.name]));
  const brokenLinks: BrokenLink[] = checkRows.map((c) => ({
    url: c.url,
    status: c.status,
    error: c.error,
    checkedAt: c.checkedAt,
    ruleNames: allRules.filter((r) => r.active && linkUrlsOf(r.steps).includes(c.url)).map((r) => r.name),
  }));

  const now = new Date();
  return {
    failedSends,
    failedAfterTap,
    failedByRule,
    deadTaps: deadRows.reduce((n, r) => n + num(r.n), 0),
    deadTapRules: [...new Set(deadRows.flatMap((r) => (r.ruleId != null && ruleName.has(r.ruleId) ? [ruleName.get(r.ruleId)!] : [])))],
    // ลิงก์ที่ไม่อยู่ในกฎที่เปิดอยู่แล้ว (เพิ่งแก้กฎ) ไม่ต้องเตือน
    brokenLinks: brokenLinks.filter((l) => l.ruleNames.length > 0),
    connections: [
      // เพจ: token ถอดรหัสไม่ได้ / ไม่ได้รับ webhook / มี error ล่าสุด (เหมือนหน้าตั้งค่า)
      ...pageRows.filter((p) => !p.token || !p.subscribed || p.lastError).map((p) => ({ name: p.name, platform: "facebook" as const })),
      ...igRows
        .filter((a) => instagramHealthLevel(instagramAccountHealth(a, now)) === "critical")
        .map((a) => ({ name: `@${a.username}`, platform: "instagram" as const })),
    ],
  };
}

/** กฎไหนมีปุ่มลิงก์บ้าง (กฎที่ไม่มีลิงก์แสดงคนคลิก / อัตราคลิกเป็น "–") */
export async function rulesWithLinks(db: Db): Promise<Set<number>> {
  const rows = await db.select({ id: rules.id, steps: rules.steps }).from(rules);
  return new Set(rows.filter((r) => linkUrlsOf(r.steps).length > 0).map((r) => r.id));
}
