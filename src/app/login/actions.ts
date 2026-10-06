"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { endSession, startSession } from "@/lib/auth";
import { isPasswordSet, rememberBaseUrlFromHeaders, setPassword, verifyPassword } from "@/lib/config";

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const db = getDb();
  const password = String(formData.get("password") ?? "");
  if (!(await verifyPassword(db, password))) {
    // หน่วงเวลาเล็กน้อย กันการเดารหัสผ่านรัวๆ
    await new Promise((r) => setTimeout(r, 800));
    return { error: "รหัสผ่านไม่ถูกต้อง" };
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
  if (password.length < 8) return { error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" };
  if (password !== confirm) return { error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" };
  await setPassword(db, password);
  await rememberBaseUrlFromHeaders(db, await headers());
  await startSession();
  redirect("/guide");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
