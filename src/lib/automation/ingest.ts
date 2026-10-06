import type { Db } from "@/db/client";
import { webhookLogs } from "@/db/schema";
import { parseWebhook } from "@/lib/meta/webhook";
import { enqueue } from "@/lib/queue/queue";

/** บันทึก webhook ดิบไว้ดูย้อนหลัง แล้วแตกเป็นงานใส่คิว */
export async function ingestWebhook(db: Db, body: unknown): Promise<number> {
  const object = (body as { object?: unknown })?.object;
  await db.insert(webhookLogs).values({ object: typeof object === "string" ? object : null, body: body as object });
  const jobs = parseWebhook(body);
  for (const job of jobs) {
    await enqueue(db, job.type, { ...job }, { maxAttempts: 3 });
  }
  return jobs.length;
}
