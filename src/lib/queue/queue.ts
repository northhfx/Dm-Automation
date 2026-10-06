import { and, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { jobs, type Job } from "@/db/schema";

export async function enqueue(
  db: Db,
  type: string,
  payload: Record<string, unknown>,
  opts: { runAt?: Date; maxAttempts?: number } = {},
): Promise<number> {
  const [row] = await db
    .insert(jobs)
    .values({ type, payload, runAt: opts.runAt ?? new Date(), maxAttempts: opts.maxAttempts ?? 5 })
    .returning({ id: jobs.id });
  return row.id;
}

/** จองงานที่ถึงเวลาทำ (SKIP LOCKED กันไม่ให้หลาย worker หยิบงานเดียวกัน) */
export async function claimJobs(db: Db, limit: number): Promise<Job[]> {
  const result = await db.execute<Record<string, unknown>>(sql`
    UPDATE ${jobs} SET status = 'running', attempts = attempts + 1, updated_at = now()
    WHERE id IN (
      SELECT id FROM ${jobs}
      WHERE status = 'pending' AND run_at <= now()
      ORDER BY run_at, id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);
  const ids = result.rows.map((r) => Number(r.id));
  if (ids.length === 0) return [];
  const rows = await db.query.jobs.findMany({ where: (j, { inArray }) => inArray(j.id, ids) });
  return rows.sort((a, b) => a.id - b.id);
}

export async function completeJob(db: Db, id: number): Promise<void> {
  await db.update(jobs).set({ status: "done", updatedAt: new Date(), lastError: null }).where(eq(jobs.id, id));
}

/** งานล้มเหลว: ลองใหม่แบบเว้นระยะเพิ่มขึ้นเรื่อยๆ จนครบจำนวนครั้ง แล้วค่อยถือว่าล้มเหลว */
export async function failJob(db: Db, job: Job, error: string): Promise<void> {
  const final = job.attempts >= job.maxAttempts;
  const delayMs = Math.min(10_000 * 2 ** (job.attempts - 1), 30 * 60_000);
  await db
    .update(jobs)
    .set({
      status: final ? "failed" : "pending",
      runAt: final ? job.runAt : new Date(Date.now() + delayMs),
      lastError: error.slice(0, 2000),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id));
}

/** เลื่อนงานออกไปโดยไม่นับเป็นความล้มเหลว (เช่น ติดลิมิตจำนวนข้อความต่อชั่วโมง) */
export async function rescheduleJob(db: Db, job: Job, runAt: Date, note: string): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: "pending",
      runAt,
      attempts: Math.max(0, job.attempts - 1),
      lastError: note,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id));
}

export async function updateJobPayload(db: Db, id: number, payload: Record<string, unknown>): Promise<void> {
  await db.update(jobs).set({ payload }).where(eq(jobs.id, id));
}

/** งานที่ค้างสถานะ running นานผิดปกติ (เช่น เซิร์ฟเวอร์รีสตาร์ทกลางคัน) → คืนกลับเข้าคิว */
export async function recoverStuckJobs(db: Db, olderThanMs = 5 * 60_000): Promise<void> {
  await db
    .update(jobs)
    .set({ status: "pending", updatedAt: new Date() })
    .where(and(eq(jobs.status, "running"), lt(jobs.updatedAt, new Date(Date.now() - olderThanMs))));
}
