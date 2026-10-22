"use server";

import { and, eq, ne, not, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { getDb } from "@/db/client";
import { ruleFolders, rules } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { createT } from "@/lib/i18n/core";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { builderMessages } from "@/lib/i18n/messages/builder";
import { rulesMessages } from "@/lib/i18n/messages/rules";
import { getLocale } from "@/lib/i18n/server";
import { cleanFolderName, FOLDER_NAME_MAX, folderHref, inFolder, isFolderId, parseFolderFilter } from "@/lib/rules/folders";
import { movedPriorities } from "@/lib/rules/order";
import { CLOSED_REPLY_MAX } from "@/lib/rules/schedule";
import { nextPostState } from "@/lib/rules/post-scope";
import { formDataToValues, validateRule, type RuleFormState } from "./form-values";

/**
 * ภาษาของคำขอนี้ (คุกกี้ส่งมากับ Server Action) — ใช้กับข้อความ error ที่ส่งกลับไปแสดง
 * เรียกนอกคำขอของ Next (เช่น เทสที่เรียก action ตรงๆ) cookies() ใช้ไม่ได้ → ไทย
 */
async function requestLocale(): Promise<Locale> {
  try {
    return await getLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function saveRule(prev: RuleFormState, formData: FormData): Promise<RuleFormState> {
  await requireAuth();
  const locale = await requestLocale();
  const values = formDataToValues(formData);
  const attempt = (prev.attempt ?? 0) + 1;
  const result = validateRule(values, locale);
  if (!result.ok) return { error: result.error, errorStepId: result.stepId, values, attempt };

  const db = getDb();
  const now = new Date();
  if (values.id) {
    // กฎเดิม: อยู่หน้าเดิมต่อ (หน้าแผนผังแสดง "บันทึกแล้ว" เอง)
    const previous = await db.query.rules.findFirst({
      where: eq(rules.id, values.id),
      columns: { postScope: true, nextPostSince: true, boundPosts: true },
    });
    // กฎถูกลบไปแล้ว (เช่น ลบจากอีกแท็บ/อีกเครื่อง) → บอกตรงๆ แทนที่จะขึ้นว่าบันทึกแล้ว
    const gone = { error: createT(builderMessages, locale)("ruleGone"), values, attempt };
    if (!previous) return gone;
    const scope = nextPostState(previous, result.data.postScope, values.rearmNext === true, now);
    const [saved] = await db
      .update(rules)
      .set({ ...result.data, ...scope, updatedAt: now })
      .where(eq(rules.id, values.id))
      .returning({ nextPostSince: rules.nextPostSince, boundPosts: rules.boundPosts });
    if (!saved) return gone;
    revalidatePath("/rules");
    return {
      values: { ...values, rearmNext: false, nextPostSince: saved.nextPostSince?.toISOString() ?? null, boundPosts: saved.boundPosts ?? {} },
      attempt,
    };
  }
  // กฎใหม่: ไปหน้าแก้ไขของกฎนั้น (มี URL ของตัวเอง แก้ต่อได้ทันที)
  const scope = nextPostState(null, result.data.postScope, false, now);
  // สร้างจากในโฟลเดอร์ → อยู่ในโฟลเดอร์นั้นเลย (โฟลเดอร์ถูกลบไประหว่างนั้น → ไม่อยู่ในโฟลเดอร์ไหน)
  const folderId = await existingFolderId(formData.get("folderId"));
  const [created] = await insertRule({ ...result.data, ...scope, folderId });
  revalidatePath("/rules");
  // แทนที่ /rules/new ในประวัติ → กดย้อนกลับแล้วไม่วนกลับมาหน้ากฎเปล่า
  redirect(`/rules/${created.id}?saved=1`, RedirectType.replace);
}

export async function toggleRule(formData: FormData): Promise<void> {
  await requireAuth();
  const id = Number(formData.get("id"));
  await getDb()
    .update(rules)
    .set({ active: not(rules.active), updatedAt: new Date() })
    .where(eq(rules.id, id));
  revalidatePath("/rules");
}

/** ทำสำเนากฎ (ปิดไว้ก่อน จะได้ไม่ตอบซ้ำกับกฎเดิม) */
export async function duplicateRule(formData: FormData): Promise<void> {
  await requireAuth();
  const id = Number(formData.get("id"));
  const db = getDb();
  const rule = Number.isInteger(id) ? await db.query.rules.findFirst({ where: eq(rules.id, id) }) : undefined;
  if (!rule) return;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ไม่คัดลอก id/วันที่
  const { id: _id, createdAt, updatedAt, ...copy } = rule;
  // สำเนาแบบ "โพสต์ถัดไป" เริ่มรอโพสต์ใหม่ของตัวเอง (ไม่ใช้โพสต์ที่กฎเดิมผูกไว้)
  const scope = nextPostState(null, rule.postScope, true, new Date());
  // ชื่อสำเนาตามภาษาที่ใช้อยู่ตอนกดทำสำเนา (เป็นชื่อกฎที่เจ้าของร้านเห็น แก้ทีหลังได้)
  const name = createT(builderMessages, await requestLocale())("copyName", { rule: rule.name });
  const [created] = await insertRule({ ...copy, ...scope, name: name.slice(0, 100), active: false });
  revalidatePath("/rules");
  redirect(`/rules/${created.id}`);
}

/**
 * ย้ายกฎขึ้น/ลงหนึ่งลำดับในกลุ่มเดียวกัน (คอมเมนต์ / แชท) — ถ้าตรงหลายกฎ ระบบใช้กฎที่อยู่บนกว่า
 * folder = ตัวกรองที่ดูอยู่ (ดูในโฟลเดอร์ → ย้ายเทียบกับกฎที่เห็นในโฟลเดอร์นั้น)
 */
export async function moveRule(formData: FormData): Promise<void> {
  await requireAuth();
  const id = Number(formData.get("id"));
  const dir = formData.get("dir") === "up" ? "up" : "down";
  const filter = parseFolderFilter(String(formData.get("folder") ?? ""));
  const db = getDb();
  await db.transaction(async (tx) => {
    const rule = Number.isInteger(id) ? await tx.query.rules.findFirst({ where: eq(rules.id, id), columns: { trigger: true } }) : undefined;
    if (!rule) return;
    // โฟลเดอร์ที่ดูอยู่ถูกลบไปแล้ว (เช่น จากอีกแท็บ) → แจ้งว่าไม่สำเร็จ แทนที่จะขึ้นว่าย้ายแล้ว
    if (typeof filter === "number" && !(await tx.query.ruleFolders.findFirst({ where: eq(ruleFolders.id, filter), columns: { id: true } }))) {
      throw new Error("folder not found");
    }
    const locked = await tx
      .select({ id: rules.id, priority: rules.priority, folderId: rules.folderId })
      .from(rules)
      .where(eq(rules.trigger, rule.trigger))
      .for("update");
    // เรียงหลังล็อกแล้ว (ORDER BY ใน SELECT … FOR UPDATE เรียงก่อนรอล็อก → ถ้ามีคนย้ายพร้อมกันจะได้ลำดับเก่า)
    const group = locked.sort((a, b) => a.priority - b.priority || a.id - b.id);
    const visible = filter === "all" ? undefined : new Set(group.filter((r) => inFolder(r.folderId, filter)).map((r) => r.id));
    const next = movedPriorities(
      group.map((r) => r.id),
      id,
      dir,
      visible,
    );
    if (!next) return;
    const now = new Date();
    for (const r of next) {
      if (group.find((g) => g.id === r.id)?.priority === r.priority) continue;
      await tx.update(rules).set({ priority: r.priority, updatedAt: now }).where(eq(rules.id, r.id));
    }
  });
  revalidatePath("/rules");
}

/** folder = ตัวกรองที่จะกลับไปหลังลบ (ลบจากในโฟลเดอร์ → กลับไปโฟลเดอร์นั้น) */
export async function deleteRule(formData: FormData): Promise<void> {
  await requireAuth();
  const id = Number(formData.get("id"));
  await getDb().delete(rules).where(eq(rules.id, id));
  revalidatePath("/rules");
  redirect(folderHref(parseFolderFilter(String(formData.get("folder") ?? ""))));
}

// ---------------- โฟลเดอร์ (โปรเจกต์) ----------------

/** ผลของหน้าต่างสร้าง/เปลี่ยนชื่อโฟลเดอร์ — done = เลข attempt ที่สำเร็จ (ใช้ปิดหน้าต่าง) */
export interface FolderFormState {
  error?: string;
  attempt?: number;
  done?: number;
}

/** รหัส error ของ Postgres (drizzle ห่อไว้ใน cause) เช่น 23505 = ซ้ำ, 23503 = อ้างถึงแถวที่ไม่มีแล้ว */
function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.cause?.code ?? e.code;
}

/** เพิ่มกฎ — โฟลเดอร์ถูกลบไประหว่างนั้นพอดี (FK ไม่ผ่าน) → เพิ่มแบบไม่อยู่ในโฟลเดอร์แทน */
async function insertRule(values: typeof rules.$inferInsert): Promise<{ id: number }[]> {
  const db = getDb();
  try {
    return await db.insert(rules).values(values).returning({ id: rules.id });
  } catch (err) {
    if (values.folderId == null || pgCode(err) !== "23503") throw err;
    return db.insert(rules).values({ ...values, folderId: null }).returning({ id: rules.id });
  }
}

/** id โฟลเดอร์ที่มีอยู่จริง (ค่าว่าง / ไม่พบ → null) */
async function existingFolderId(raw: FormDataEntryValue | null): Promise<number | null> {
  const id = Number(raw);
  if (!isFolderId(id)) return null;
  const folder = await getDb().query.ruleFolders.findFirst({ where: eq(ruleFolders.id, id), columns: { id: true } });
  return folder?.id ?? null;
}

/** ตรวจชื่อ: ว่าง/ยาวเกิน หรือซ้ำกับโฟลเดอร์อื่น (ไม่สนตัวพิมพ์เล็ก/ใหญ่) — คืน error หรือชื่อที่ใช้ได้ */
async function checkFolderName(raw: unknown, exceptId: number | null): Promise<{ name: string } | { error: string }> {
  const t = createT(rulesMessages, await requestLocale());
  const name = cleanFolderName(raw);
  if (!name) return { error: t("folderNameInvalid", { max: FOLDER_NAME_MAX }) };
  const sameName = sql`lower(${ruleFolders.name}) = lower(${name})`;
  const taken = await getDb().query.ruleFolders.findFirst({
    where: exceptId ? and(sameName, ne(ruleFolders.id, exceptId)) : sameName,
    columns: { id: true },
  });
  return taken ? { error: t("folderNameTaken") } : { name };
}

/** สร้างโฟลเดอร์ แล้วไปหน้าโฟลเดอร์นั้น — ส่ง ruleId มาด้วย = ย้ายกฎนั้นเข้าโฟลเดอร์ใหม่ทันที */
export async function createFolder(prev: FolderFormState, formData: FormData): Promise<FolderFormState> {
  await requireAuth();
  const attempt = (prev.attempt ?? 0) + 1;
  const checked = await checkFolderName(formData.get("name"), null);
  if ("error" in checked) return { error: checked.error, attempt };
  const db = getDb();
  let created: { id: number };
  try {
    [created] = await db.insert(ruleFolders).values({ name: checked.name }).returning({ id: ruleFolders.id });
  } catch (err) {
    // สร้างชื่อเดียวกันพร้อมกันสองที่ → ฐานข้อมูลกันไว้ (unique lower(name))
    if (pgCode(err) === "23505") return { error: createT(rulesMessages, await requestLocale())("folderNameTaken"), attempt };
    throw err;
  }
  const ruleId = Number(formData.get("ruleId"));
  if (Number.isInteger(ruleId) && ruleId > 0) await db.update(rules).set({ folderId: created.id }).where(eq(rules.id, ruleId));
  revalidatePath("/rules");
  redirect(folderHref(created.id));
}

export async function renameFolder(prev: FolderFormState, formData: FormData): Promise<FolderFormState> {
  await requireAuth();
  const attempt = (prev.attempt ?? 0) + 1;
  const id = await existingFolderId(formData.get("id"));
  // โฟลเดอร์ถูกลบไปแล้ว (เช่น จากอีกแท็บ) → กลับไปหน้ากฎทั้งหมด
  if (!id) redirect("/rules");
  const checked = await checkFolderName(formData.get("name"), id);
  if ("error" in checked) return { error: checked.error, attempt };
  // ตั้งเวลาทั้งโฟลเดอร์ (ส่งมาจากหน้าต่างแก้ไขโฟลเดอร์) — ไม่ส่งมา = ไม่เปลี่ยน
  const schedule = formData.has("endsAt") ? await folderSchedule(formData) : null;
  if (schedule && "error" in schedule) return { error: schedule.error, attempt };
  try {
    await getDb()
      .update(ruleFolders)
      .set({ name: checked.name, ...(schedule ?? {}) })
      .where(eq(ruleFolders.id, id));
  } catch (err) {
    if (pgCode(err) === "23505") return { error: createT(rulesMessages, await requestLocale())("folderNameTaken"), attempt };
    throw err;
  }
  revalidatePath("/rules");
  return { attempt, done: attempt };
}

/** อ่านค่าตั้งเวลาของโฟลเดอร์จากฟอร์ม (ISO ว่าง = ไม่จำกัด) */
async function folderSchedule(
  formData: FormData,
): Promise<{ startsAt: Date | null; endsAt: Date | null; closedReply: string | null } | { error: string }> {
  const t = createT(builderMessages, await requestLocale());
  const date = (key: string) => {
    const raw = String(formData.get(key) ?? "");
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const startsAt = date("startsAt");
  const endsAt = date("endsAt");
  if (startsAt === undefined || endsAt === undefined) return { error: t("scheduleInvalid") };
  if (startsAt && endsAt && endsAt <= startsAt) return { error: t("scheduleEndBeforeStart") };
  const closedReply = String(formData.get("closedReply") ?? "").trim();
  if (closedReply.length > CLOSED_REPLY_MAX) return { error: t("closedReplyTooLong", { max: CLOSED_REPLY_MAX }) };
  return { startsAt, endsAt, closedReply: closedReply || null };
}

/** ลบโฟลเดอร์ — กฎข้างในไม่ถูกลบ (ย้ายไป "ไม่มีโฟลเดอร์" อัตโนมัติด้วย ON DELETE SET NULL) */
export async function deleteFolder(formData: FormData): Promise<void> {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id) && id > 0) await getDb().delete(ruleFolders).where(eq(ruleFolders.id, id));
  revalidatePath("/rules");
  redirect("/rules");
}

/** ย้ายกฎเข้าโฟลเดอร์ (folder = id) หรือเอาออกจากโฟลเดอร์ (folder = "none") — ไม่เปลี่ยนลำดับหรือการตอบ */
export async function setRuleFolder(formData: FormData): Promise<void> {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  const raw = formData.get("folder");
  const folderId = raw === "none" ? null : await existingFolderId(raw);
  // โฟลเดอร์ถูกลบไประหว่างนั้น → ไม่ย้าย (ไม่เอากฎออกจากโฟลเดอร์เดิมโดยไม่ได้ตั้งใจ)
  if (raw !== "none" && folderId === null) throw new Error("folder not found");
  await getDb().update(rules).set({ folderId }).where(eq(rules.id, id));
  revalidatePath("/rules");
}
