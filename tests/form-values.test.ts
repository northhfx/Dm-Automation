import { describe, expect, it } from "vitest";
import { DEFAULT_RULE, formDataToValues, validateRule, type RuleFormValues } from "@/app/(dashboard)/rules/form-values";
import type { FlowStep } from "@/lib/flows/types";

const STEPS: FlowStep[] = [
  { id: "s1", text: "ข้อความแรก", buttons: [{ id: "b1", title: "ต่อ", type: "next", nextStepId: "s2" }] },
  { id: "s2", text: "ข้อความสอง", buttons: [] },
];

function form(fields: Record<string, string>, steps: unknown = STEPS): FormData {
  const data = new FormData();
  data.set("name", "ทดสอบ");
  data.set("trigger", "comment");
  data.append("platforms", "facebook");
  data.set("matchType", "contains");
  data.set("keywords", "สนใจ");
  data.set("steps", JSON.stringify(steps));
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

describe("ฟอร์มกฎ (แผนผัง)", () => {
  it("ย้ายข้อความที่การ์ด เมื่อ… เชื่อมไป มาไว้ลำดับแรก", () => {
    const steps = [STEPS[1], { ...STEPS[0], buttons: [{ ...STEPS[0].buttons[0] }] }];
    const values = formDataToValues(form({ startStepId: "s1" }, steps));
    expect(values.steps.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(validateRule(values).ok).toBe(true);
  });

  it("ยังไม่ได้เชื่อมการ์ด เมื่อ… → บันทึกไม่ได้", () => {
    const result = validateRule(formDataToValues(form({ startStepId: "" })));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("เมื่อ…") });
    const missing = validateRule(formDataToValues(form({ startStepId: "nope" })));
    expect(missing.ok).toBe(false);
  });

  it("ฟอร์มที่ไม่ได้ส่ง startStepId มาใช้ข้อความลำดับแรกตามเดิม", () => {
    const values = formDataToValues(form({}));
    expect(values.startStepId).toBeUndefined();
    expect(validateRule(values).ok).toBe(true);
  });

  it("เก็บตำแหน่งการ์ดที่ถูกต้อง และบอกว่าการ์ดไหนผิด", () => {
    const values = formDataToValues(
      form({ startStepId: "s1", canvas: JSON.stringify({ trigger: { x: 0, y: 0 }, steps: { s1: { x: 300, y: 20 }, zzz: { x: 1, y: 1 } } }) }),
    );
    const result = validateRule(values);
    expect(result.ok && result.data.canvas).toEqual({ trigger: { x: 0, y: 0 }, steps: { s1: { x: 300, y: 20 } } });

    const broken: RuleFormValues = { ...values, steps: [STEPS[0], { ...STEPS[1], text: " " }] };
    expect(validateRule(broken)).toMatchObject({ ok: false, stepId: "s2" });
    expect(formDataToValues(form({ canvas: "{not json" })).canvas).toEqual({});
  });

  it("ค่าเริ่มต้นของกฎใหม่มีตำแหน่งการ์ดว่าง", () => {
    expect(DEFAULT_RULE.canvas).toEqual({});
  });
});
