/*
 * เรียงลำดับกฎ: ระบบใช้กฎที่ priority น้อยกว่าก่อน (เท่ากันใช้ id น้อยกว่า)
 * หน้ารายการกฎให้กด "ย้ายขึ้น/ย้ายลง" แทนการพิมพ์ตัวเลขเอง
 */

export const PRIORITY_MAX = 1000;

/**
 * ย้ายกฎ id ขึ้น/ลงหนึ่งลำดับในกลุ่ม แล้วให้เลขใหม่ทั้งกลุ่มแบบเว้นช่วง (10, 20, 30, …) เพื่อไม่ให้มีเลขซ้ำกัน
 * orderedIds = id ของกฎในกลุ่มเดียวกัน เรียงตามลำดับที่ใช้อยู่ตอนนี้ — ย้ายไม่ได้ (อยู่บนสุด/ล่างสุด/ไม่พบ) คืน null
 */
export function movedPriorities(orderedIds: number[], id: number, dir: "up" | "down"): { id: number; priority: number }[] | null {
  const from = orderedIds.indexOf(id);
  const to = dir === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= orderedIds.length) return null;
  const ids = [...orderedIds];
  [ids[from], ids[to]] = [ids[to], ids[from]];
  const step = Math.max(1, Math.min(10, Math.floor(PRIORITY_MAX / (ids.length + 1))));
  return ids.map((ruleId, i) => ({ id: ruleId, priority: Math.min(PRIORITY_MAX, (i + 1) * step) }));
}
