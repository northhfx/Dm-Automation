/**
 * ข้อความแบบเป็นขั้นตอน (flow): แต่ละกฎมีข้อความได้หลายข้อความ
 * แต่ละข้อความมีปุ่มได้สูงสุด 3 ปุ่ม — ปุ่ม "ส่งข้อความถัดไป" หรือปุ่ม "เปิดลิงก์"
 */

export type ButtonType = "next" | "link";

export interface FlowButton {
  id: string;
  title: string;
  type: ButtonType;
  /** สำหรับปุ่ม next: id ของข้อความที่จะส่งเมื่อกด */
  nextStepId?: string;
  /** สำหรับปุ่ม link: ลิงก์ปลายทาง (ระบบแปลงเป็นลิงก์ติดตามการคลิกให้) */
  url?: string;
}

export interface FlowStep {
  id: string;
  text: string;
  buttons: FlowButton[];
}

/** ตำแหน่งการ์ดบนแผนผัง (หน่วยเป็นพิกเซลของแผนผังตอนซูม 100%) */
export interface CanvasPoint {
  x: number;
  y: number;
}

/** ตำแหน่งการ์ดที่ผู้ใช้ลากจัดไว้เอง — ใช้แสดงผลเท่านั้น ไม่มีผลกับการส่งข้อความ */
export interface FlowCanvas {
  trigger?: CanvasPoint;
  steps?: Record<string, CanvasPoint>;
}

/** ลิมิตของ Messenger / Instagram */
export const FLOW_LIMITS = {
  maxSteps: 20,
  maxButtons: 3,
  buttonTitle: 20,
  textWithButtons: 640,
  textPlain: 1000,
} as const;

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

/** เผื่อความยาวชื่อที่จะมาแทน {name} (ชื่อ/username ส่วนใหญ่ยาวไม่เกิน 30 ตัวอักษร) */
export const NAME_ALLOWANCE = 30;

/** ความยาวข้อความหลังแทนชื่อลูกค้าแล้ว (ใช้ตรวจลิมิตตอนบันทึก) */
export function measuredLength(text: string): number {
  return text.replaceAll("{name}", "x".repeat(NAME_ALLOWANCE)).length;
}

/** ตัดข้อความให้ไม่เกินลิมิตของ Meta (กันกรณีชื่อลูกค้ายาวผิดปกติ) โดยไม่ตัดอีโมจิกลางตัว */
export function fitText(text: string, max: number): string {
  if (text.length <= max) return text;
  let out = "";
  for (const ch of Array.from(text)) {
    if (out.length + ch.length > max - 1) break;
    out += ch;
  }
  return `${out}…`;
}

/** payload ที่ฝังในปุ่ม เพื่อให้รู้ว่าลูกค้ากดปุ่มไหนของกฎไหน */
export function flowPayload(ruleId: number, stepId: string, buttonId: string): string {
  return `flow:${ruleId}:${stepId}:${buttonId}`;
}

export function parseFlowPayload(payload: string | null | undefined): { ruleId: number; stepId: string; buttonId: string } | null {
  if (!payload) return null;
  const match = /^flow:(\d+):([A-Za-z0-9_-]{1,32}):([A-Za-z0-9_-]{1,32})$/.exec(payload);
  if (!match) return null;
  return { ruleId: Number(match[1]), stepId: match[2], buttonId: match[3] };
}

/** ลำดับเลขของข้อความ (เริ่มที่ 1) ใช้แสดงผล เช่น "ข้อความที่ 2" */
export function stepNumber(steps: FlowStep[], stepId: string | undefined): number | null {
  const index = steps.findIndex((s) => s.id === stepId);
  return index === -1 ? null : index + 1;
}
