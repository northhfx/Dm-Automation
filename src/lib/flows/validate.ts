import { FLOW_LIMITS, ID_PATTERN, measuredLength, NAME_ALLOWANCE, type FlowButton, type FlowStep } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- รับข้อมูลจากฟอร์ม (JSON) แล้วตรวจทีละช่อง */

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** ตรวจข้อความทั้งหมดของกฎ แล้วคืนข้อความ error ภาษาไทยที่บอกว่าผิดตรงไหน */
export function validateSteps(input: unknown): { ok: true; steps: FlowStep[] } | { ok: false; error: string } {
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

  const incoming = new Set<string>();
  for (const [i, step] of steps.entries()) {
    const label = `ข้อความที่ ${i + 1}`;
    if (!step.text) return { ok: false, error: `${label}: ยังไม่ได้ใส่ข้อความ` };
    const max = step.buttons.length ? FLOW_LIMITS.textWithButtons : FLOW_LIMITS.textPlain;
    if (measuredLength(step.text) > max) {
      const nameNote = step.text.includes("{name}") ? ` โดยนับ {name} เผื่อเป็น ${NAME_ALLOWANCE} ตัวอักษร` : "";
      return {
        ok: false,
        error: step.buttons.length
          ? `${label}: ยาวเกิน ${max} ตัวอักษร (ข้อความที่มีปุ่มส่งได้ไม่เกิน ${max} ตัวอักษร${nameNote})`
          : `${label}: ยาวเกิน ${max} ตัวอักษร${nameNote ? ` (${nameNote.trim()})` : ""}`,
      };
    }
    if (step.buttons.length > FLOW_LIMITS.maxButtons) return { ok: false, error: `${label}: ใส่ปุ่มได้สูงสุด ${FLOW_LIMITS.maxButtons} ปุ่ม` };

    const buttonIds = new Set<string>();
    for (const [j, b] of step.buttons.entries()) {
      const where = `${label} ปุ่มที่ ${j + 1}`;
      if (buttonIds.has(b.id)) return { ok: false, error: "ข้อมูลปุ่มไม่ถูกต้อง ลองรีเฟรชหน้าแล้วแก้ใหม่" };
      buttonIds.add(b.id);
      if (!b.title) return { ok: false, error: `${where}: ยังไม่ได้ตั้งชื่อปุ่ม` };
      if (b.title.length > FLOW_LIMITS.buttonTitle) {
        return { ok: false, error: `${where}: ชื่อปุ่มยาวได้ไม่เกิน ${FLOW_LIMITS.buttonTitle} ตัวอักษร` };
      }
      if (b.type === "link" && !isHttpUrl(b.url ?? "")) {
        return { ok: false, error: `${where} ("${b.title}"): ใส่ลิงก์ที่ขึ้นต้นด้วย https://` };
      }
      if (b.type === "next") {
        if (!b.nextStepId || !ids.has(b.nextStepId) || b.nextStepId === step.id) {
          return { ok: false, error: `${where} ("${b.title}"): เลือกว่ากดแล้วให้ส่งข้อความไหน` };
        }
        incoming.add(b.nextStepId);
      }
    }
  }

  // ข้อความที่ 2 เป็นต้นไปต้องมีปุ่มพาไป ไม่งั้นจะไม่มีวันถูกส่ง
  for (const [i, step] of steps.entries()) {
    if (i > 0 && !incoming.has(step.id)) {
      return { ok: false, error: `ข้อความที่ ${i + 1}: ยังไม่มีปุ่มไหนพามาที่ข้อความนี้ เพิ่มปุ่ม "ส่งข้อความถัดไป" หรือลบข้อความนี้` };
    }
  }

  return { ok: true, steps };
}
