import type { ReactNode } from "react";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { pages } from "@/db/schema";
import { getSetupStatus, setupProgress } from "@/lib/config";
import { instagramAccountHealth, instagramHealthLevel, listInstagramAccounts } from "@/lib/instagram/accounts";
import { getThemePref } from "@/lib/theme-server";
import { AppShell, type ShellData } from "./app-shell";

// ทุกหน้าของแดชบอร์ดอ่านข้อมูลล่าสุดจากฐานข้อมูลทุกครั้ง (ไม่ cache ตอน build)
export const dynamic = "force-dynamic";

/** ข้อมูลเล็กๆ ที่แถบเมนูใช้: ความคืบหน้าการตั้งค่า + เพจ/บัญชี Instagram ที่เชื่อมต่อ (ถ้าอ่านไม่ได้ก็ยังแสดงหน้าได้) */
async function loadShellData(): Promise<Omit<ShellData, "theme">> {
  try {
    const db = getDb();
    const [status, pageRows, igAccounts] = await Promise.all([
      getSetupStatus(db),
      db
        .select({ id: pages.id, name: pages.name, igUsername: pages.igUsername, subscribed: pages.subscribed })
        .from(pages)
        .orderBy(asc(pages.name)),
      listInstagramAccounts(db),
    ]);
    const now = new Date();
    return {
      setup: setupProgress(status),
      pages: pageRows.map((p) => ({ id: p.id, name: p.name, igUsername: p.igUsername, hasError: !p.subscribed })),
      // ส่งแค่ id / username / ระดับสถานะไปที่เบราว์เซอร์ (ไม่ส่ง token) — กติกาเดียวกับหน้าตั้งค่า
      instagram: igAccounts.map((a) => ({
        id: a.id,
        username: a.username,
        status: instagramHealthLevel(instagramAccountHealth(a, now)),
      })),
    };
  } catch (err) {
    console.error("โหลดข้อมูลแถบเมนูไม่สำเร็จ", err);
    return { setup: null, pages: [], instagram: [] };
  }
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // อ่านธีมนอก try/catch — cookies() อาจโยนสัญญาณพิเศษของ Next.js ที่ต้องปล่อยผ่าน
  const [shell, theme] = await Promise.all([loadShellData(), getThemePref()]);
  return <AppShell data={{ ...shell, theme }}>{children}</AppShell>;
}
