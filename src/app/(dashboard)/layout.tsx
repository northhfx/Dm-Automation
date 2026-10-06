import type { ReactNode } from "react";
import { NavLinks } from "./nav-links";
import { logout } from "../login/actions";

// ทุกหน้าของแดชบอร์ดอ่านข้อมูลล่าสุดจากฐานข้อมูลทุกครั้ง (ไม่ cache ตอน build)
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 md:block md:px-5 md:py-5">
          <div className="font-semibold">DM Automation</div>
          <form action={logout} className="md:hidden">
            <button className="text-sm text-fg-2 hover:text-fg">ออกจากระบบ</button>
          </form>
        </div>
        <NavLinks />
        <form action={logout} className="mt-auto hidden px-5 py-5 md:block">
          <button className="text-sm text-fg-2 hover:text-fg">ออกจากระบบ</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
