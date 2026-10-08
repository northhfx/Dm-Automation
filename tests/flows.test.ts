import { describe, expect, it } from "vitest";
import { validateSteps } from "@/lib/flows/validate";
import type { FlowStep } from "@/lib/flows/types";

const good: FlowStep[] = [
  { id: "s1", text: "สวัสดี {name}", buttons: [{ id: "b1", title: "ใช่ ฉันสนใจ!", type: "next", nextStepId: "s2" }] },
  { id: "s2", text: "นี่คือลิงก์", buttons: [{ id: "b2", title: "ดูรายละเอียด", type: "link", url: "https://shop.example.com" }] },
];

function errorOf(steps: unknown): string {
  const result = validateSteps(steps);
  if (result.ok) throw new Error("ควรไม่ผ่าน");
  return result.error;
}

describe("validateSteps", () => {
  it("ผ่านเมื่อข้อมูลครบ และตัดช่องว่างหัวท้าย", () => {
    const result = validateSteps([{ ...good[0], text: "  สวัสดี {name}  " }, good[1]]);
    expect(result).toEqual({ ok: true, steps: good });
  });

  it("ต้องมีอย่างน้อย 1 ข้อความ และข้อความห้ามว่าง", () => {
    expect(errorOf([])).toContain("อย่างน้อย 1");
    expect(errorOf([{ id: "s1", text: " ", buttons: [] }])).toBe("ข้อความที่ 1: ยังไม่ได้ใส่ข้อความ");
  });

  it("ข้อความที่มีปุ่มยาวได้ไม่เกิน 640 ตัวอักษร ส่วนข้อความธรรมดาได้ 1,000", () => {
    expect(validateSteps([{ id: "s1", text: "ก".repeat(900), buttons: [] }]).ok).toBe(true);
    expect(errorOf([{ ...good[1], text: "ก".repeat(641) }])).toContain("640");
  });

  it("ชื่อปุ่มต้องมีและยาวไม่เกิน 20 ตัวอักษร", () => {
    expect(errorOf([{ ...good[1], buttons: [{ ...good[1].buttons[0], title: "" }] }])).toBe("ข้อความที่ 1 ปุ่มที่ 1: ยังไม่ได้ตั้งชื่อปุ่ม");
    expect(errorOf([{ ...good[1], buttons: [{ ...good[1].buttons[0], title: "ก".repeat(21) }] }])).toContain("20");
  });

  it("ปุ่มเปิดลิงก์ต้องเป็นลิงก์ http/https", () => {
    expect(errorOf([{ ...good[1], buttons: [{ ...good[1].buttons[0], url: "shop.example.com" }] }])).toContain("https://");
    expect(errorOf([{ ...good[1], buttons: [{ ...good[1].buttons[0], url: "javascript:alert(1)" }] }])).toContain("https://");
  });

  it("ปุ่มส่งข้อความถัดไปต้องชี้ไปข้อความอื่นที่มีอยู่จริง", () => {
    expect(errorOf([{ ...good[0], buttons: [{ ...good[0].buttons[0], nextStepId: "missing" }] }, good[1]])).toContain("เลือกว่ากดแล้ว");
    expect(errorOf([{ ...good[0], buttons: [{ ...good[0].buttons[0], nextStepId: "s1" }] }, good[1]])).toContain("เลือกว่ากดแล้ว");
  });

  it("ข้อความที่ไม่มีปุ่มไหนพาไปถึง ไม่ให้บันทึก", () => {
    expect(errorOf([{ ...good[0], buttons: [] }, good[1]])).toContain("ข้อความที่ 2: ยังไม่มีปุ่มไหนพามา");
  });

  it("ไม่เกิน 3 ปุ่มต่อข้อความ และกัน id ซ้ำ/แปลก", () => {
    const four = [1, 2, 3, 4].map((n) => ({ id: `b${n}`, title: `ปุ่ม ${n}`, type: "link", url: "https://x.com" }));
    expect(errorOf([{ id: "s1", text: "a", buttons: four }])).toContain("สูงสุด 3");
    expect(errorOf([good[0], { ...good[1], id: "s1" }])).toContain("ลองรีเฟรช");
    expect(errorOf([{ id: "bad id!", text: "a", buttons: [] }])).toContain("ลองรีเฟรช");
    expect(errorOf("not an array")).toContain("อย่างน้อย 1");
  });
});
