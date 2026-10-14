import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { env } from "@/lib/env";
import { fillInboxDetails } from "@/lib/inbox/details";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

/*
 * หน้าข้อความรอตอบเรียกหลังแสดงผลแล้ว: ถาม Meta หาชื่อ/username/ลิงก์โพสต์ที่ขาดของแถวที่เห็นอยู่
 * เป็น Route Handler (ไม่ใช่ Server Action) เพราะ Server Action ถูกส่งทีละอัน — ถ้า Meta ช้า
 * ปุ่ม "เสร็จแล้ว" ที่กดระหว่างนั้นจะต้องรอคิว
 * body: { ids: number[] } → { updated: number } (มากกว่า 0 = หน้าเว็บควรโหลดใหม่)
 */
export async function POST(request: NextRequest) {
  // proxy.ts กันหน้าที่ไม่ได้ล็อกอินไว้แล้ว — เช็คซ้ำตรงนี้อีกชั้น
  if (!isValidSession(request.cookies.get(SESSION_COOKIE)?.value, env.authSecret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let ids: number[] = [];
  try {
    const body = (await request.json()) as { ids?: unknown };
    if (Array.isArray(body?.ids)) ids = body.ids.map(Number);
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  try {
    return Response.json({ updated: await fillInboxDetails(getDb(), ids) });
  } catch (err) {
    console.error("[inbox] เติมข้อมูลข้อความรอตอบไม่สำเร็จ:", err);
    return Response.json({ updated: 0 }, { status: 500 });
  }
}
