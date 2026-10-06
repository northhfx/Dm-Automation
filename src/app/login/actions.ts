"use server";

import { redirect } from "next/navigation";
import { endSession, startSession } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!safeEqual(password, env.adminPassword)) {
    // หน่วงเวลาเล็กน้อย กันการเดารหัสผ่านรัวๆ
    await new Promise((r) => setTimeout(r, 800));
    return { error: "รหัสผ่านไม่ถูกต้อง" };
  }
  await startSession();
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
