import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "./client";

/** สร้าง/อัปเดตตารางในฐานข้อมูลอัตโนมัติตอนเปิดเซิร์ฟเวอร์ */
export async function runMigrations(): Promise<void> {
  await migrate(getDb(), { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
