import { describe, expect, it } from "vitest";
import { nextPostState, postScopeMatches } from "@/lib/rules/post-scope";
import { formDataToValues, validateRule } from "@/app/(dashboard)/rules/form-values";

const T0 = new Date("2026-10-01T00:00:00Z");
const NOW = new Date("2026-10-10T00:00:00Z");
const bound = { facebook: { id: "1_555", boundAt: "2026-10-02T00:00:00Z" } };

describe("nextPostState", () => {
  it("เปลี่ยนมาใช้ 'โพสต์ถัดไป' หรือกฎใหม่ → เริ่มรอตั้งแต่ตอนนี้", () => {
    expect(nextPostState(null, "next", false, NOW)).toEqual({ nextPostSince: NOW, boundPosts: {} });
    expect(nextPostState({ postScope: "any", nextPostSince: null, boundPosts: {} }, "next", false, NOW)).toEqual({ nextPostSince: NOW, boundPosts: {} });
  });

  it("บันทึกซ้ำโดยไม่ได้เปลี่ยน → คงเวลาเริ่มรอและโพสต์ที่ผูกไว้ ยกเว้นกดเริ่มรอใหม่", () => {
    const prev = { postScope: "next" as const, nextPostSince: T0, boundPosts: bound };
    // {} = ไม่เขียนทับค่าในฐานข้อมูล (worker อาจเพิ่งผูกโพสต์ไประหว่างนั้น)
    expect(nextPostState(prev, "next", false, NOW)).toEqual({});
    expect(nextPostState(prev, "next", true, NOW)).toEqual({ nextPostSince: NOW, boundPosts: {} });
  });

  it("เปลี่ยนเป็นแบบอื่น → ล้างทิ้ง", () => {
    expect(nextPostState({ postScope: "next", nextPostSince: T0, boundPosts: bound }, "any", false, NOW)).toEqual({ nextPostSince: null, boundPosts: {} });
  });
});

describe("postScopeMatches", () => {
  const base = { postIds: [] as string[], boundPosts: {} };
  it("ทุกโพสต์ / เฉพาะที่เลือก", () => {
    expect(postScopeMatches({ ...base, postScope: "any" }, "instagram", "M1")).toBe(true);
    expect(postScopeMatches({ ...base, postScope: "specific", postIds: ["555"] }, "facebook", "1_555")).toBe(true);
    expect(postScopeMatches({ ...base, postScope: "specific", postIds: ["555"] }, "facebook", "1_666")).toBe(false);
    expect(postScopeMatches({ ...base, postScope: "specific" }, "facebook", "1_666")).toBe(false);
  });

  it("โพสต์ถัดไป: ผูกแล้วใช้เฉพาะโพสต์นั้นของแพลตฟอร์มนั้น ยังไม่ผูกต้องเช็คกับ Meta", () => {
    const rule = { ...base, postScope: "next" as const, boundPosts: bound };
    expect(postScopeMatches(rule, "facebook", "1_555")).toBe(true);
    expect(postScopeMatches(rule, "facebook", "1_777")).toBe(false);
    expect(postScopeMatches(rule, "instagram", "M9")).toBe("resolve");
    expect(postScopeMatches(rule, "instagram", null)).toBe(false);
  });
});

describe("ฟอร์ม: ใช้กับโพสต์ไหน", () => {
  function form(fields: Record<string, string>, postIds: string[] = []): FormData {
    const data = new FormData();
    data.set("name", "x");
    data.set("trigger", "comment");
    data.append("platforms", "instagram");
    data.set("matchType", "any");
    data.set("steps", JSON.stringify([{ id: "s1", text: "hi", buttons: [] }]));
    for (const id of postIds) data.append("postIds", id);
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    return data;
  }

  it("อ่าน postScope และ rearmNext, ฟอร์มเก่าเดาจาก postIds", () => {
    expect(formDataToValues(form({ postScope: "next", rearmNext: "1" }))).toMatchObject({ postScope: "next", rearmNext: true });
    expect(formDataToValues(form({}, ["p1"])).postScope).toBe("specific");
    expect(formDataToValues(form({})).postScope).toBe("any");
    expect(formDataToValues(form({ postScope: "weird" })).postScope).toBe("any");
  });

  it("เฉพาะที่เลือกต้องมีอย่างน้อย 1 โพสต์ และแบบอื่นไม่เก็บ postIds", () => {
    expect(validateRule(formDataToValues(form({ postScope: "specific" })))).toMatchObject({ ok: false });
    const next = validateRule(formDataToValues(form({ postScope: "next" }, ["p1"])));
    expect(next.ok && next.data).toMatchObject({ postScope: "next", postIds: [] });
    const dm = validateRule(formDataToValues(form({ postScope: "next", trigger: "dm" })));
    expect(dm.ok && dm.data.postScope).toBe("any");
  });

  it("ID ที่เป็นลิงก์หรือยาวเกิน → แจ้งเป็นภาษาไทย", () => {
    const link = validateRule(formDataToValues(form({ postScope: "specific", postIdsManual: "https://www.instagram.com/reel/C8xYz12AbCd/" })));
    expect(link).toMatchObject({ ok: false, error: expect.stringContaining("ไม่ใช่ลิงก์") });
    const long = validateRule(formDataToValues(form({ postScope: "specific" }, ["1".repeat(101)])));
    expect(long).toMatchObject({ ok: false, error: "ID โพสต์ยาวเกินไป" });
    const ok = validateRule(formDataToValues(form({ postScope: "specific", postIdsManual: "123_456\n17912345678901234" })));
    expect(ok.ok && ok.data.postIds).toEqual(["123_456", "17912345678901234"]);
  });
});
