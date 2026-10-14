/*
 * อายุของรายการในหน้า "ข้อความรอตอบ" — ไฟล์นี้ไม่มี import ฝั่งเซิร์ฟเวอร์ ใช้ได้ทุกที่ (รวมข้อความบนหน้าเว็บ)
 * รายการที่เก่ากว่านี้: ไม่แสดง/ไม่นับ และ worker ลบทิ้งในรอบดูแลระบบ (lib/queue/worker.ts → cleanup)
 */

/** เก็บรายการไว้กี่วัน (นับจากเวลาที่ข้อความเข้ามา ไม่ว่าจะกด "เสร็จแล้ว" หรือยัง) */
export const INBOX_RETENTION_DAYS = 30;

/** ข้อความที่ลูกค้าพิมพ์ เก็บไว้ไม่เกินกี่ตัวอักษร */
export const INBOX_TEXT_MAX = 1000;

const DAY_MS = 24 * 60 * 60_000;

/** เวลาที่เก่าที่สุดที่ยังเก็บไว้ — รายการที่ created_at ก่อนเวลานี้ถือว่าหมดอายุ */
export function inboxCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - INBOX_RETENTION_DAYS * DAY_MS);
}
