"use server";

import { eq, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { rules } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { nextPostState } from "@/lib/rules/post-scope";
import { formDataToValues, validateRule, type RuleFormState } from "./form-values";

export async function saveRule(prev: RuleFormState, formData: FormData): Promise<RuleFormState> {
  await requireAuth();
  const values = formDataToValues(formData);
  const attempt = (prev.attempt ?? 0) + 1;
  const result = validateRule(values);
  if (!result.ok) return { error: result.error, errorStepId: result.stepId, values, attempt };

  const db = getDb();
  const now = new Date();
  if (values.id) {
    // กฎเดิม: อยู่หน้าเดิมต่อ (หน้าแผนผังแสดง "บันทึกแล้ว" เอง)
    const previous = await db.query.rules.findFirst({
      where: eq(rules.id, values.id),
      columns: { postScope: true, nextPostSince: true, boundPosts: true },
    });
    const scope = nextPostState(previous ?? null, result.data.postScope, values.rearmNext === true, now);
    await db
      .update(rules)
      .set({ ...result.data, ...scope, updatedAt: now })
      .where(eq(rules.id, values.id));
    revalidatePath("/rules");
    return {
      values: { ...values, rearmNext: false, nextPostSince: scope.nextPostSince?.toISOString() ?? null, boundPosts: scope.boundPosts },
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
  redirect(`/rules/${created.id}?saved=1`);
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
  const [created] = await db
    .insert(rules)
    .values({ ...copy, ...scope, name: `${rule.name} (สำเนา)`.slice(0, 100), active: false })
    .returning({ id: rules.id });
  revalidatePath("/rules");
  redirect(`/rules/${created.id}`);
}

export async function deleteRule(formData: FormData): Promise<void> {
  await requireAuth();
  const id = Number(formData.get("id"));
  await getDb().delete(rules).where(eq(rules.id, id));
  revalidatePath("/rules");
  redirect("/rules");
}
