/*
 * อายุของประวัติในหน้ากิจกรรม (ตาราง events) — ไฟล์นี้ไม่มี import ฝั่งเซิร์ฟเวอร์ ใช้ได้ทุกที่
 * worker ลบแถวที่เก่ากว่านี้ในรอบดูแลระบบ (lib/queue/worker.ts → cleanup) ฐานข้อมูลจะได้ไม่โตไม่รู้จบ
 * สถิติ "ย้อนหลัง" ของกฎ (lib/stats.ts) นับในช่วงเดียวกัน ตัวเลขจะได้ตรงกัน
 * (DM ที่ส่ง / ลิงก์ / รายชื่อลูกค้า ไม่ถูกลบ)
 */

/** เก็บประวัติกิจกรรมไว้กี่วัน */
export const ACTIVITY_RETENTION_DAYS = 365;

const DAY_MS = 24 * 60 * 60_000;

/** เวลาที่เก่าที่สุดที่ยังเก็บไว้ */
export function activityCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - ACTIVITY_RETENTION_DAYS * DAY_MS);
}
