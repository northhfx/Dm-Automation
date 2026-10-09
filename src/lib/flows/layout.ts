import type { FlowStep } from "./types";

export interface FlowLayout {
  /** คอลัมน์จากซ้ายไปขวา: คอลัมน์ที่ 0 = ข้อความแรก, คอลัมน์ถัดไป = ข้อความที่ปุ่มในคอลัมน์ก่อนหน้าพาไป */
  columns: string[][];
  /** ข้อความที่ยังไม่มีปุ่มไหนพาไปถึง (แสดงแยกไว้ท้ายสุด) */
  unreachable: string[];
}

/** จัดข้อความเป็นคอลัมน์สำหรับแผนผัง (ซ้าย → ขวา) ตามระยะห่างจากข้อความแรก */
export function layoutFlow(steps: FlowStep[]): FlowLayout {
  if (steps.length === 0) return { columns: [], unreachable: [] };
  const byId = new Map(steps.map((s) => [s.id, s]));
  const depth = new Map<string, number>([[steps[0].id, 0]]);
  const queue = [steps[0].id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const b of byId.get(id)?.buttons ?? []) {
      const target = b.type === "next" ? b.nextStepId : undefined;
      if (!target || !byId.has(target) || depth.has(target)) continue;
      depth.set(target, depth.get(id)! + 1);
      queue.push(target);
    }
  }
  const columns: string[][] = Array.from({ length: Math.max(...depth.values()) + 1 }, () => []);
  const unreachable: string[] = [];
  for (const s of steps) {
    const d = depth.get(s.id);
    if (d === undefined) unreachable.push(s.id);
    else columns[d].push(s.id);
  }
  return { columns, unreachable };
}
