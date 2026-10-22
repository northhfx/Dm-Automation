/*
 * ตั้งเวลาเปิด–ปิดกฎ (ของกฎเอง และของโฟลเดอร์ทั้งโฟลเดอร์)
 * - ช่วงที่ใช้จริง = ช่วงที่ซ้อนกันของกฎและโฟลเดอร์ (เริ่มช้าสุด · ปิดเร็วสุด)
 * - ยังไม่ถึงเวลา (upcoming) = ไม่ตอบ เหมือนปิดอยู่
 * - หมดเวลาแล้ว (ended) = ไม่ตอบตามกฎ แต่ถ้ามีข้อความ "ปิดรับแล้ว" จะตอบคนที่พิมพ์ keyword มาด้วยข้อความนั้น
 * - ปุ่มในข้อความที่ส่งไปแล้วยังกดต่อได้ (ไม่เช็คเวลาตอนกดปุ่ม)
 */

export interface Schedule {
  startsAt: Date | null;
  endsAt: Date | null;
}

export type ScheduleState = "open" | "upcoming" | "ended";

export const CLOSED_REPLY_MAX = 640;

const later = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);
const earlier = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a < b ? a : b);

/** ช่วงที่ใช้จริงของกฎในโฟลเดอร์ */
export function effectiveSchedule(rule: Schedule, folder?: Schedule | null): Schedule {
  return { startsAt: later(rule.startsAt, folder?.startsAt ?? null), endsAt: earlier(rule.endsAt, folder?.endsAt ?? null) };
}

export function scheduleState(s: Schedule, now: Date = new Date()): ScheduleState {
  if (s.endsAt && now >= s.endsAt) return "ended";
  if (s.startsAt && now < s.startsAt) return "upcoming";
  return "open";
}

/** ข้อความปิดรับที่ใช้: ของกฎก่อน ไม่มีใช้ของโฟลเดอร์ (ว่าง = ไม่ตอบ) */
export function closedReplyOf(rule: { closedReply: string | null }, folder?: { closedReply: string | null } | null): string | null {
  const own = rule.closedReply?.trim();
  if (own) return own;
  return folder?.closedReply?.trim() || null;
}
