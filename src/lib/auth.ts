import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { createSessionValue, isValidSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export async function startSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionValue(env.authSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** ใช้ในทุก Server Action ของแดชบอร์ด: ถ้ายังไม่ล็อกอินให้กลับไปหน้า login */
export async function requireAuth(): Promise<void> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isValidSession(value, env.authSecret)) redirect("/login");
}
