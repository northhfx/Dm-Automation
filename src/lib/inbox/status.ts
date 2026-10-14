import { and, inArray, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { inboxItems } from "@/db/schema";

/** ปุ่มหนึ่งครั้งเปลี่ยนได้ไม่เกินกี่รายการ (แชทยาวๆ ของคนเดียวรวมอยู่ในแถวเดียว) */
export const STATUS_IDS_MAX = 1000;

/** "12,13,14" จากฟอร์ม → [12, 13, 14] (ตัดค่าที่ไม่ใช่เลขรายการทิ้ง) */
export function parseInboxIds(value: FormDataEntryValue | null): number[] {
  if (typeof value !== "string") return [];
  const ids = value
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  return [...new Set(ids)].slice(0, STATUS_IDS_MAX);
}

/**
 * done = true: ทำเครื่องหมายว่าตอบแล้ว (เฉพาะที่ยังรอตอบ — เวลาที่กดครั้งแรกไม่ถูกทับ)
 * done = false: ย้ายกลับมารอตอบ (ปุ่ม "เลิกทำ" / "ยังไม่เสร็จ")
 * คืนจำนวนรายการที่เปลี่ยน
 */
export async function setInboxHandled(db: Db, ids: number[], done: boolean, now: Date = new Date()): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(inboxItems)
    .set({ handledAt: done ? now : null })
    .where(and(inArray(inboxItems.id, ids), done ? isNull(inboxItems.handledAt) : isNotNull(inboxItems.handledAt)))
    .returning({ id: inboxItems.id });
  return rows.length;
}
