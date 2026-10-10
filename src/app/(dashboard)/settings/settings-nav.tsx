"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { cx } from "@/components/ui";

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  group: string;
  /** "attention" = มีเรื่องต้องแก้ (แสดงจุดสีเหลือง พร้อมข้อความสำหรับโปรแกรมอ่านหน้าจอ) */
  status?: "attention";
}

/** หาหมวดที่กำลังอ่านอยู่: หมวดสุดท้ายที่หัวการ์ดเลื่อนผ่านเส้นด้านบนของจอแล้ว */
function currentSection(ids: string[]): string {
  const topbar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-topbar-h")) || 0;
  const line = topbar + 120;
  let active = ids[0];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= line) active = id;
  }
  // เลื่อนจนสุดหน้าแล้ว → หมวดสุดท้าย
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = ids[ids.length - 1];
  return active;
}

/**
 * เมนูหมวดในหน้าตั้งค่า
 * - เดสก์ท็อป: รายการแนวตั้งด้านซ้าย ติดอยู่กับที่ขณะเลื่อน
 * - มือถือ: แถบปุ่มเลื่อนแนวนอน ติดใต้แถบด้านบน
 */
export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const chipsRef = useRef<HTMLDivElement>(null);
  const ids = items.map((i) => i.id).join(",");

  useEffect(() => {
    const list = ids.split(",");
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setActive(currentSection(list)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ids]);

  // มือถือ: เลื่อนแถบปุ่มให้เห็นหมวดที่กำลังอ่าน (เลื่อนเฉพาะแถบ ไม่ยุ่งกับการเลื่อนหน้า)
  useEffect(() => {
    const box = chipsRef.current;
    const chip = box?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (!box || !chip || box.scrollWidth <= box.clientWidth) return;
    const left = chip.offsetLeft - box.clientWidth / 2 + chip.offsetWidth / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  function go(e: MouseEvent<HTMLAnchorElement>, id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
  }

  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <>
      {/* มือถือ / แท็บเล็ต */}
      <nav
        aria-label="หมวดการตั้งค่า"
        className="sticky top-[var(--app-topbar-h)] z-20 -mx-4 border-b border-line bg-bg/90 backdrop-blur-md sm:-mx-6 lg:hidden"
      >
        <div ref={chipsRef} className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-2 sm:px-6">
          {items.map((item) => {
            const on = item.id === active;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                data-section={item.id}
                onClick={(e) => go(e, item.id)}
                aria-current={on ? "location" : undefined}
                className={cx(
                  "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors [&_svg]:size-4",
                  on ? "border-accent/30 bg-accent-soft font-medium text-accent" : "border-line bg-surface text-fg-2 hover:text-fg",
                )}
              >
                {item.label}
                {item.status === "attention" && (
                  <>
                    <span className="size-1.5 rounded-full bg-warning" aria-hidden />
                    <span className="sr-only">(ต้องตรวจสอบ)</span>
                  </>
                )}
              </a>
            );
          })}
        </div>
      </nav>

      {/* เดสก์ท็อป */}
      <nav aria-label="หมวดการตั้งค่า" className="sticky top-10 hidden self-start lg:block">
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-1 px-3 text-xs font-medium text-fg-3">{group}</p>
              <ul className="space-y-0.5">
                {items
                  .filter((i) => i.group === group)
                  .map((item) => {
                    const on = item.id === active;
                    return (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          onClick={(e) => go(e, item.id)}
                          aria-current={on ? "location" : undefined}
                          className={cx(
                            "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
                            on ? "bg-accent-soft font-medium text-accent" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
                          )}
                        >
                          <span className={on ? "text-accent" : "text-fg-3"}>{item.icon}</span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.status === "attention" && (
                            <>
                              <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden />
                              <span className="sr-only">(ต้องตรวจสอบ)</span>
                            </>
                          )}
                        </a>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
