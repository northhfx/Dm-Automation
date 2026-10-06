"use server";

import { eq, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { rules } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { formDataToValues, validateRule, type RuleFormState } from "./form-values";

export async function saveRule(prev: RuleFormState, formData: FormData): Promise<RuleFormState> {
  await requireAuth();
  const values = formDataToValues(formData);
  const result = validateRule(values);
  if (!result.ok) return { error: result.error, values, attempt: (prev.attempt ?? 0) + 1 };

  const db = getDb();
  if (values.id) {
    await db.update(rules).set({ ...result.data, updatedAt: new Date() }).where(eq(rules.id, values.id));
  } else {
    await db.insert(rules).values(result.data);
  }
  revalidatePath("/rules");
  redirect("/rules");
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

export async function deleteRule(formData: FormData): Promise<void> {
  await requireAuth();
  const id = Number(formData.get("id"));
  await getDb().delete(rules).where(eq(rules.id, id));
  revalidatePath("/rules");
  redirect("/rules");
}
