import type { NextRequest } from "next/server";
import { handleWebhookDelivery, handleWebhookVerification } from "@/lib/automation/receive";

/** Webhook ของแอป Facebook (เพจ Facebook และ Instagram ที่ผูกกับเพจ) — ตรรกะทั้งหมดอยู่ใน lib/automation/receive.ts */

/** Meta เรียก GET ครั้งแรกตอนตั้งค่า Webhook เพื่อยืนยันว่า URL นี้เป็นของเรา */
export async function GET(request: NextRequest) {
  return handleWebhookVerification(request, "meta");
}

/** ทุกครั้งที่มีคอมเมนต์ / ข้อความใหม่ Meta จะ POST มาที่นี่ */
export async function POST(request: NextRequest) {
  return handleWebhookDelivery(request, "meta");
}
