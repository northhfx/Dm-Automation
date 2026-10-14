import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { inboxCutoff } from "./retention";
import { inboxThreadKey } from "./thread";

/**
 * จำนวนเรื่องที่ยังรอตอบในหน้า "ข้อความรอตอบ" (/inbox) — แสดงเป็นตัวเลขบนเมนูด้านซ้าย (0 = ไม่แสดง)
 * นับแบบเดียวกับแถวในหน้า: แชทของคนเดียวกันนับเป็น 1 (ตอบทีเดียวในห้องแชทเดียว), คอมเมนต์นับทีละอัน
 * ไม่นับรายการที่กด "เสร็จแล้ว" และรายการที่เกินอายุเก็บ (เผื่อ worker ยังไม่ได้ลบ)
 * ใช้ index inbox_items_open_idx (handled_at, created_at)
 */
export async function countOpenInboxItems(db: Db, now: Date = new Date()): Promise<number> {
  const res = await db.execute<{ n: number }>(sql`
    SELECT count(DISTINCT ${inboxThreadKey()})::int AS n
    FROM inbox_items i
    WHERE i.handled_at IS NULL AND i.created_at >= ${inboxCutoff(now).toISOString()}::timestamptz
  `);
  return Number(res.rows[0]?.n ?? 0);
}
