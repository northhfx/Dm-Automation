import { and, eq, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { dedupKeys, events, inboxItems, jobs, webhookLogs, type Job } from "@/db/schema";
import { activityCutoff } from "@/lib/activity-retention";
import { handleComment, handleDm, handlePagePost, handleRead, handleSendDm, RescheduledError } from "@/lib/automation/handlers";
import { systemMessage } from "@/lib/i18n/system";
import { inboxCutoff } from "@/lib/inbox/retention";
import { refreshDueInstagramTokens } from "@/lib/instagram/token";
import { checkRuleLinksIfDue } from "@/lib/link-health";
import type { CommentJob, DmJob, PagePostJob, ReadJob } from "@/lib/meta/webhook";
import { claimJobs, completeJob, failJob, recoverStuckJobs } from "./queue";

const HANDLERS: Record<string, (db: Db, job: Job) => Promise<void>> = {
  comment: (db, job) => handleComment(db, job.payload as unknown as CommentJob),
  dm: (db, job) => handleDm(db, job.payload as unknown as DmJob),
  read: (db, job) => handleRead(db, job.payload as unknown as ReadJob),
  page_post: (db, job) => handlePagePost(db, job.payload as unknown as PagePostJob),
  send_dm: (db, job) => handleSendDm(db, job),
};

export async function processJob(db: Db, job: Job): Promise<void> {
  const handler = HANDLERS[job.type];
  if (!handler) {
    await failJob(db, { ...job, attempts: job.maxAttempts }, systemMessage("unknownJobType", { type: job.type }));
    return;
  }
  try {
    await handler(db, job);
    await completeJob(db, job.id);
  } catch (err) {
    if (err instanceof RescheduledError) return;
    console.error(`[worker] งาน #${job.id} (${job.type}) ผิดพลาด:`, err);
    await failJob(db, job, (err as Error)?.message ?? String(err));
  }
}

/** ทำงานที่ค้างในคิวจนหมด (ใช้ใน worker และในเทส) */
export async function drainQueue(db: Db, batchSize = 10): Promise<number> {
  let total = 0;
  for (;;) {
    const batch = await claimJobs(db, batchSize);
    if (batch.length === 0) return total;
    await Promise.all(batch.map((job) => processJob(db, job)));
    total += batch.length;
  }
}

/** ลบข้อมูลชั่วคราวที่เก่าแล้ว เพื่อไม่ให้ฐานข้อมูลโตเกินจำเป็น */
export async function cleanup(db: Db): Promise<void> {
  const day = 24 * 60 * 60_000;
  await recoverStuckJobs(db);
  await db.delete(webhookLogs).where(lt(webhookLogs.receivedAt, new Date(Date.now() - 7 * day)));
  await db.delete(dedupKeys).where(lt(dedupKeys.createdAt, new Date(Date.now() - 30 * day)));
  await db.delete(jobs).where(and(eq(jobs.status, "done"), lt(jobs.updatedAt, new Date(Date.now() - 7 * day))));
  // ข้อความรอตอบเก็บไว้ INBOX_RETENTION_DAYS วัน (ทั้งที่ยังรอตอบและที่กดเสร็จแล้ว)
  await db.delete(inboxItems).where(lt(inboxItems.createdAt, inboxCutoff()));
  // ประวัติกิจกรรมเก็บไว้ 12 เดือน (ACTIVITY_RETENTION_DAYS)
  await db.delete(events).where(lt(events.createdAt, activityCutoff()));
}

/** งานดูแลระบบทุก 10 นาที: ล้างข้อมูลเก่า แล้วต่ออายุ token Instagram ที่ถึงเวลา (อย่างหนึ่งพังไม่กระทบอีกอย่าง) */
export async function maintenance(db: Db): Promise<void> {
  try {
    await cleanup(db);
  } catch (err) {
    console.error("[worker] ล้างข้อมูลเก่าไม่สำเร็จ:", err);
  }
  try {
    const r = await refreshDueInstagramTokens(db);
    if (r.checked > 0) console.log(`[worker] ต่ออายุ token Instagram: สำเร็จ ${r.refreshed} ไม่สำเร็จ ${r.failed}`);
  } catch (err) {
    console.error("[worker] ต่ออายุ token Instagram ไม่สำเร็จ:", err);
  }
}

/**
 * worker ที่ทำงานอยู่เบื้องหลังในเซิร์ฟเวอร์เดียวกับเว็บ
 * ปลุกทันทีเมื่อมี webhook เข้ามา และเช็คคิวทุก 2 วินาทีเผื่องานที่ตั้งเวลาไว้
 */
class Worker {
  private running = false;
  private wakeUp: (() => void) | null = null;
  private lastCleanup = 0;

  constructor(private readonly getDb: () => Db) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
    console.log("[worker] เริ่มทำงานแล้ว");
  }

  wake(): void {
    this.wakeUp?.();
  }

  /**
   * ตรวจลิงก์ปลายทางในกฎ (ตรวจจริงทุก 6 ชั่วโมง — เสียจะขึ้นใน "ปัญหาที่ต้องดู" บนหน้าภาพรวม)
   * ทำเบื้องหลัง ไม่รอ: เว็บปลายทางที่ช้า/ล่มต้องไม่ทำให้การตอบคอมเมนต์และแชทช้าไปด้วย (ทำทีละรอบ)
   */
  private linkCheck: Promise<void> | null = null;

  private startLinkCheck(db: Db): void {
    if (this.linkCheck) return;
    this.linkCheck = checkRuleLinksIfDue(db)
      .then(() => {})
      .catch((err: unknown) => console.error("[worker] ตรวจลิงก์ในกฎไม่สำเร็จ:", err))
      .finally(() => {
        this.linkCheck = null;
      });
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const db = this.getDb();
        await drainQueue(db);
        if (Date.now() - this.lastCleanup > 10 * 60_000) {
          this.lastCleanup = Date.now();
          await maintenance(db);
          this.startLinkCheck(db);
        }
      } catch (err) {
        console.error("[worker] ผิดพลาด:", err);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 2_000);
        this.wakeUp = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      this.wakeUp = null;
    }
  }
}

const globalForWorker = globalThis as unknown as { __dmWorker?: Worker };

export function getWorker(getDb: () => Db): Worker {
  if (!globalForWorker.__dmWorker) globalForWorker.__dmWorker = new Worker(getDb);
  return globalForWorker.__dmWorker;
}

/** ปลุก worker (ถ้ามี) ให้ทำงานทันที */
export function wakeWorker(): void {
  globalForWorker.__dmWorker?.wake();
}
