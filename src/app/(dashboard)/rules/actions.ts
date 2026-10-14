"use server";

import { asc, eq, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { getDb } from "@/db/client";
import { rules } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { createT } from "@/lib/i18n/core";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { builderMessages } from "@/lib/i18n/messages/builder";
import { getLocale } from "@/lib/i18n/server";
import { movedPriorities } from "@/lib/rules/order";
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
  const [created] = await db
    .insert(rules)
    .values({ ...result.data, ...scope })
    .returning({ id: rules.id });
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
  const [created] = await db
    .insert(rules)
    .values({ ...copy, ...scope, name: name.slice(0, 100), active: false })
    .returning({ id: rules.id });
  revalidatePath("/rules");
  redirect(`/rules/${created.id}`);
}

/** ย้ายกฎขึ้น/ลงหนึ่งลำดับในกลุ่มเดียวกัน (คอมเมนต์ / แชท) — ถ้าตรงหลายกฎ ระบบใช้กฎที่อยู่บนกว่า */
export async function moveRule(formData: FormData): Promise<void> {
  await requireAuth();
  const id = Number(formData.get("id"));
  const dir = formData.get("dir") === "up" ? "up" : "down";
  const db = getDb();
  await db.transaction(async (tx) => {
    const rule = Number.isInteger(id) ? await tx.query.rules.findFirst({ where: eq(rules.id, id), columns: { trigger: true } }) : undefined;
    if (!rule) return;
    const group = await tx
      .select({ id: rules.id, priority: rules.priority })
      .from(rules)
      .where(eq(rules.trigger, rule.trigger))
      .orderBy(asc(rules.priority), asc(rules.id))
      .for("update");
    const next = movedPriorities(
      group.map((r) => r.id),
      id,
      dir,
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

export async function deleteRule(formData: FormData): Promise<void> {
  await requireAuth();
  const id = Number(formData.get("id"));
  await getDb().delete(rules).where(eq(rules.id, id));
  revalidatePath("/rules");
  redirect("/rules");
}
