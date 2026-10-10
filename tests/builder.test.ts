import { describe, expect, it } from "vitest";
import {
  builderReducer,
  createInitialState,
  edgesOf,
  findProblems,
  isDirty,
  orderedSteps,
  reachableSteps,
  spotRightOf,
  stepNumbers,
  toFormData,
  toFormEntries,
  TRIGGER_NODE,
  type BuilderAction,
  type BuilderState,
} from "@/app/(dashboard)/rules/builder/model";
import { edgePath, fitView, zoomAt } from "@/app/(dashboard)/rules/builder/geometry";
import { formDataToValues, validateRule, type RuleFormValues } from "@/app/(dashboard)/rules/form-values";
import { parseTemplateId, ruleTemplate } from "@/app/(dashboard)/rules/templates";

const base: RuleFormValues = {
  ...ruleTemplate("comment"),
  name: "ทดสอบ",
  keywords: "สนใจ\nราคา",
  steps: [
    { id: "s1", text: "สวัสดี {name}", buttons: [{ id: "b1", title: "สนใจ", type: "next", nextStepId: "s2" }] },
    { id: "s2", text: "ลิงก์", buttons: [{ id: "b2", title: "ดู", type: "link", url: "https://shop.example.com" }] },
  ],
};

function run(state: BuilderState, ...actions: BuilderAction[]): BuilderState {
  return actions.reduce(builderReducer, state);
}

describe("สร้าง state เริ่มต้น", () => {
  it("ข้อความแรกเป็นจุดเริ่ม และจัดตำแหน่งอัตโนมัติเมื่อยังไม่มีตำแหน่ง", () => {
    const s = createInitialState(base);
    expect(s.doc.startStepId).toBe("s1");
    expect(s.doc.keywords).toEqual(["สนใจ", "ราคา"]);
    expect(s.doc.publicReplies).toHaveLength(3);
    expect(s.autoPlaced).toBe(true);
    expect(s.doc.triggerPos).toEqual({ x: 0, y: 0 });
    expect(s.doc.positions.s1).toEqual({ x: 340, y: 0 });
    expect(s.doc.positions.s2.x).toBe(680);
    expect(isDirty(s)).toBe(false);
  });

  it("ใช้ตำแหน่งที่บันทึกไว้ และแยกโพสต์ที่รู้จัก/ใส่เองออกจากกัน", () => {
    const s = createInitialState(
      { ...base, postIds: ["p1", "manual"], canvas: { trigger: { x: 5, y: 6 }, steps: { s1: { x: 1, y: 2 }, s2: { x: 3, y: 4 } } } },
      ["p1"],
    );
    expect(s.autoPlaced).toBe(false);
    expect(s.doc.positions).toEqual({ s1: { x: 1, y: 2 }, s2: { x: 3, y: 4 } });
    expect(s.doc.allPosts).toBe(false);
    expect(s.doc.postIds).toEqual(["p1"]);
    expect(s.doc.postIdsManual).toBe("manual");
  });

  it("แม่แบบ: comment/dm/blank และค่าแปลกๆ ใช้ comment", () => {
    expect(parseTemplateId("dm")).toBe("dm");
    expect(parseTemplateId("x")).toBe("comment");
    expect(parseTemplateId(undefined)).toBe("comment");
    expect(ruleTemplate("comment").steps).toHaveLength(2);
    expect(ruleTemplate("dm").trigger).toBe("dm");
    const blank = createInitialState(ruleTemplate("blank"));
    expect(blank.doc.steps).toHaveLength(1);
    expect(blank.doc.startStepId).toBe("s1");
  });
});

describe("การ์ด: เพิ่ม / ทำสำเนา / ลบ", () => {
  it("เพิ่มการ์ดจากจุดต่อของปุ่ม → เชื่อมให้เลยและเลือกการ์ดใหม่", () => {
    const s = run(
      createInitialState(base),
      { type: "addButton", stepId: "s2", buttonId: "b3" },
      { type: "addStep", id: "s3", at: { x: 900, y: 10 }, from: { kind: "button", stepId: "s2", buttonId: "b3" } },
    );
    expect(s.doc.steps.map((x) => x.id)).toEqual(["s1", "s2", "s3"]);
    expect(s.doc.steps[1].buttons[1]).toMatchObject({ id: "b3", type: "next", nextStepId: "s3" });
    expect(s.doc.positions.s3).toEqual({ x: 900, y: 10 });
    expect(s.selection).toEqual({ kind: "step", id: "s3" });
    expect(isDirty(s)).toBe(true);
  });

  it("ทำสำเนาการ์ด: id ปุ่มใหม่ ปลายทางเดิม", () => {
    const s = run(createInitialState(base), { type: "duplicateStep", stepId: "s1", id: "c1", buttonIds: ["cb1"], at: { x: 0, y: 300 } });
    const copy = s.doc.steps.find((x) => x.id === "c1")!;
    expect(copy.text).toBe("สวัสดี {name}");
    expect(copy.buttons).toEqual([{ id: "cb1", title: "สนใจ", type: "next", nextStepId: "s2" }]);
    expect(stepNumbers(s.doc).get("c1")).toBe(3);
  });

  it("ลบการ์ด: ล้างปุ่มที่ชี้มา และถ้าเป็นข้อความแรก การ์ด เมื่อ… จะไม่ได้เชื่อม", () => {
    const s = run(createInitialState(base), { type: "deleteStep", stepId: "s2" });
    expect(s.doc.steps[0].buttons[0].nextStepId).toBe("");
    expect(s.doc.positions.s2).toBeUndefined();
    const t = run(createInitialState(base), { type: "select", selection: { kind: "step", id: "s1" } }, { type: "deleteStep", stepId: "s1" });
    expect(t.doc.startStepId).toBeNull();
    expect(t.selection).toBeNull();
    expect(findProblems(t.doc).find((p) => p.key === "start")).toMatchObject({ blocking: true, target: { kind: "trigger" } });
  });

  it("เพิ่มการ์ดได้ไม่เกิน 20 ใบ และปุ่มไม่เกิน 3 ปุ่ม", () => {
    let s = createInitialState(base);
    for (let i = 0; i < 25; i++) s = builderReducer(s, { type: "addStep", id: `n${i}`, at: { x: 0, y: 0 } });
    expect(s.doc.steps).toHaveLength(20);
    for (let i = 0; i < 5; i++) s = builderReducer(s, { type: "addButton", stepId: "s1", buttonId: `x${i}` });
    expect(s.doc.steps[0].buttons).toHaveLength(3);
  });
});

describe("เชื่อม / ตัดเส้น", () => {
  it("เชื่อมปุ่มกับการ์ดอื่น แต่เชื่อมกลับการ์ดตัวเองไม่ได้", () => {
    const from = { kind: "button", stepId: "s1", buttonId: "b1" } as const;
    let s = run(createInitialState(base), { type: "addStep", id: "s3", at: { x: 0, y: 0 } }, { type: "connect", from, target: "s3" });
    expect(s.doc.steps[0].buttons[0].nextStepId).toBe("s3");
    s = builderReducer(s, { type: "connect", from, target: "s1" });
    expect(s.doc.steps[0].buttons[0].nextStepId).toBe("s3");
    s = builderReducer(s, { type: "disconnect", from });
    expect(s.doc.steps[0].buttons[0].nextStepId).toBe("");
    expect(edgesOf(s.doc).map((e) => e.key)).toEqual(["trigger"]);
  });

  it("เชื่อมปุ่มเปิดลิงก์ → กลายเป็นปุ่มส่งข้อความต่อ", () => {
    const s = run(createInitialState(base), { type: "connect", from: { kind: "button", stepId: "s2", buttonId: "b2" }, target: "s1" });
    expect(s.doc.steps[1].buttons[0]).toEqual({ id: "b2", title: "ดู", type: "next", nextStepId: "s1" });
  });

  it("การ์ด เมื่อ…: ตัดเส้นแล้วต่อใหม่ไปการ์ดอื่น → การ์ดนั้นกลายเป็น #1 และส่งก่อน", () => {
    let s = run(createInitialState(base), { type: "select", selection: { kind: "edge", from: { kind: "trigger" } } }, { type: "disconnect", from: { kind: "trigger" } });
    expect(s.doc.startStepId).toBeNull();
    expect(s.selection).toBeNull();
    s = builderReducer(s, { type: "connect", from: { kind: "trigger" }, target: "s2" });
    expect(stepNumbers(s.doc).get("s2")).toBe(1);
    expect(orderedSteps(s.doc).map((x) => x.id)).toEqual(["s2", "s1"]);
    expect([...reachableSteps(s.doc)]).toEqual(["s2"]);
    expect(findProblems(s.doc).find((p) => p.key === "lost:s1")).toMatchObject({ blocking: false });
  });

  it("เปลี่ยนชนิดปุ่มเป็นลิงก์ → เส้นหายไป", () => {
    const s = run(createInitialState(base), { type: "updateButton", stepId: "s1", buttonId: "b1", patch: { type: "link" } });
    expect(s.doc.steps[0].buttons[0]).toEqual({ id: "b1", title: "สนใจ", type: "link", url: "" });
    expect(edgesOf(s.doc)).toHaveLength(1);
  });
});

describe("บันทึก", () => {
  it("ข้อความแรกอยู่ลำดับแรก และค่าทุกช่องตรงกับที่ฟอร์มฝั่งเซิร์ฟเวอร์อ่าน", () => {
    const s = run(
      createInitialState(base),
      { type: "addStep", id: "s3", at: { x: 1, y: 2 } },
      { type: "setText", stepId: "s3", text: "เริ่มตรงนี้" },
      { type: "setStart", stepId: "s3" },
      { type: "patch", patch: { publicReplies: ["ตอบ 1", " ", "ตอบ\n2"] } },
    );
    const entries = toFormEntries(s.doc, 7);
    const get = (k: string) => entries.filter(([key]) => key === k).map(([, v]) => v);
    expect(get("id")).toEqual(["7"]);
    expect(get("platforms")).toEqual(["facebook", "instagram"]);
    expect(get("keywords")).toEqual(["สนใจ\nราคา"]);
    expect(get("publicReplies")).toEqual(["ตอบ 1\nตอบ 2"]);
    expect(get("startStepId")).toEqual(["s3"]);
    expect(get("oncePerUser")).toEqual(["on"]);
    expect(get("active")).toEqual(["on"]);
    expect(get("postIds")).toEqual([]);
    expect(JSON.parse(get("steps")[0]).map((x: { id: string }) => x.id)).toEqual(["s3", "s1", "s2"]);
    expect(JSON.parse(get("canvas")[0]).steps.s3).toEqual({ x: 1, y: 2 });

    const values = formDataToValues(toFormData(s.doc, 7));
    expect(values.steps[0].id).toBe("s3");
    expect(validateRule(values).ok).toBe(true);
  });

  it("ปิดใช้งาน / เลือกโพสต์ → ส่งค่าตามนั้น", () => {
    const s = run(createInitialState(base), { type: "patch", patch: { active: false, oncePerUser: false, allPosts: false, postIds: ["p1"], postIdsManual: "p2, p3" } });
    const values = formDataToValues(toFormData(s.doc));
    expect(values.active).toBe(false);
    expect(values.oncePerUser).toBe(false);
    expect(values.postIds).toEqual(["p1", "p2", "p3"]);
    expect(findProblems(s.doc).filter((p) => p.blocking)).toEqual([]);
  });

  it("รวบรวมปัญหาทุกการ์ด พร้อมเลขการ์ดที่ตรงกับที่แสดง", () => {
    const s = run(
      createInitialState({ ...base, name: "", keywords: "" }),
      { type: "setText", stepId: "s1", text: "" },
      { type: "updateButton", stepId: "s2", buttonId: "b2", patch: { url: "shop.com" } },
    );
    const problems = findProblems(s.doc);
    expect(problems.map((p) => p.key)).toEqual(["name", "keywords", "step:s1", "step:s2"]);
    expect(problems[2].message).toContain("ข้อความ #1");
    expect(problems[3].message).toContain("ข้อความ #2");
    expect(problems[3].target).toEqual({ kind: "step", id: "s2" });
  });

  it("markSaved → ไม่มีการแก้ค้าง", () => {
    const s = run(createInitialState(base), { type: "patch", patch: { name: "ใหม่" } });
    expect(isDirty(s)).toBe(true);
    expect(isDirty(builderReducer(s, { type: "markSaved", json: JSON.stringify(s.doc) }))).toBe(false);
  });
});

describe("ย้อนกลับ / ทำซ้ำ", () => {
  it("ย้อนและทำซ้ำได้ทุกการแก้ และรวมการพิมพ์ต่อเนื่องเป็นครั้งเดียว", () => {
    let s = createInitialState(base);
    s = run(
      s,
      { type: "setText", stepId: "s1", text: "a", at: 1000 },
      { type: "setText", stepId: "s1", text: "ab", at: 1300 },
      { type: "setText", stepId: "s1", text: "abc", at: 1600 },
      { type: "setText", stepId: "s1", text: "abcd", at: 5000 },
    );
    expect(s.past).toHaveLength(2);
    s = builderReducer(s, { type: "undo" });
    expect(s.doc.steps[0].text).toBe("abc");
    s = builderReducer(s, { type: "undo" });
    expect(s.doc.steps[0].text).toBe("สวัสดี {name}");
    expect(isDirty(s)).toBe(false);
    s = run(s, { type: "redo" }, { type: "redo" });
    expect(s.doc.steps[0].text).toBe("abcd");
    expect(builderReducer(s, { type: "redo" })).toBe(s);
  });

  it("ลากการ์ดหนึ่งครั้ง = ย้อนกลับครั้งเดียว และการแก้ใหม่ล้างรายการทำซ้ำ", () => {
    let s = run(
      createInitialState(base),
      { type: "move", node: "s1", to: { x: 10, y: 10 }, key: "drag:1", at: 1 },
      { type: "move", node: "s1", to: { x: 20, y: 20 }, key: "drag:1", at: 99999 },
      { type: "move", node: TRIGGER_NODE, to: { x: -5, y: 3 }, key: "drag:2", at: 99999 },
    );
    expect(s.past).toHaveLength(2);
    s = builderReducer(s, { type: "undo" });
    expect(s.doc.triggerPos).toEqual({ x: 0, y: 0 });
    expect(s.doc.positions.s1).toEqual({ x: 20, y: 20 });
    s = builderReducer(s, { type: "patch", patch: { name: "x" } });
    expect(s.future).toEqual([]);
  });

  it("ย้อนการลบการ์ด → การ์ดและเส้นกลับมา", () => {
    const s = run(createInitialState(base), { type: "deleteStep", stepId: "s2" }, { type: "undo" });
    expect(edgesOf(s.doc).map((e) => e.key)).toEqual(["trigger", "s1:b1"]);
  });
});

describe("จัดวางอัตโนมัติ", () => {
  it("จัดใหม่ด้วยขนาดจริงตอนโหลด โดยไม่นับเป็นการแก้ไข", () => {
    const s0 = createInitialState(base);
    const sizes = { s1: { w: 288, h: 300, handles: {} }, s2: { w: 288, h: 100, handles: {} } };
    const s = run(s0, { type: "layout", layout: { trigger: { x: 0, y: 0 }, steps: { s1: { x: 340, y: 0 }, s2: { x: 680, y: 0 } } }, history: false, keepClean: true });
    expect(s.autoPlaced).toBe(false);
    expect(isDirty(s)).toBe(false);
    expect(s.past).toHaveLength(0);
    expect(spotRightOf(s.doc, sizes, { kind: "button", stepId: "s2", buttonId: "b2" }).x).toBe(680 + 288 + 72);
  });

  it("จัดวางจากปุ่ม 'จัดเรียง' ย้อนกลับได้", () => {
    const s = run(
      createInitialState(base),
      { type: "move", node: "s1", to: { x: 999, y: 999 } },
      { type: "layout", layout: { trigger: { x: 0, y: 0 }, steps: { s1: { x: 340, y: 0 } } }, history: true },
      { type: "undo" },
    );
    expect(s.doc.positions.s1).toEqual({ x: 999, y: 999 });
  });
});

describe("เรขาคณิตของแผนผัง", () => {
  it("ซูมรอบจุดใต้เมาส์ และจำกัด 40%–160%", () => {
    const v = zoomAt({ x: 0, y: 0, zoom: 1 }, 2, 100, 100);
    expect(v.zoom).toBe(1.6);
    expect(v.x).toBeCloseTo(100 - 100 * 1.6);
    expect(zoomAt(v, 0.1, 0, 0).zoom).toBe(0.4);
  });

  it("พอดีจอไม่ซูมเกิน 100%", () => {
    expect(fitView({ x: 0, y: 0, w: 100, h: 100 }, 1000, 800).zoom).toBe(1);
    const v = fitView({ x: 0, y: 0, w: 2000, h: 400 }, 1000, 800, { padding: 0 });
    expect(v.zoom).toBe(0.5);
    expect(v.x).toBe(0);
  });

  it("จุดกึ่งกลางของเส้นอยู่ระหว่างต้นทางและปลายทาง", () => {
    const { d, mid } = edgePath(0, 0, 200, 100);
    expect(d.startsWith("M 0 0 C")).toBe(true);
    expect(mid).toEqual({ x: 100, y: 50 });
  });
});
