import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { rules } from "@/db/schema";
import { createRule, resetDatabase } from "./helpers";

// server action เรียก requireAuth / revalidatePath ซึ่งต้องมี request ของ Next → แทนด้วยของปลอม
vi.mock("@/lib/auth", () => ({ requireAuth: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { saveRule } = await import("@/app/(dashboard)/rules/actions");

let db: Db;
beforeEach(async () => {
  db = await resetDatabase();
});

function form(id: number, fields: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("id", String(id));
  data.set("name", "แก้แล้ว");
  data.set("trigger", "comment");
  data.append("platforms", "facebook");
  data.set("matchType", "contains");
  data.set("keywords", "สนใจ");
  data.set("steps", JSON.stringify([{ id: "s1", text: "สวัสดี", buttons: [] }]));
  data.set("active", "on");
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

describe("saveRule", () => {
  it("กฎถูกลบไปแล้ว → แจ้ง error แทนที่จะขึ้นว่าบันทึกแล้ว", async () => {
    const rule = await createRule();
    await db.delete(rules).where(eq(rules.id, rule.id));
    const state = await saveRule({}, form(rule.id));
    expect(state.error).toContain("ไม่พบกฎนี้แล้ว");
    expect(await db.query.rules.findMany()).toHaveLength(0);
  });

  it("แก้กฎ 'โพสต์ถัดไป' ที่ผูกโพสต์แล้ว → คงโพสต์ที่ผูกไว้ และส่งค่าล่าสุดจากฐานข้อมูลกลับมาแสดง", async () => {
    const since = new Date("2026-10-01T00:00:00Z");
    const bound = { facebook: { id: "PAGE1_NEW", boundAt: "2026-10-02T00:00:00.000Z" } };
    const rule = await createRule({ postScope: "next", nextPostSince: since, boundPosts: bound });
    const state = await saveRule({}, form(rule.id, { postScope: "next" }));
    expect(state.error).toBeUndefined();
    expect(state.values).toMatchObject({ name: "แก้แล้ว", boundPosts: bound, nextPostSince: since.toISOString() });
    const row = await db.query.rules.findFirst({ where: eq(rules.id, rule.id) });
    expect(row).toMatchObject({ name: "แก้แล้ว", boundPosts: bound, nextPostSince: since });
  });
});

describe("moveRule", () => {
  it("ย้ายขึ้น/ลงในกลุ่มเดียวกัน และเรียงเลขใหม่ไม่ให้ซ้ำ (กฎแชทไม่เกี่ยว)", async () => {
    const { moveRule } = await import("@/app/(dashboard)/rules/actions");
    const a = await createRule({ name: "A", priority: 100 });
    const b = await createRule({ name: "B", priority: 100 });
    const c = await createRule({ name: "C", priority: 900 });
    const dm = await createRule({ name: "DM", trigger: "dm", priority: 50 });
    const order = async () =>
      (await db.query.rules.findMany({ where: eq(rules.trigger, "comment"), orderBy: (r, { asc }) => [asc(r.priority), asc(r.id)] })).map((r) => r.name);

    const move = (id: number, dir: "up" | "down") => {
      const data = new FormData();
      data.set("id", String(id));
      data.set("dir", dir);
      return moveRule(data);
    };
    await move(c.id, "up");
    expect(await order()).toEqual(["A", "C", "B"]);
    await move(b.id, "down"); // ล่างสุดแล้ว → ไม่เปลี่ยน
    await move(a.id, "down");
    expect(await order()).toEqual(["C", "A", "B"]);
    const prios = (await db.query.rules.findMany({ where: eq(rules.trigger, "comment") })).map((r) => r.priority).sort((x, y) => x - y);
    expect(new Set(prios).size).toBe(3);
    expect((await db.query.rules.findFirst({ where: eq(rules.id, dm.id) }))!.priority).toBe(50);
  });
});
