import { SunMoon } from "lucide-react";
import { Card, cx } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { getThemePref } from "@/lib/theme-server";

/** การ์ด "การแสดงผล" ในหน้าตั้งค่า: เลือกธีม สว่าง / มืด / ตามเครื่อง (id="appearance" สำหรับแถบหมวด) */
export async function AppearanceCard({ className }: { className?: string } = {}) {
  const theme = await getThemePref();
  return (
    <Card
      id="appearance"
      // เว้นที่ด้านบนเมื่อกระโดดมาที่หมวดนี้ (เท่ากับการ์ดอื่นในหน้าตั้งค่า)
      className={cx("scroll-mt-[calc(var(--app-topbar-h)+72px)] lg:scroll-mt-10", className)}
      icon={<SunMoon />}
      title="การแสดงผล"
      description="ธีมสีของหน้าจัดการ — “ตามเครื่อง” จะสลับสว่าง/มืดเองตามที่ตั้งไว้ในมือถือหรือคอมพิวเตอร์ (จำไว้เฉพาะเบราว์เซอร์นี้)"
    >
      <ThemeToggle initial={theme} variant="full" className="sm:max-w-md" />
    </Card>
  );
}
