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

/** ขนาดการ์ดบนแผนผัง (หน่วยพิกเซลตอนซูม 100%) */
export interface NodeSize {
  w: number;
  h: number;
}

export interface CanvasLayoutOptions {
  /** ข้อความที่การ์ด "เมื่อ…" เชื่อมไป (null = ยังไม่ได้เชื่อม → ใช้ข้อความลำดับแรกเป็นจุดเริ่มจัดวาง) */
  startStepId?: string | null;
  /** ขนาดจริงที่วัดได้จากหน้าจอ (ไม่มี = ใช้ขนาดประมาณ) */
  sizes?: Record<string, NodeSize>;
  triggerSize?: NodeSize;
}

export interface CanvasLayout {
  trigger: { x: number; y: number };
  steps: Record<string, { x: number; y: number }>;
}

/** ระยะห่างระหว่างคอลัมน์ (ซ้ายของคอลัมน์หนึ่ง → ซ้ายของคอลัมน์ถัดไป) */
export const LAYOUT_COLUMN_GAP = 340;
/** ระยะห่างแนวตั้งระหว่างการ์ดในคอลัมน์เดียวกัน */
export const LAYOUT_ROW_GAP = 40;

/** ประมาณความสูงการ์ดก่อนวัดขนาดจริงได้ (หัวการ์ด + ข้อความ + ปุ่มละ ~44px) */
export function estimateStepHeight(step: FlowStep): number {
  const lines = Math.min(5, Math.max(1, Math.ceil(step.text.length / 34) + (step.text.match(/\n/g)?.length ?? 0)));
  return 64 + lines * 21 + step.buttons.length * 44 + 16;
}

/**
 * จัดตำแหน่งการ์ดอัตโนมัติ: การ์ด "เมื่อ…" ซ้ายสุด → คอลัมน์ตามระยะห่างจากข้อความแรก (layoutFlow)
 * การ์ดในคอลัมน์เรียงตามลำดับปุ่มของการ์ดก่อนหน้า (เส้นจะได้ไม่ไขว้กัน) และการ์ดที่ไม่มีปุ่มพามาอยู่คอลัมน์ท้ายสุด
 */
export function layoutCanvas(steps: FlowStep[], options: CanvasLayoutOptions = {}): CanvasLayout {
  const { sizes = {}, startStepId } = options;
  const startIndex = startStepId ? steps.findIndex((s) => s.id === startStepId) : -1;
  const ordered = startIndex > 0 ? [steps[startIndex], ...steps.slice(0, startIndex), ...steps.slice(startIndex + 1)] : steps;
  const { columns, unreachable } = layoutFlow(ordered);
  // ถ้ายังไม่ได้เชื่อมการ์ด "เมื่อ…" ทุกการ์ดถือว่ายังไม่ถูกส่ง แต่ยังจัดวางตามลำดับปุ่มให้อ่านง่าย
  const byId = new Map(steps.map((s) => [s.id, s]));
  const heightOf = (id: string) => sizes[id]?.h ?? estimateStepHeight(byId.get(id)!);

  const row = new Map<string, number>();
  const sorted: string[][] = [];
  for (const [i, column] of columns.entries()) {
    if (i === 0) {
      sorted.push(column);
    } else {
      const rank = (id: string) => {
        let best = Number.POSITIVE_INFINITY;
        for (const parentId of sorted[i - 1]) {
          byId.get(parentId)!.buttons.forEach((b, j) => {
            if (b.type === "next" && b.nextStepId === id) best = Math.min(best, row.get(parentId)! * 10 + j);
          });
        }
        return best;
      };
      sorted.push(column.map((id, k) => ({ id, k, r: rank(id) })).sort((a, b) => a.r - b.r || a.k - b.k).map((x) => x.id));
    }
    sorted[i].forEach((id, k) => row.set(id, k));
  }
  if (unreachable.length) sorted.push(unreachable);

  const out: CanvasLayout = { trigger: { x: 0, y: 0 }, steps: {} };
  sorted.forEach((column, i) => {
    let y = 0;
    for (const id of column) {
      out.steps[id] = { x: LAYOUT_COLUMN_GAP * (i + 1), y };
      y += heightOf(id) + LAYOUT_ROW_GAP;
    }
  });
  return out;
}
