import type { NextRequest } from "next/server";
import { handleWebhookDelivery, handleWebhookVerification } from "@/lib/automation/receive";

/** Webhook ของ Instagram Login (บัญชี Instagram ที่เชื่อมแยกจากเพจ) — ตรรกะทั้งหมดอยู่ใน lib/automation/receive.ts */

/** Meta เรียก GET ครั้งแรกตอนกด Verify and save ในหน้า API setup with Instagram login */
export async function GET(request: NextRequest) {
  return handleWebhookVerification(request, "instagram");
}

/** ทุกครั้งที่มีคอมเมนต์ / ข้อความใหม่ Meta จะ POST มาที่นี่ */
export async function POST(request: NextRequest) {
  return handleWebhookDelivery(request, "instagram");
}
