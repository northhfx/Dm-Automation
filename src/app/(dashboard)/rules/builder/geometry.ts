/** คณิตศาสตร์ของแผนผัง: เส้นโค้ง ซูม และการจัดให้พอดีจอ (หน่วย world = พิกเซลตอนซูม 100%) */

export interface View {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 1.6;

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** ซูมโดยให้จุดใต้นิ้ว/เมาส์ (px, py ในพิกัดของกรอบแผนผัง) อยู่ที่เดิม */
export function zoomAt(view: View, zoom: number, px: number, py: number): View {
  const z = clampZoom(zoom);
  const wx = (px - view.x) / view.zoom;
  const wy = (py - view.y) / view.zoom;
  return { zoom: z, x: px - wx * z, y: py - wy * z };
}

export function toWorld(view: View, px: number, py: number): { x: number; y: number } {
  return { x: (px - view.x) / view.zoom, y: (py - view.y) / view.zoom };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function boundsOf(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x1 = Math.min(...boxes.map((b) => b.x));
  const y1 = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** มุมมองที่เห็นการ์ดทั้งหมด (ซูมไม่เกิน maxZoom) ในกรอบกว้าง w สูง h */
export function fitView(bounds: Box, w: number, h: number, { padding = 48, maxZoom = 1 } = {}): View {
  const zoom = clampZoom(Math.min(maxZoom, (w - padding * 2) / Math.max(1, bounds.w), (h - padding * 2) / Math.max(1, bounds.h)));
  return {
    zoom,
    x: (w - bounds.w * zoom) / 2 - bounds.x * zoom,
    y: (h - bounds.h * zoom) / 2 - bounds.y * zoom,
  };
}

/** เส้นโค้งจากจุดต่อขาออก (ขวาของการ์ด) ไปยังจุดรับ (ซ้ายของการ์ดปลายทาง) พร้อมจุดกึ่งกลาง */
export function edgePath(sx: number, sy: number, tx: number, ty: number): { d: string; mid: { x: number; y: number } } {
  const dx = tx - sx;
  // เส้นที่ย้อนกลับไปทางซ้ายต้องโค้งออกกว้างขึ้น จะได้ไม่ทับการ์ด
  const bend = dx >= 0 ? Math.max(40, Math.min(160, dx / 2)) : Math.min(220, 80 + Math.abs(dx) / 3);
  const c1x = sx + bend;
  const c2x = tx - bend;
  const d = `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`;
  // จุดบนเส้นโค้งที่ t = 0.5
  const mid = { x: (sx + 3 * c1x + 3 * c2x + tx) / 8, y: (sy + 3 * sy + 3 * ty + ty) / 8 };
  return { d, mid };
}
