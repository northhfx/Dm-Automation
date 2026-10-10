import {
  FLOW_LIMITS,
  ID_PATTERN,
  measuredLength,
  NAME_ALLOWANCE,
  type CanvasPoint,
  type FlowButton,
  type FlowCanvas,
  type FlowStep,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- รับข้อมูลจากฟอร์ม (JSON) แล้วตรวจทีละช่อง */

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export type StepsResult =
  | { ok: true; steps: FlowStep[] }
  | {
      ok: false;
      error: string;
      /** ข้อความที่มีปัญหา (ให้หน้าแก้ไขเลือกการ์ดนั้นให้) */
      stepId?: string;
    };

/**
 * ตรวจข้อความทั้งหมดของกฎ แล้วคืนข้อความ error ภาษาไทยที่บอกว่าผิดตรงไหน
 * ข้อความที่ยังไม่มีปุ่มไหนพาไปถึงบันทึกได้ (เป็นการ์ดร่าง) แต่จะไม่ถูกส่ง
 */
export function validateSteps(input: unknown): StepsResult {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: "ต้องมีข้อความอย่างน้อย 1 ข้อความ" };
  if (input.length > FLOW_LIMITS.maxSteps) return { ok: false, error: `ใส่ข้อความได้สูงสุด ${FLOW_LIMITS.maxSteps} ข้อความต่อกฎ` };

  const steps: FlowStep[] = [];
  const ids = new Set<string>();
  for (const raw of input as any[]) {
    const id = String(raw?.id ?? "");
    if (!ID_PATTERN.test(id) || ids.has(id)) return { ok: false, error: "ข้อมูลข้อความไม่ถูกต้อง ลองรีเฟรชหน้าแล้วแก้ใหม่" };
    ids.add(id);
    const buttons: FlowButton[] = [];
    for (const b of Array.isArray(raw?.buttons) ? raw.buttons : []) {
      const type = b?.type === "next" ? "next" : b?.type === "link" ? "link" : null;
      const bid = String(b?.id ?? "");
      if (!type || !ID_PATTERN.test(bid)) return { ok: false, error: "ข้อมูลปุ่มไม่ถูกต้อง ลองรีเฟรชหน้าแล้วแก้ใหม่" };
      buttons.push(
        type === "next"
          ? { id: bid, title: String(b.title ?? "").trim(), type, nextStepId: String(b.nextStepId ?? "") }
          : { id: bid, title: String(b.title ?? "").trim(), type, url: String(b.url ?? "").trim() },
      );
    }
    steps.push({ id, text: String(raw?.text ?? "").trim(), buttons });
  }

  for (const [i, step] of steps.entries()) {
    const label = `ข้อความที่ ${i + 1}`;
    const fail = (error: string): StepsResult => ({ ok: false, error, stepId: step.id });
    if (!step.text) return fail(`${label}: ยังไม่ได้ใส่ข้อความ`);
    const max = step.buttons.length ? FLOW_LIMITS.textWithButtons : FLOW_LIMITS.textPlain;
    if (measuredLength(step.text) > max) {
      const nameNote = step.text.includes("{name}") ? ` โดยนับ {name} เผื่อเป็น ${NAME_ALLOWANCE} ตัวอักษร` : "";
      return fail(
        step.buttons.length
          ? `${label}: ยาวเกิน ${max} ตัวอักษร (ข้อความที่มีปุ่มส่งได้ไม่เกิน ${max} ตัวอักษร${nameNote})`
          : `${label}: ยาวเกิน ${max} ตัวอักษร${nameNote ? ` (${nameNote.trim()})` : ""}`,
      );
    }
    if (step.buttons.length > FLOW_LIMITS.maxButtons) return fail(`${label}: ใส่ปุ่มได้สูงสุด ${FLOW_LIMITS.maxButtons} ปุ่ม`);

    const buttonIds = new Set<string>();
    for (const [j, b] of step.buttons.entries()) {
      const where = `${label} ปุ่มที่ ${j + 1}`;
      if (buttonIds.has(b.id)) return fail("ข้อมูลปุ่มไม่ถูกต้อง ลองรีเฟรชหน้าแล้วแก้ใหม่");
      buttonIds.add(b.id);
      if (!b.title) return fail(`${where}: ยังไม่ได้ตั้งชื่อปุ่ม`);
      if (b.title.length > FLOW_LIMITS.buttonTitle) {
        return fail(`${where}: ชื่อปุ่มยาวได้ไม่เกิน ${FLOW_LIMITS.buttonTitle} ตัวอักษร`);
      }
      if (b.type === "link" && !isHttpUrl(b.url ?? "")) {
        return fail(`${where} ("${b.title}"): ใส่ลิงก์ที่ขึ้นต้นด้วย https://`);
      }
      if (b.type === "next" && (!b.nextStepId || !ids.has(b.nextStepId) || b.nextStepId === step.id)) {
        return fail(`${where} ("${b.title}"): ยังไม่ได้เชื่อมว่ากดแล้วให้ส่งข้อความไหน (หรือเปลี่ยนเป็นปุ่มเปิดลิงก์)`);
      }
    }
  }

  return { ok: true, steps };
}

const CANVAS_LIMIT = 100_000;

function toPoint(raw: unknown): CanvasPoint | null {
  const p = raw as { x?: unknown; y?: unknown } | null;
  const x = Number(p?.x);
  const y = Number(p?.y);
  if (p?.x === null || p?.y === null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const clamp = (n: number) => Math.round(Math.min(CANVAS_LIMIT, Math.max(-CANVAS_LIMIT, n)));
  return { x: clamp(x), y: clamp(y) };
}

/** เก็บเฉพาะตำแหน่งที่ถูกต้องของการ์ดที่มีอยู่จริง (ข้อมูลผิดรูปแบบก็แค่ทิ้งไป ไม่ทำให้บันทึกไม่ได้) */
export function sanitizeCanvas(input: unknown, stepIds: string[]): FlowCanvas {
  const raw = (input && typeof input === "object" ? input : {}) as { trigger?: unknown; steps?: unknown };
  const canvas: FlowCanvas = {};
  const trigger = toPoint(raw.trigger);
  if (trigger) canvas.trigger = trigger;
  const rawSteps = (raw.steps && typeof raw.steps === "object" ? raw.steps : {}) as Record<string, unknown>;
  const steps: Record<string, CanvasPoint> = {};
  for (const id of stepIds) {
    if (!Object.hasOwn(rawSteps, id)) continue;
    const point = toPoint(rawSteps[id]);
    if (point) steps[id] = point;
  }
  if (Object.keys(steps).length) canvas.steps = steps;
  return canvas;
}
