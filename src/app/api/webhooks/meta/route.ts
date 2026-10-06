import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { ingestWebhook } from "@/lib/automation/ingest";
import { getMetaConfig, markWebhookVerified } from "@/lib/config";
import { safeEqual, verifyMetaSignature } from "@/lib/crypto";
import { wakeWorker } from "@/lib/queue/worker";

/** Meta เรียก GET ครั้งแรกตอนตั้งค่า Webhook เพื่อยืนยันว่า URL นี้เป็นของเรา */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge") ?? "";
  const db = getDb();
  const { verifyToken } = await getMetaConfig(db);
  if (mode === "subscribe" && safeEqual(token, verifyToken)) {
    await markWebhookVerified(db);
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/** ทุกครั้งที่มีคอมเมนต์ / ข้อความใหม่ Meta จะ POST มาที่นี่ */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const db = getDb();
  const { appSecret } = await getMetaConfig(db);
  if (!appSecret) {
    console.warn("[webhook] ยังไม่ได้ใส่ App Secret — ไปที่หน้าคู่มือตั้งค่า");
    return new Response("App secret not configured", { status: 503 });
  }
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    console.warn("[webhook] ลายเซ็นไม่ถูกต้อง — ตรวจสอบ App Secret ในหน้าตั้งค่า");
    return new Response("Invalid signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // บันทึกลงคิวแล้วตอบกลับทันที (Meta ต้องการคำตอบภายในไม่กี่วินาที) งานจริงให้ worker ทำ
  await ingestWebhook(db, body);
  wakeWorker();
  return new Response("EVENT_RECEIVED", { status: 200 });
}
