/*
 * เรียงลำดับกฎ: ระบบใช้กฎที่ priority น้อยกว่าก่อน (เท่ากันใช้ id น้อยกว่า)
 * หน้ารายการกฎให้กด "ย้ายขึ้น/ย้ายลง" แทนการพิมพ์ตัวเลขเอง
 */

export const PRIORITY_MAX = 1000;

/**
 * ย้ายกฎ id ขึ้น/ลงหนึ่งลำดับในกลุ่ม แล้วให้เลขใหม่ทั้งกลุ่มแบบเว้นช่วง (10, 20, 30, …) เพื่อไม่ให้มีเลขซ้ำกัน
 * orderedIds = id ของกฎในกลุ่มเดียวกัน เรียงตามลำดับที่ใช้อยู่ตอนนี้ — ย้ายไม่ได้ (อยู่บนสุด/ล่างสุด/ไม่พบ) คืน null
 * visibleIds = ดูอยู่ในโฟลเดอร์ (เห็นแค่บางกฎ): ย้ายข้ามกฎที่ซ่อนอยู่ไปอยู่เหนือ/ใต้กฎที่เห็นตัวถัดไป
 *   (กฎในโฟลเดอร์อื่นยังอยู่ลำดับเดิมเทียบกันเอง)
 */
export function movedPriorities(
  orderedIds: number[],
  id: number,
  dir: "up" | "down",
  visibleIds?: ReadonlySet<number>,
): { id: number; priority: number }[] | null {
  const visible = visibleIds ? orderedIds.filter((x) => visibleIds.has(x) || x === id) : orderedIds;
  const from = visible.indexOf(id);
  const to = dir === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= visible.length) return null;
  const neighbor = visible[to];
  const ids = orderedIds.filter((x) => x !== id);
  const at = ids.indexOf(neighbor);
  ids.splice(dir === "up" ? at : at + 1, 0, id);
  const step = Math.max(1, Math.min(10, Math.floor(PRIORITY_MAX / (ids.length + 1))));
  return ids.map((ruleId, i) => ({ id: ruleId, priority: Math.min(PRIORITY_MAX, (i + 1) * step) }));
}
