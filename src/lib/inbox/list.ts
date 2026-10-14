import { sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import type { InboxKind, Platform } from "@/db/schema";
import { needsInboxDetails } from "./details";
import { inboxCutoff } from "./retention";
import { inboxThreadKey } from "./thread";

/*
 * อ่านรายการสำหรับหน้าข้อความรอตอบ (/inbox) — แชทของคนเดียวกันรวมเป็นแถวเดียว (ดู thread.ts)
 * ใหม่สุดก่อน (ตามข้อความล่าสุดของแถว) และไม่แสดงรายการที่เกินอายุเก็บ
 */

/**
 * เลขหน้าสูงสุดที่รับ (30 รายการต่อหน้า = 300,000 แถว เกินกว่าที่ร้านจะมีใน 30 วัน)
 * กัน ?page=1e300 ในลิงก์ → OFFSET เกินช่วงตัวเลขของ Postgres แล้วหน้าเว็บพัง
 */
export const INBOX_MAX_PAGE = 10_000;

/** ?page= จาก URL → เลขหน้า 1…INBOX_MAX_PAGE (ค่าแปลกๆ = หน้า 1) */
export function parseInboxPage(value: unknown): number {
  const n = Math.floor(Number(typeof value === "string" ? value : NaN));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, INBOX_MAX_PAGE) : 1;
}

export interface InboxFilters {
  kind: InboxKind | null;
  platform: Platform | null;
  /** แสดงรายการที่กด "เสร็จแล้ว" ด้วย */
  showDone: boolean;
  /** หน้าที่ (เริ่มที่ 1) */
  page: number;
  pageSize: number;
}

export interface InboxRow {
  /** key ของแถว (คงที่ระหว่างโหลดใหม่) */
  key: string;
  /** ทุกรายการในแถวนี้ — ส่งให้ปุ่ม "เสร็จแล้ว" / "ยังไม่เสร็จ" */
  ids: number[];
  kind: InboxKind;
  platform: Platform;
  pageId: string;
  senderId: string;
  senderName: string | null;
  senderUsername: string | null;
  /** ข้อความล่าสุดของแถว */
  text: string;
  postId: string | null;
  commentId: string | null;
  permalink: string | null;
  /** เวลาของข้อความล่าสุด */
  createdAt: Date;
  /** จำนวนข้อความในแถว (แชท) */
  messageCount: number;
  /** null = ยังรอตอบ */
  handledAt: Date | null;
  /** ยังขาดชื่อ/ลิงก์ที่ถาม Meta ได้ และยังไม่เคยถาม → หน้าเว็บขอให้เติม (id ใดก็ได้ในแถว) */
  detailsId: number | null;
}

export interface InboxCounts {
  /** จำนวนแถวตามประเภท × แพลตฟอร์ม (ตามตัวกรอง "แสดงที่เสร็จแล้ว") */
  byKindPlatform: Record<InboxKind, Record<Platform, number>>;
  /** จำนวนแถวที่ยังรอตอบ / เสร็จแล้ว ทุกประเภท */
  open: number;
  done: number;
}

function where(filters: Pick<InboxFilters, "kind" | "platform" | "showDone">, now: Date): SQL {
  const parts: SQL[] = [sql`i.created_at >= ${inboxCutoff(now).toISOString()}::timestamptz`];
  if (!filters.showDone) parts.push(sql`i.handled_at IS NULL`);
  if (filters.kind) parts.push(sql`i.kind = ${filters.kind}`);
  if (filters.platform) parts.push(sql`i.platform = ${filters.platform}`);
  return sql.join(parts, sql` AND `);
}

function toDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}

/** แถวของหน้านี้ */
export async function loadInboxRows(db: Db, filters: InboxFilters, now: Date = new Date()): Promise<InboxRow[]> {
  const key = inboxThreadKey({ splitByDone: true });
  const page = Number.isFinite(filters.page) ? Math.min(Math.max(1, Math.floor(filters.page)), INBOX_MAX_PAGE) : 1;
  const offset = (page - 1) * filters.pageSize;
  const res = await db.execute<Record<string, unknown>>(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (t.k)
        t.k, t.id, t.kind, t.platform, t.page_id, t.sender_id, t.text, t.post_id, t.comment_id, t.created_at,
        max(t.sender_name) OVER w AS sender_name,
        max(t.sender_username) OVER w AS sender_username,
        max(t.permalink) OVER w AS permalink,
        max(t.handled_at) OVER w AS handled_at,
        count(*) OVER w AS message_count,
        array_agg(t.id) OVER w AS ids,
        bool_or(t.details_checked_at IS NULL) OVER w AS unchecked
      FROM (SELECT i.*, ${key} AS k FROM inbox_items i WHERE ${where(filters, now)}) t
      WINDOW w AS (PARTITION BY t.k)
      ORDER BY t.k, t.created_at DESC, t.id DESC
    ) g
    ORDER BY g.created_at DESC, g.id DESC
    LIMIT ${filters.pageSize} OFFSET ${offset}
  `);
  return res.rows.map((r) => {
    const row = {
      key: String(r.k),
      ids: (r.ids as (number | string)[]).map(Number).sort((a, b) => a - b),
      kind: r.kind as InboxKind,
      platform: r.platform as Platform,
      pageId: String(r.page_id),
      senderId: String(r.sender_id),
      senderName: (r.sender_name as string | null) ?? null,
      senderUsername: (r.sender_username as string | null) ?? null,
      text: String(r.text ?? ""),
      postId: (r.post_id as string | null) ?? null,
      commentId: (r.comment_id as string | null) ?? null,
      permalink: (r.permalink as string | null) ?? null,
      createdAt: toDate(r.created_at),
      messageCount: Number(r.message_count ?? 1),
      handledAt: r.handled_at ? toDate(r.handled_at) : null,
      detailsId: null as number | null,
    };
    if (r.unchecked && needsInboxDetails(row)) row.detailsId = Number(r.id);
    return row;
  });
}

/** จำนวนแถว (ใช้กับตัวเลขในตัวกรอง จำนวนหน้า และหน้าว่าง) */
export async function countInboxRows(db: Db, showDone: boolean, now: Date = new Date()): Promise<InboxCounts> {
  const key = inboxThreadKey({ splitByDone: true });
  const res = await db.execute<Record<string, unknown>>(sql`
    SELECT i.kind, i.platform, (i.handled_at IS NULL) AS open, count(DISTINCT ${key})::int AS n
    FROM inbox_items i
    WHERE ${where({ kind: null, platform: null, showDone: true }, now)}
    GROUP BY i.kind, i.platform, (i.handled_at IS NULL)
  `);
  const counts: InboxCounts = {
    byKindPlatform: { dm: { facebook: 0, instagram: 0 }, comment: { facebook: 0, instagram: 0 } },
    open: 0,
    done: 0,
  };
  for (const r of res.rows) {
    const n = Number(r.n ?? 0);
    const open = r.open === true || r.open === "t";
    if (open) counts.open += n;
    else counts.done += n;
    const kind = r.kind === "comment" ? "comment" : r.kind === "dm" ? "dm" : null;
    const platform = r.platform === "instagram" ? "instagram" : r.platform === "facebook" ? "facebook" : null;
    if (kind && platform && (open || showDone)) counts.byKindPlatform[kind][platform] += n;
  }
  return counts;
}

/** รวมจำนวนแถวตามตัวกรอง (null = ทั้งหมด) */
export function sumCounts(counts: InboxCounts, kind: InboxKind | null, platform: Platform | null): number {
  let total = 0;
  for (const k of ["dm", "comment"] as const) {
    if (kind && k !== kind) continue;
    for (const p of ["facebook", "instagram"] as const) {
      if (platform && p !== platform) continue;
      total += counts.byKindPlatform[k][p];
    }
  }
  return total;
}
