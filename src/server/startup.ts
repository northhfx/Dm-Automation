import { getDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { env } from "@/lib/env";
import { getWorker } from "@/lib/queue/worker";

export async function startBackground(): Promise<void> {
  await runMigrations();
  console.log("[startup] ฐานข้อมูลพร้อมใช้งาน");
  if (env.workerDisabled) {
    console.log("[startup] DISABLE_WORKER=1 — ไม่เริ่ม worker");
    return;
  }
  getWorker(getDb).start();
}
