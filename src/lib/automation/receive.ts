import type { NextRequest } from "next/server";
import { getDb, type Db } from "@/db/client";
import type { WebhookVia } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import {
  getMetaConfig,
  getWebhookSecrets,
  markInstagramWebhookBadSignature,
  markInstagramWebhookVerified,
  markWebhookBadSignature,
  markWebhookVerified,
  type WebhookSecret,
} from "@/lib/config";
import { findConnection } from "@/lib/connections";
import { safeEqual, verifyMetaSignature } from "@/lib/crypto";
import { wakeWorker } from "@/lib/queue/worker";

/**
 * รับ webhook จาก Meta — ใช้ร่วมกันทั้ง /api/webhooks/meta (แอป Facebook) และ /api/webhooks/instagram (Instagram Login)
 * ทั้งสอง URL รับ secret ทุกตัวเหมือนกัน (ใส่ URL สลับกันก็ไม่ทำให้ข้อมูลหาย)
 * ต่างกันแค่สถานะ "ยืนยันแล้ว" / "ลายเซ็นไม่ตรง" ที่บันทึกไว้แสดงในหน้าคู่มือ/ตั้งค่า
 */

export type WebhookEndpoint = "meta" | "instagram";

/** หา secret ที่ลายเซ็นตรง → บอกว่า webhook มาทางไหน (null = ไม่ตรงกับ secret ใดเลย) */
export function matchWebhookSignature(
  raw: string,
  header: string | null,
  secrets: readonly WebhookSecret[],
): WebhookVia | null {
  for (const s of secrets) {
    if (verifyMetaSignature(raw, header, s.secret)) return s.via;
  }
  return null;
}

/** รูปแบบลายเซ็นที่ Meta ส่งมา: sha256=<hex 64 ตัว> */
const SIGNATURE_FORMAT = /^sha256=[0-9a-f]{64}$/i;

/** ตรวจ entry.id ของ payload ที่ลายเซ็นไม่ตรงได้ไม่เกินกี่ตัว (กันคนส่ง entry มาเยอะๆ ให้ค้นฐานข้อมูลซ้ำๆ) */
const MAX_ENTRY_IDS = 5;

/**
 * ลายเซ็นไม่ตรง: จะเตือนเจ้าของร้านว่า secret ผิด เฉพาะเมื่อ request น่าจะมาจาก Meta จริง —
 * header เป็นรูปแบบของ Meta, body เป็น JSON ของ Meta (object page / instagram) และ entry[].id เป็นเพจ/บัญชีที่เชื่อมไว้
 * URL ของ webhook เปิดสาธารณะ ถ้าไม่ตรวจ ใครก็ POST มั่วๆ ให้หน้าตั้งค่าขึ้นเตือน แล้วเจ้าของร้านไปเปลี่ยน secret ที่ถูกอยู่แล้ว
 */
export async function isPlausibleMetaDelivery(db: Db, raw: string, header: string | null): Promise<boolean> {
  if (!header || !SIGNATURE_FORMAT.test(header)) return false;
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!body || typeof body !== "object") return false;
  const { object, entry } = body as { object?: unknown; entry?: unknown };
  if ((object !== "page" && object !== "instagram") || !Array.isArray(entry)) return false;
  const ids = new Set<string>();
  for (const e of entry) {
    const id = (e as { id?: unknown } | null)?.id;
    if (typeof id === "string" && id) ids.add(id);
    else if (typeof id === "number") ids.add(String(id));
    if (ids.size >= MAX_ENTRY_IDS) break;
  }
  const platform = object === "page" ? "facebook" : "instagram";
  for (const id of ids) {
    if (await findConnection(db, platform, id)) return true;
  }
  return false;
}

/** Meta เรียก GET ครั้งแรกตอนตั้งค่า Webhook เพื่อยืนยันว่า URL นี้เป็นของเรา (ทั้งสอง URL ใช้ Verify token เดียวกัน) */
export async function handleWebhookVerification(request: NextRequest, endpoint: WebhookEndpoint): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge") ?? "";
  const db = getDb();
  const { verifyToken } = await getMetaConfig(db);
  if (mode === "subscribe" && safeEqual(token, verifyToken)) {
    await (endpoint === "instagram" ? markInstagramWebhookVerified(db) : markWebhookVerified(db));
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/** ทุกครั้งที่มีคอมเมนต์ / ข้อความใหม่ Meta จะ POST มาที่นี่ */
export async function handleWebhookDelivery(request: NextRequest, endpoint: WebhookEndpoint): Promise<Response> {
  const raw = await request.text();
  const header = request.headers.get("x-hub-signature-256");
  // ไม่มีลายเซ็นแบบของ Meta → ไม่ใช่ Meta แน่นอน ปฏิเสธทันทีโดยไม่ต้องอ่านฐานข้อมูล
  if (!header || !SIGNATURE_FORMAT.test(header)) return new Response("Invalid signature", { status: 401 });
  const db = getDb();
  const secrets = await getWebhookSecrets(db);
  if (secrets.length === 0) {
    console.warn("[webhook] ยังไม่ได้ใส่ App Secret — ไปที่หน้าคู่มือตั้งค่า");
    return new Response("App secret not configured", { status: 503 });
  }
  const via = matchWebhookSignature(raw, header, secrets);
  if (!via) {
    // request ที่ไม่น่าใช่ Meta (เช่น มีคนลองยิงมั่วๆ) → ปฏิเสธเงียบๆ ไม่ขึ้นคำเตือนในหน้าตั้งค่า
    if (!(await isPlausibleMetaDelivery(db, raw, header).catch(() => false))) {
      return new Response("Invalid signature", { status: 401 });
    }
    if (endpoint === "instagram") {
      console.warn("[webhook] ลายเซ็นไม่ถูกต้อง (Instagram) — ตรวจสอบ Instagram app secret ในหน้าตั้งค่า");
      await markInstagramWebhookBadSignature(db).catch(() => {});
    } else {
      console.warn("[webhook] ลายเซ็นไม่ถูกต้อง — ตรวจสอบ App Secret ในหน้าตั้งค่า");
      await markWebhookBadSignature(db).catch(() => {});
    }
    return new Response("Invalid signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // บันทึกลงคิวแล้วตอบกลับทันที (Meta ต้องการคำตอบภายในไม่กี่วินาที) งานจริงให้ worker ทำ
  await ingestWebhook(db, body, { via });
  wakeWorker();
  return new Response("EVENT_RECEIVED", { status: 200 });
}
