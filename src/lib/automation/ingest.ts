import type { Db } from "@/db/client";
import { webhookLogs, type WebhookVia } from "@/db/schema";
import { parseWebhook } from "@/lib/meta/webhook";
import { enqueue } from "@/lib/queue/queue";

/**
 * บันทึก webhook ดิบไว้ดูย้อนหลัง แล้วแตกเป็นงานใส่คิว
 * via = มาทางไหน (ตัดสินจาก secret ที่ลายเซ็นตรง) เก็บไว้ทั้งใน log และในทุกงาน
 */
export async function ingestWebhook(db: Db, body: unknown, opts: { via?: WebhookVia } = {}): Promise<number> {
  const via = opts.via ?? "facebook_login";
  const object = (body as { object?: unknown })?.object;
  await db
    .insert(webhookLogs)
    .values({ object: typeof object === "string" ? object : null, body: body as object, source: via });
  const jobs = parseWebhook(body, via);
  for (const job of jobs) {
    await enqueue(db, job.type, { ...job }, { maxAttempts: 3 });
  }
  return jobs.length;
}
