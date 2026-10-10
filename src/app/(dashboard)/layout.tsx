import type { ReactNode } from "react";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { pages } from "@/db/schema";
import { getSetupStatus, setupProgress } from "@/lib/config";
import { AppShell, type ShellData } from "./app-shell";

// ทุกหน้าของแดชบอร์ดอ่านข้อมูลล่าสุดจากฐานข้อมูลทุกครั้ง (ไม่ cache ตอน build)
export const dynamic = "force-dynamic";

/** ข้อมูลเล็กๆ ที่แถบเมนูใช้: ความคืบหน้าการตั้งค่า + เพจที่เชื่อมต่อ (ถ้าอ่านไม่ได้ก็ยังแสดงหน้าได้) */
async function loadShellData(): Promise<ShellData> {
  try {
    const db = getDb();
    const [status, pageRows] = await Promise.all([
      getSetupStatus(db),
      db
        .select({ id: pages.id, name: pages.name, igUsername: pages.igUsername, subscribed: pages.subscribed })
        .from(pages)
        .orderBy(asc(pages.name)),
    ]);
    return {
      setup: setupProgress(status),
      pages: pageRows.map((p) => ({ id: p.id, name: p.name, igUsername: p.igUsername, hasError: !p.subscribed })),
    };
  } catch (err) {
    console.error("โหลดข้อมูลแถบเมนูไม่สำเร็จ", err);
    return { setup: null, pages: [] };
  }
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppShell data={await loadShellData()}>{children}</AppShell>;
}
