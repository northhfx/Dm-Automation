import { describe, expect, it } from "vitest";
import { findMatchingRule, postIdMatches, textMatches, type MatchableRule } from "@/lib/rules/match";
import { renderTemplate } from "@/lib/rules/template";
import { flowPayload, parseFlowPayload } from "@/lib/flows/types";

function rule(overrides: Partial<MatchableRule>): MatchableRule {
  return {
    id: 1,
    active: true,
    trigger: "comment",
    platforms: ["facebook", "instagram"],
    matchType: "contains",
    keywords: ["สนใจ"],
    postIds: [],
    priority: 100,
    ...overrides,
  };
}

describe("textMatches", () => {
  it("หา keyword ภาษาไทยที่อยู่กลางประโยคได้", () => {
    expect(textMatches("contains", ["สนใจ"], "สนใจค่ะ ราคาเท่าไหร่")).toBe(true);
    expect(textMatches("contains", ["สนใจ"], "ขอราคาหน่อย")).toBe(false);
  });

  it("ไม่สนตัวพิมพ์เล็ก/ใหญ่และช่องว่าง", () => {
    expect(textMatches("contains", ["  Price "], "what's the PRICE?")).toBe(true);
  });

  it("โหมดตรงทั้งข้อความ ยอมให้มีเครื่องหมาย/อีโมจิท้ายข้อความ", () => {
    expect(textMatches("exact", ["สนใจ"], "สนใจ!!")).toBe(true);
    expect(textMatches("exact", ["สนใจ"], "สนใจ 🙏")).toBe(true);
    expect(textMatches("exact", ["สนใจ"], "ไม่สนใจ")).toBe(false);
  });

  it("โหมด any ตรงกับทุกข้อความ แต่ keyword ว่างในโหมดอื่นไม่ตรงอะไรเลย", () => {
    expect(textMatches("any", [], "อะไรก็ได้")).toBe(true);
    expect(textMatches("contains", [], "อะไรก็ได้")).toBe(false);
  });
});

describe("postIdMatches", () => {
  it("รับได้ทั้ง id เต็มของ Facebook และ id ส่วนท้าย", () => {
    expect(postIdMatches([], "123_456")).toBe(true);
    expect(postIdMatches(["123_456"], "123_456")).toBe(true);
    expect(postIdMatches(["456"], "123_456")).toBe(true);
    expect(postIdMatches(["789"], "123_456")).toBe(false);
    expect(postIdMatches(["789"], null)).toBe(false);
  });
});

describe("findMatchingRule", () => {
  it("เลือกกฎตาม priority และข้ามกฎที่ปิดอยู่หรือคนละแพลตฟอร์ม", () => {
    const rules = [
      rule({ id: 1, priority: 50, active: false }),
      rule({ id: 2, priority: 10, platforms: ["instagram"] }),
      rule({ id: 3, priority: 20 }),
      rule({ id: 4, priority: 30 }),
    ];
    expect(findMatchingRule(rules, { trigger: "comment", platform: "facebook", text: "สนใจ" })?.id).toBe(3);
    expect(findMatchingRule(rules, { trigger: "comment", platform: "instagram", text: "สนใจ" })?.id).toBe(2);
  });

  it("กฎแบบคอมเมนต์ไม่ทำงานกับ DM และกรองตามโพสต์", () => {
    const rules = [rule({ id: 1, postIds: ["999"] })];
    expect(findMatchingRule(rules, { trigger: "dm", platform: "facebook", text: "สนใจ" })).toBeNull();
    expect(findMatchingRule(rules, { trigger: "comment", platform: "facebook", text: "สนใจ", postId: "1_999" })?.id).toBe(1);
    expect(findMatchingRule(rules, { trigger: "comment", platform: "facebook", text: "สนใจ", postId: "1_111" })).toBeNull();
  });
});

describe("renderTemplate", () => {
  it("แทนชื่อ และใช้ชื่อสำรองถ้าไม่รู้ชื่อ", () => {
    expect(renderTemplate("สวัสดี {name}", { name: "Mint" })).toBe("สวัสดี Mint");
    expect(renderTemplate("สวัสดี {name}", { name: null })).toBe("สวัสดี คุณลูกค้า");
  });

  it("ลบ {link} แบบเก่าทิ้ง (ลิงก์ใส่เป็นปุ่มแทน)", () => {
    expect(renderTemplate("ดูที่นี่ {link}", { name: "Mint" })).toBe("ดูที่นี่");
  });
});

describe("flow payload", () => {
  it("เข้ารหัส/ถอดรหัสปุ่มได้ และไม่รับ payload แปลกๆ", () => {
    const payload = flowPayload(12, "step_a", "btn-1");
    expect(payload).toBe("flow:12:step_a:btn-1");
    expect(parseFlowPayload(payload)).toEqual({ ruleId: 12, stepId: "step_a", buttonId: "btn-1" });
    expect(parseFlowPayload("flow:12:step_a")).toBeNull();
    expect(parseFlowPayload("GET_STARTED")).toBeNull();
    expect(parseFlowPayload(null)).toBeNull();
  });
});
