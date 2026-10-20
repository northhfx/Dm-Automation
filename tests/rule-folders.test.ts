import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { readFileSync } from "node:fs";
import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { ruleFolders, rules } from "@/db/schema";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";
import { inFolder, parseFolderFilter } from "@/lib/rules/folders";
import { movedPriorities } from "@/lib/rules/order";
import { createRule, resetDatabase } from "./helpers";

/*
 * โฟลเดอร์ (โปรเจกต์) ของกฎ: สร้าง / เปลี่ยนชื่อ / ลบ (กฎไม่หาย) / ย้ายกฎเข้า-ออก / ย้ายลำดับในโฟลเดอร์
 * และหน้า /rules กรองตามโฟลเดอร์ได้ทั้งสองภาษา
 */

const lang = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "lang" && lang.value ? { name, value: lang.value } : undefined) }),
}));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => {} }));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));

const actions = await import("@/app/(dashboard)/rules/actions");
const { default: RulesPage } = await import("@/app/(dashboard)/rules/page");

let db: Db;
beforeEach(async () => {
  db = await resetDatabase();
  lang.value = undefined;
});

const fd = (fields: Record<string, string | number>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, String(v));
  return data;
};

/** Server Action ที่ redirect() → คืนปลายทาง (Next โยน error ที่มี digest "NEXT_REDIRECT;…;<url>;…") */
async function redirectOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (err) {
    const digest = (err as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2];
    throw err;
  }
  throw new Error("ไม่ได้ redirect");
}

const folderOf = async (id: number) => (await db.query.rules.findFirst({ where: eq(rules.id, id), columns: { folderId: true } }))?.folderId;

describe("ตัวช่วย", () => {
  it("อ่านตัวกรองจาก URL", () => {
    expect(parseFolderFilter(undefined)).toBe("all");
    expect(parseFolderFilter("none")).toBe("none");
    expect(parseFolderFilter("3")).toBe(3);
    expect(parseFolderFilter(["4", "5"])).toBe(4);
    expect(parseFolderFilter("abc")).toBe("all");
    expect(parseFolderFilter("-1")).toBe("all");
    // เกินขนาดคอลัมน์ integer (URL ที่พิมพ์เอง) → ไม่ให้ query พัง
    expect(parseFolderFilter("3000000000")).toBe("all");
    expect(inFolder(null, "none")).toBe(true);
    expect(inFolder(2, "none")).toBe(false);
    expect(inFolder(2, 2)).toBe(true);
    expect(inFolder(null, "all")).toBe(true);
  });

  it("ย้ายในโฟลเดอร์: ข้ามกฎที่ซ่อนอยู่ ส่วนกฎอื่นคงลำดับเดิมเทียบกันเอง", () => {
    // ลำดับ A(1) B(2) C(3) D(4) — ดูโฟลเดอร์ที่มี A กับ C
    const ids = (r: ReturnType<typeof movedPriorities>) => r?.map((x) => x.id);
    expect(ids(movedPriorities([1, 2, 3, 4], 3, "up", new Set([1, 3])))).toEqual([3, 1, 2, 4]);
    expect(ids(movedPriorities([1, 2, 3, 4], 1, "down", new Set([1, 3])))).toEqual([2, 3, 1, 4]);
    expect(movedPriorities([1, 2, 3, 4], 1, "up", new Set([1, 3]))).toBeNull();
    // ไม่กรอง = แบบเดิม (สลับกับตัวข้างๆ)
    expect(ids(movedPriorities([1, 2, 3], 2, "up"))).toEqual([2, 1, 3]);
  });
});

describe("สร้าง / เปลี่ยนชื่อ / ลบโฟลเดอร์", () => {
  it("สร้างแล้วไปหน้าโฟลเดอร์นั้น · ชื่อว่าง/ซ้ำ (ไม่สนตัวพิมพ์) ไม่ผ่าน", async () => {
    expect(await redirectOf(() => actions.createFolder({}, fd({ name: "  Simplify   course " })))).toMatch(/^\/rules\?folder=\d+$/);
    const [folder] = await db.select().from(ruleFolders);
    expect(folder.name).toBe("Simplify course");

    expect((await actions.createFolder({}, fd({ name: "SIMPLIFY COURSE" }))).error).toBe("มีโฟลเดอร์ชื่อนี้แล้ว");
    expect((await actions.createFolder({}, fd({ name: "   " }))).error).toContain("ใส่ชื่อโฟลเดอร์");
    expect((await actions.createFolder({}, fd({ name: "x".repeat(61) }))).error).toContain("60");
    expect(await db.select().from(ruleFolders)).toHaveLength(1);
  });

  it("สร้างจากเมนูของกฎ → ย้ายกฎนั้นเข้าโฟลเดอร์ใหม่ทันที", async () => {
    const rule = await createRule();
    const to = await redirectOf(() => actions.createFolder({}, fd({ name: "Promo", ruleId: rule.id })));
    expect(to).toBe(`/rules?folder=${await folderOf(rule.id)}`);
  });

  it("เปลี่ยนชื่อ (ชื่อเดิมของตัวเองไม่นับว่าซ้ำ) · ซ้ำกับโฟลเดอร์อื่นไม่ผ่าน", async () => {
    const [a, b] = await db.insert(ruleFolders).values([{ name: "A" }, { name: "B" }]).returning();
    expect(await actions.renameFolder({}, fd({ id: a.id, name: "a" }))).toMatchObject({ done: 1 });
    expect((await actions.renameFolder({}, fd({ id: a.id, name: "b" }))).error).toBe("มีโฟลเดอร์ชื่อนี้แล้ว");
    const names = (await db.select().from(ruleFolders).orderBy(asc(ruleFolders.id))).map((f) => f.name);
    expect(names).toEqual(["a", "B"]);
    expect(b.name).toBe("B");
  });

  it("ภาษาอังกฤษ: ข้อความ error เป็นภาษาอังกฤษ", async () => {
    lang.value = "en";
    await db.insert(ruleFolders).values({ name: "Promo" });
    expect((await actions.createFolder({}, fd({ name: "promo" }))).error).toBe("A folder with this name already exists");
  });

  it("ลบโฟลเดอร์: กฎข้างในยังอยู่ (ไม่อยู่ในโฟลเดอร์ไหนแล้ว) และยังเปิดอยู่", async () => {
    const [folder] = await db.insert(ruleFolders).values({ name: "Old" }).returning();
    const rule = await createRule({ folderId: folder.id });
    expect(await redirectOf(() => actions.deleteFolder(fd({ id: folder.id })))).toBe("/rules");
    const row = await db.query.rules.findFirst({ where: eq(rules.id, rule.id) });
    expect(row).toMatchObject({ folderId: null, active: true });
  });
});

describe("กันกรณีทำพร้อมกัน / ข้อมูลเก่า", () => {
  it("สร้างชื่อเดียวกันพร้อมกันสองที่ → ได้โฟลเดอร์เดียว อีกที่ขึ้นว่าชื่อซ้ำ", async () => {
    const results = await Promise.allSettled([
      actions.createFolder({}, fd({ name: "Promo" })),
      actions.createFolder({}, fd({ name: "promo" })),
    ]);
    expect(await db.select().from(ruleFolders)).toHaveLength(1);
    const errors = results.flatMap((r) => (r.status === "fulfilled" && r.value.error ? [r.value.error] : []));
    expect(errors).toEqual(["มีโฟลเดอร์ชื่อนี้แล้ว"]);
  });

  it("ย้ายพร้อมกันสองกฎ → ไม่ทับกัน (ผลเหมือนทำทีละอัน)", async () => {
    const [a, b, c, d] = [await createRule({ name: "A", priority: 10 }), await createRule({ name: "B", priority: 20 }), await createRule({ name: "C", priority: 30 }), await createRule({ name: "D", priority: 40 })];
    await Promise.all([actions.moveRule(fd({ id: d.id, dir: "up" })), actions.moveRule(fd({ id: a.id, dir: "down" }))]);
    const order = (await db.select({ id: rules.id }).from(rules).orderBy(asc(rules.priority), asc(rules.id))).map((r) => r.id);
    expect(order).toEqual([b.id, a.id, d.id, c.id]);
  });

  it("ย้ายลำดับจากโฟลเดอร์ที่ถูกลบไปแล้ว (แท็บเก่า) → แจ้งไม่สำเร็จ ไม่ขึ้นว่าย้ายแล้ว", async () => {
    const [folder] = await db.insert(ruleFolders).values({ name: "Gone" }).returning();
    await createRule({ name: "A", priority: 10, folderId: folder.id });
    const c = await createRule({ name: "C", priority: 30, folderId: folder.id });
    await db.delete(ruleFolders).where(eq(ruleFolders.id, folder.id));
    await expect(actions.moveRule(fd({ id: c.id, dir: "up", folder: folder.id }))).rejects.toThrow();
  });

  it("id เกินขนาด integer ไม่ทำให้ฐานข้อมูล error", async () => {
    const rule = await createRule();
    await expect(actions.setRuleFolder(fd({ id: rule.id, folder: "3000000000" }))).rejects.toThrow("folder not found");
    const { default: NewRulePage } = await import("@/app/(dashboard)/rules/new/page");
    await expect(NewRulePage({ searchParams: Promise.resolve({ folder: "3000000000" }) } as never)).resolves.toBeTruthy();
  });

  it("migration: ชื่อซ้ำที่มีอยู่ก่อนถูกต่อท้ายด้วย id แล้วจึงสร้าง unique index ได้", async () => {
    const file = readFileSync("drizzle/0014_rule_folders_unique_name.sql", "utf8");
    const [dedupe, createIndex] = file.split("--> statement-breakpoint");
    await db.execute(sql`DROP INDEX rule_folders_name_idx`);
    await db.insert(ruleFolders).values([{ name: "Promo" }, { name: "PROMO" }, { name: "Other" }]);
    await db.execute(sql.raw(dedupe));
    await db.execute(sql.raw(createIndex));
    const names = (await db.select().from(ruleFolders).orderBy(asc(ruleFolders.id))).map((f) => f.name);
    expect(names).toEqual(["Promo", "PROMO (2)", "Other"]);
  });
});

describe("ย้ายกฎเข้า/ออกโฟลเดอร์", () => {
  it("ย้ายเข้า · เอาออก · โฟลเดอร์ที่ไม่มีแล้วไม่ย้าย (กฎอยู่ที่เดิม)", async () => {
    const [folder] = await db.insert(ruleFolders).values({ name: "P" }).returning();
    const rule = await createRule();
    await actions.setRuleFolder(fd({ id: rule.id, folder: folder.id }));
    expect(await folderOf(rule.id)).toBe(folder.id);
    await expect(actions.setRuleFolder(fd({ id: rule.id, folder: 999 }))).rejects.toThrow();
    expect(await folderOf(rule.id)).toBe(folder.id);
    await actions.setRuleFolder(fd({ id: rule.id, folder: "none" }));
    expect(await folderOf(rule.id)).toBeNull();
  });

  it("กฎใหม่ที่สร้างจากในโฟลเดอร์อยู่ในโฟลเดอร์นั้น · ทำสำเนาแล้วอยู่โฟลเดอร์เดิม", async () => {
    const [folder] = await db.insert(ruleFolders).values({ name: "P" }).returning();
    const data = fd({
      name: "In folder",
      trigger: "comment",
      platforms: "facebook",
      matchType: "contains",
      keywords: "price",
      steps: JSON.stringify([{ id: "s1", text: "Hi", buttons: [] }]),
      active: "on",
      folderId: folder.id,
    });
    const to = await redirectOf(() => actions.saveRule({}, data));
    const id = Number(to.match(/\/rules\/(\d+)/)?.[1]);
    expect(await folderOf(id)).toBe(folder.id);

    const copyTo = await redirectOf(() => actions.duplicateRule(fd({ id })));
    expect(await folderOf(Number(copyTo.match(/\/rules\/(\d+)/)?.[1]))).toBe(folder.id);
  });

  it("ย้ายขึ้นในโฟลเดอร์ ข้ามกฎของโฟลเดอร์อื่น · ลบจากในโฟลเดอร์แล้วกลับไปโฟลเดอร์นั้น", async () => {
    const [f1, f2] = await db.insert(ruleFolders).values([{ name: "F1" }, { name: "F2" }]).returning();
    const a = await createRule({ name: "A", priority: 10, folderId: f1.id });
    const b = await createRule({ name: "B", priority: 20, folderId: f2.id });
    const c = await createRule({ name: "C", priority: 30, folderId: f1.id });
    await actions.moveRule(fd({ id: c.id, dir: "up", folder: f1.id }));
    const order = (await db.select({ id: rules.id }).from(rules).orderBy(asc(rules.priority), asc(rules.id))).map((r) => r.id);
    expect(order).toEqual([c.id, a.id, b.id]);

    expect(await redirectOf(() => actions.deleteRule(fd({ id: a.id, folder: f1.id })))).toBe(`/rules?folder=${f1.id}`);
    expect(await redirectOf(() => actions.deleteRule(fd({ id: b.id })))).toBe("/rules");
  });
});

// ---------- หน้า /rules ----------

const ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };

function render(el: ReactElement, locale?: Locale): string {
  const inner = locale ? createElement(I18nProvider, { locale } as ComponentProps<typeof I18nProvider>, el) : el;
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, inner));
}
const textOf = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const THAI = /[฀-๿]/;

async function page(folder: string | undefined, locale?: Locale) {
  lang.value = locale;
  return render(await RulesPage({ searchParams: Promise.resolve(folder ? { folder } : {}) } as never), locale);
}

describe("หน้า /rules กรองตามโฟลเดอร์", () => {
  it("แถบโฟลเดอร์ + ดูในโฟลเดอร์เห็นเฉพาะกฎของโฟลเดอร์นั้น (ภาษาอังกฤษไม่มีไทยหลง)", async () => {
    const [course, free] = await db.insert(ruleFolders).values([{ name: "Course" }, { name: "Free guide" }]).returning();
    await createRule({ name: "Course price", keywords: ["price"], publicReplies: ["Sent"], steps: [{ id: "s1", text: "Hi", buttons: [] }], folderId: course.id });
    await createRule({ name: "Guide link", keywords: ["guide"], publicReplies: ["Sent"], steps: [{ id: "s1", text: "Hi", buttons: [] }], folderId: free.id });
    await createRule({ name: "Loose one", keywords: ["hi"], publicReplies: ["Sent"], steps: [{ id: "s1", text: "Hi", buttons: [] }] });

    const all = await page(undefined, "en");
    const allText = textOf(all);
    for (const s of ["All", "Course", "Free guide", "No folder", "New folder", "Course price", "Guide link", "Loose one"]) expect(allText).toContain(s);
    // ดูทั้งหมด: การ์ดบอกว่าอยู่โฟลเดอร์ไหน (ลิงก์ไปโฟลเดอร์นั้น)
    expect(all).toContain(`href="/rules?folder=${course.id}"`);
    expect(allText).not.toMatch(THAI);

    const inCourse = textOf(await page(String(course.id), "en"));
    expect(inCourse).toContain("Course price");
    expect(inCourse).not.toContain("Guide link");
    expect(inCourse).not.toContain("Loose one");
    expect(inCourse).toContain("Numbers count across all folders");

    const loose = textOf(await page("none", "en"));
    expect(loose).toContain("Loose one");
    expect(loose).not.toContain("Course price");

    // โฟลเดอร์ที่ไม่มีแล้ว (ลิงก์เก่า) → ทั้งหมด
    expect(textOf(await page("9999", "en"))).toContain("Guide link");
  });

  it("โฟลเดอร์ว่าง: บอกให้สร้างกฎในโฟลเดอร์นี้ (ไทย)", async () => {
    const [empty] = await db.insert(ruleFolders).values({ name: "ว่าง" }).returning();
    await createRule({ name: "อื่น" });
    const text = textOf(await page(String(empty.id)));
    expect(text).toContain("ยังไม่มีกฎในโฟลเดอร์นี้");
    expect(text).toContain("สร้างกฎในโฟลเดอร์นี้");
    expect(text).not.toContain("อื่น");
  });

  it("มีโฟลเดอร์แต่ยังไม่มีกฎเลย (ดูทั้งหมด): หน้าเริ่มต้นปกติ ไม่ใช่ 'โฟลเดอร์นี้ว่าง'", async () => {
    await db.insert(ruleFolders).values({ name: "ว่าง" });
    const text = textOf(await page(undefined));
    expect(text).not.toContain("ยังไม่มีกฎในโฟลเดอร์นี้");
    expect(text).not.toContain("สร้างกฎในโฟลเดอร์นี้");
    expect(text).toContain("ว่าง"); // แถบโฟลเดอร์ยังอยู่ (เปลี่ยนชื่อ/ลบได้)
  });

  it("ยังไม่มีโฟลเดอร์: ไม่มีแถบโฟลเดอร์ (มีแค่ปุ่มโฟลเดอร์ใหม่)", async () => {
    await createRule({ name: "เดี่ยว" });
    const html = await page(undefined);
    expect(textOf(html)).toContain("โฟลเดอร์ใหม่");
    expect(html).not.toContain('aria-label="โฟลเดอร์"');
  });
});
