import { describe, expect, it } from "vitest";
import { estimateStepHeight, LAYOUT_COLUMN_GAP, LAYOUT_ROW_GAP, layoutCanvas, layoutFlow } from "@/lib/flows/layout";
import { sanitizeCanvas, validateSteps } from "@/lib/flows/validate";
import { fitText, measuredLength, type FlowStep } from "@/lib/flows/types";

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
    expect(errorOf([{ ...good[0], buttons: [{ ...good[0].buttons[0], nextStepId: "missing" }] }, good[1]])).toContain("ยังไม่ได้เชื่อม");
    expect(errorOf([{ ...good[0], buttons: [{ ...good[0].buttons[0], nextStepId: "s1" }] }, good[1]])).toContain("ยังไม่ได้เชื่อม");
  });

  it("บอกว่าข้อความไหนมีปัญหา เพื่อให้หน้าแก้ไขเลือกการ์ดนั้น", () => {
    const result = validateSteps([good[0], { ...good[1], text: "" }]);
    expect(result).toMatchObject({ ok: false, stepId: "s2" });
  });

  it("ข้อความที่ยังไม่มีปุ่มพาไปถึงบันทึกได้ (การ์ดร่าง)", () => {
    expect(validateSteps([{ ...good[0], buttons: [] }, good[1]]).ok).toBe(true);
  });

  it("ไม่เกิน 3 ปุ่มต่อข้อความ และกัน id ซ้ำ/แปลก", () => {
    const four = [1, 2, 3, 4].map((n) => ({ id: `b${n}`, title: `ปุ่ม ${n}`, type: "link", url: "https://x.com" }));
    expect(errorOf([{ id: "s1", text: "a", buttons: four }])).toContain("สูงสุด 3");
    expect(errorOf([good[0], { ...good[1], id: "s1" }])).toContain("ลองรีเฟรช");
    expect(errorOf([{ id: "bad id!", text: "a", buttons: [] }])).toContain("ลองรีเฟรช");
    expect(errorOf("not an array")).toContain("อย่างน้อย 1");
  });
});

describe("ความยาวข้อความ", () => {
  it("นับ {name} เผื่อชื่อยาว 30 ตัวอักษร", () => {
    expect(measuredLength("สวัสดี {name}")).toBe(7 + 30);
    const almost = "ก".repeat(620) + "{name}"; // 620 + 6 ตัวผ่านแบบนับตรงๆ แต่หลังแทนชื่อยาวได้ถึง 650
    expect(errorOf([{ ...good[1], text: almost }])).toContain("นับ {name} เผื่อ");
    expect(validateSteps([{ ...good[1], text: "ก".repeat(600) + "{name}" }]).ok).toBe(true);
  });

  it("ตัดข้อความที่ยาวเกินโดยไม่ทำให้อีโมจิแตก", () => {
    expect(fitText("สั้น", 10)).toBe("สั้น");
    const cut = fitText("😀".repeat(10), 7);
    expect(cut.length).toBeLessThanOrEqual(7);
    expect(cut).toBe("😀😀😀…");
  });
});

describe("layoutFlow (แผนผัง)", () => {
  const step = (id: string, ...targets: string[]): FlowStep => ({
    id,
    text: id,
    buttons: targets.map((t, i) => ({ id: `${id}b${i}`, title: t, type: "next", nextStepId: t })),
  });

  it("เรียงคอลัมน์ตามระยะจากข้อความแรก และแยกข้อความที่ไม่มีปุ่มพามาไว้ต่างหาก", () => {
    const steps = [step("s1", "s2", "s3"), step("s2", "s4"), step("s3"), step("s4", "s1"), step("lost", "s2")];
    expect(layoutFlow(steps)).toEqual({ columns: [["s1"], ["s2", "s3"], ["s4"]], unreachable: ["lost"] });
  });

  it("ไม่สนปุ่มลิงก์และปุ่มที่ยังไม่ได้เลือกข้อความ", () => {
    const steps: FlowStep[] = [
      { id: "s1", text: "a", buttons: [{ id: "b1", title: "x", type: "link", url: "https://x.com" }, { id: "b2", title: "y", type: "next", nextStepId: "" }] },
      step("s2"),
    ];
    expect(layoutFlow(steps)).toEqual({ columns: [["s1"]], unreachable: ["s2"] });
    expect(layoutFlow([])).toEqual({ columns: [], unreachable: [] });
  });
});

describe("sanitizeCanvas", () => {
  it("เก็บเฉพาะตำแหน่งที่ถูกต้องของการ์ดที่มีอยู่จริง และปัดเป็นจำนวนเต็ม", () => {
    expect(
      sanitizeCanvas(
        { trigger: { x: 10.4, y: -3.6 }, steps: { s1: { x: 1, y: 2 }, gone: { x: 5, y: 5 }, s2: { x: "a", y: 1 }, s3: { x: null, y: 0 } } },
        ["s1", "s2", "s3"],
      ),
    ).toEqual({ trigger: { x: 10, y: -4 }, steps: { s1: { x: 1, y: 2 } } });
  });

  it("ข้อมูลผิดรูปแบบไม่ทำให้พัง และตัดค่าที่ใหญ่ผิดปกติ", () => {
    expect(sanitizeCanvas(null, ["s1"])).toEqual({});
    expect(sanitizeCanvas("x", ["s1"])).toEqual({});
    expect(sanitizeCanvas({ steps: { s1: { x: 1e12, y: -1e12 } } }, ["s1"])).toEqual({ steps: { s1: { x: 100000, y: -100000 } } });
    expect(sanitizeCanvas({ steps: { __proto__: { x: 1, y: 1 } } }, ["__proto__"])).toEqual({});
  });
});

describe("layoutCanvas (จัดตำแหน่งการ์ดอัตโนมัติ)", () => {
  const step = (id: string, ...targets: string[]): FlowStep => ({
    id,
    text: id,
    buttons: targets.map((t, i) => ({ id: `${id}b${i}`, title: t, type: "next", nextStepId: t })),
  });

  it("การ์ด เมื่อ… ซ้ายสุด แล้วเป็นคอลัมน์ห่างกัน 340px เรียงตามลำดับปุ่ม และการ์ดที่ไม่มีปุ่มพามาอยู่คอลัมน์ท้าย", () => {
    // s1 → ปุ่มแรกไป s3 ปุ่มสองไป s2 (s3 ต้องอยู่บน แม้จะสร้างทีหลัง)
    const steps = [step("s1", "s3", "s2"), step("s2"), step("s3"), step("lost")];
    const sizes = { s1: { w: 288, h: 200 }, s2: { w: 288, h: 120 }, s3: { w: 288, h: 150 }, lost: { w: 288, h: 100 } };
    const out = layoutCanvas(steps, { startStepId: "s1", sizes });
    expect(out.trigger).toEqual({ x: 0, y: 0 });
    expect(out.steps.s1).toEqual({ x: LAYOUT_COLUMN_GAP, y: 0 });
    expect(out.steps.s3).toEqual({ x: LAYOUT_COLUMN_GAP * 2, y: 0 });
    expect(out.steps.s2).toEqual({ x: LAYOUT_COLUMN_GAP * 2, y: 150 + LAYOUT_ROW_GAP });
    expect(out.steps.lost).toEqual({ x: LAYOUT_COLUMN_GAP * 3, y: 0 });
  });

  it("ข้อความแรกไม่ได้อยู่ลำดับแรก → เริ่มจัดจากข้อความแรกจริง, ไม่มีขนาดจริงใช้ขนาดประมาณ", () => {
    const steps = [step("a"), step("b", "a")];
    const out = layoutCanvas(steps, { startStepId: "b" });
    expect(out.steps.b).toEqual({ x: LAYOUT_COLUMN_GAP, y: 0 });
    expect(out.steps.a).toEqual({ x: LAYOUT_COLUMN_GAP * 2, y: 0 });
    expect(estimateStepHeight(step("x", "y"))).toBeGreaterThan(estimateStepHeight(step("x")));
    expect(layoutCanvas([])).toEqual({ trigger: { x: 0, y: 0 }, steps: {} });
  });
});
