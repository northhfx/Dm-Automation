"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { endSession, startSession } from "@/lib/auth";
import { isPasswordSet, rememberBaseUrlFromHeaders, setPassword, verifyPassword } from "@/lib/config";
import { getT } from "@/lib/i18n/server";

/** ความยาวรหัสผ่านขั้นต่ำ (ตรงกับ MIN_LENGTH ใน login-form.tsx) */
const MIN_PASSWORD_LENGTH = 8;

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const db = getDb();
  const password = String(formData.get("password") ?? "");
  if (!(await verifyPassword(db, password))) {
    // หน่วงเวลาเล็กน้อย กันการเดารหัสผ่านรัวๆ
    await new Promise((r) => setTimeout(r, 800));
    return { error: (await getT("auth"))("wrongPassword") };
  }
  await rememberBaseUrlFromHeaders(db, await headers());
  await startSession();
  redirect("/");
}

/** ตั้งรหัสผ่านครั้งแรก (ทำได้ครั้งเดียว ตอนที่ยังไม่มีรหัสผ่านในระบบ) */
export async function createPassword(_prev: { error?: string } | undefined, formData: FormData) {
  const db = getDb();
  if (await isPasswordSet(db)) redirect("/login");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const t = await getT("auth");
  if (password.length < MIN_PASSWORD_LENGTH) return { error: t("passwordTooShort", { min: MIN_PASSWORD_LENGTH }) };
  if (password !== confirm) return { error: t("passwordsDontMatch") };
  await setPassword(db, password);
  await rememberBaseUrlFromHeaders(db, await headers());
  await startSession();
  redirect("/guide");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
