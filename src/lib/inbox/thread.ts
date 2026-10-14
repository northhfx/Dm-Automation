import { sql, type SQL } from "drizzle-orm";

/*
 * "แถว" ในหน้าข้อความรอตอบ:
 * - แชท: ทุกข้อความของคนเดียวกัน (แพลตฟอร์ม + บัญชีร้าน + คนทัก) รวมเป็นแถวเดียว — เจ้าของร้านตอบทีเดียวในห้องแชทเดียว
 * - คอมเมนต์: แถวละ 1 คอมเมนต์ (ต้องตอบใต้คอมเมนต์นั้นๆ)
 * ใช้ทั้งตอนนับตัวเลขบนเมนู (count.ts) และตอนแสดงรายการ (list.ts) ให้นับตรงกัน
 */

/**
 * SQL ของ key แถว สำหรับตาราง inbox_items ที่ตั้งชื่อย่อว่า i
 * splitByDone: แยกข้อความที่ "เสร็จแล้ว" กับที่ยังรอตอบของคนเดียวกันเป็นคนละแถว (ตอนแสดงรายการที่เสร็จแล้วด้วย)
 */
export function inboxThreadKey(opts: { splitByDone?: boolean } = {}): SQL {
  const done = opts.splitByDone ? ` || ':' || (i.handled_at IS NULL)::text` : "";
  return sql.raw(
    `(CASE WHEN i.kind = 'dm' THEN 'dm:' || i.platform || ':' || i.page_id || ':' || i.sender_id${done} ELSE 'c:' || i.id::text END)`,
  );
}
