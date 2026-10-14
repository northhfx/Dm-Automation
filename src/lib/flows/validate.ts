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
import { createT } from "@/lib/i18n/core";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { builderMessages } from "@/lib/i18n/messages/builder";

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

export interface ValidateStepsOptions {
  /** ภาษาของข้อความ error (ค่าเริ่มต้น = ไทย) */
  locale?: Locale;
  /** ชื่อเรียกการ์ดลำดับที่ n ในข้อความ error (ค่าเริ่มต้น "ข้อความที่ n" — หน้าแผนผังใช้ "ข้อความ #n" ให้ตรงกับบนการ์ด) */
  stepLabel?: (n: number) => string;
}

/**
 * ตรวจข้อความทั้งหมดของกฎ แล้วคืนข้อความ error (ตามภาษาที่ส่งมา) ที่บอกว่าผิดตรงไหน
 * ข้อความที่ยังไม่มีปุ่มไหนพาไปถึงบันทึกได้ (เป็นการ์ดร่าง) แต่จะไม่ถูกส่ง
 */
export function validateSteps(input: unknown, { locale = DEFAULT_LOCALE, stepLabel }: ValidateStepsOptions = {}): StepsResult {
  const t = createT(builderMessages, locale);
  // ตัวเลขลิมิตส่งเป็น string: ข้อความเดิมไม่มีตัวคั่นหลักพัน ("1000")
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: t("noSteps") };
  if (input.length > FLOW_LIMITS.maxSteps) return { ok: false, error: t("maxSteps", { max: String(FLOW_LIMITS.maxSteps) }) };

  const steps: FlowStep[] = [];
  const ids = new Set<string>();
  for (const raw of input as any[]) {
    const id = String(raw?.id ?? "");
    if (!ID_PATTERN.test(id) || ids.has(id)) return { ok: false, error: t("badStepData") };
    ids.add(id);
    const buttons: FlowButton[] = [];
    for (const b of Array.isArray(raw?.buttons) ? raw.buttons : []) {
      const type = b?.type === "next" ? "next" : b?.type === "link" ? "link" : null;
      const bid = String(b?.id ?? "");
      if (!type || !ID_PATTERN.test(bid)) return { ok: false, error: t("badButtonData") };
      buttons.push(
        type === "next"
          ? { id: bid, title: String(b.title ?? "").trim(), type, nextStepId: String(b.nextStepId ?? "") }
          : { id: bid, title: String(b.title ?? "").trim(), type, url: String(b.url ?? "").trim() },
      );
    }
    steps.push({ id, text: String(raw?.text ?? "").trim(), buttons });
  }

  const nameVars = { token: "{name}", allowance: String(NAME_ALLOWANCE) };
  for (const [i, step] of steps.entries()) {
    const label = stepLabel ? stepLabel(i + 1) : t("stepLabel", { n: i + 1 });
    /** where = ตำแหน่งที่ผิด (ไม่ส่ง = ทั้งข้อความ) */
    const fail = (issue: string, where = label): StepsResult => ({ ok: false, error: t("issueAt", { where, issue }), stepId: step.id });
    if (!step.text) return fail(t("textMissing"));
    const max = step.buttons.length ? FLOW_LIMITS.textWithButtons : FLOW_LIMITS.textPlain;
    if (measuredLength(step.text) > max) {
      const withName = step.text.includes("{name}");
      const vars = { max: String(max), ...nameVars };
      return fail(
        step.buttons.length ? t(withName ? "tooLongButtonsName" : "tooLongButtons", vars) : t(withName ? "tooLongName" : "tooLong", vars),
      );
    }
    if (step.buttons.length > FLOW_LIMITS.maxButtons) return fail(t("tooManyButtons", { max: String(FLOW_LIMITS.maxButtons) }));

    const buttonIds = new Set<string>();
    for (const [j, b] of step.buttons.entries()) {
      const at = (button: string) => t("inStep", { step: label, button });
      const where = at(t("buttonLabel", { n: j + 1 }));
      const whereTitled = at(t("buttonLabelTitled", { n: j + 1, title: b.title }));
      if (buttonIds.has(b.id)) return { ok: false, error: t("badButtonData"), stepId: step.id };
      buttonIds.add(b.id);
      if (!b.title) return fail(t("buttonNameMissing"), where);
      if (b.title.length > FLOW_LIMITS.buttonTitle) {
        return fail(t("buttonNameTooLong", { max: String(FLOW_LIMITS.buttonTitle) }), where);
      }
      if (b.type === "link" && !isHttpUrl(b.url ?? "")) {
        return fail(t("buttonLinkInvalid"), whereTitled);
      }
      if (b.type === "next" && (!b.nextStepId || !ids.has(b.nextStepId) || b.nextStepId === step.id)) {
        return fail(t("buttonNextMissing"), whereTitled);
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
