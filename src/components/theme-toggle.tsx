"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { appearanceMessages } from "@/lib/i18n/messages/appearance";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, themeColorTags, type ThemePref } from "@/lib/theme";
import { SegmentedControl, type SegmentOption } from "./segmented-control";

/*
 * ปุ่มเลือกธีมสี: สว่าง / มืด / ตามเครื่อง
 * - กดแล้วเปลี่ยนทันที (ไม่ต้องโหลดหน้าใหม่) และจำไว้ในคุกกี้ → เปิดครั้งหน้าเซิร์ฟเวอร์ใส่ธีมให้ตั้งแต่แรก ไม่กะพริบ
 * - วางได้หลายที่ในหน้าเดียวกัน (แถบเมนู + หน้าตั้งค่า) ทุกอันใช้ค่าร่วมกัน เลือกที่หนึ่ง อีกที่เปลี่ยนตาม
 * - initial = ค่าจากเซิร์ฟเวอร์ (getThemePref() ใน src/lib/theme-server.ts)
 */

const CHOICES: { value: ThemePref; label: "themeLight" | "themeDark" | "themeSystem"; icon: LucideIcon }[] = [
  { value: "light", label: "themeLight", icon: Sun },
  { value: "dark", label: "themeDark", icon: Moon },
  { value: "system", label: "themeSystem", icon: Monitor },
];

// ---------- ค่าที่ใช้ร่วมกันทุกปุ่มในหน้า ----------

// ธีมที่เลือกล่าสุดในหน้านี้ (null = ยังไม่ได้กด → ใช้ค่า initial จากเซิร์ฟเวอร์)
let current: ThemePref | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function writeCookie(pref: ThemePref) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  // "ตามเครื่อง" = ลบคุกกี้ทิ้ง (ไม่มีคุกกี้ = ตามเครื่อง)
  document.cookie =
    pref === "system"
      ? `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
      : `${THEME_COOKIE}=${pref}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/**
 * สีแถบเบราว์เซอร์บนมือถือ (meta theme-color)
 * แก้ค่าในแท็กเดิมแทนการลบทิ้ง เพราะแท็กที่ Next.js สร้างเป็นของ React (ลบเองแล้ว React จะพังตอนเปลี่ยนหน้า)
 * ทุกแท็กที่มีอยู่ถูกตั้งให้ถูกต้องทั้งหมด จึงไม่สำคัญว่าหน้าถัดไป React จะสร้างแท็กใหม่กี่อัน
 */
function syncThemeColorMeta(pref: ThemePref) {
  const want = themeColorTags(pref);
  const tags = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  while (tags.length < want.length) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
    tags.push(meta);
  }
  tags.forEach((meta, i) => {
    const tag = want[i % want.length];
    meta.setAttribute("content", tag.color);
    if (tag.media) meta.setAttribute("media", tag.media);
    else meta.removeAttribute("media");
  });
}

/** ปิดแอนิเมชันสีชั่วคราวตอนสลับธีม (ไม่งั้นบางส่วนค่อยๆ เปลี่ยน บางส่วนเปลี่ยนทันที ดูกระตุก) */
function withoutTransitions(change: () => void) {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  change();
  // ให้เบราว์เซอร์คำนวณสีใหม่ก่อน แล้วค่อยเปิดแอนิเมชันคืน
  void window.getComputedStyle(document.body).color;
  setTimeout(() => style.remove(), 1);
}

function setTheme(pref: ThemePref) {
  withoutTransitions(() => {
    const root = document.documentElement;
    // "ตามเครื่อง" ไม่ใส่ data-theme ให้ CSS เลือกตามโหมดของเครื่องเอง
    if (pref === "system") delete root.dataset.theme;
    else root.dataset.theme = pref;
  });
  writeCookie(pref);
  syncThemeColorMeta(pref);
  current = pref;
  listeners.forEach((listener) => listener());
}

// ---------- ปุ่ม ----------

export function ThemeToggle({
  initial,
  variant = "full",
  className,
}: {
  initial: ThemePref;
  /** full = ไอคอน + ข้อความ (หน้าตั้งค่า), compact = ไอคอนอย่างเดียว (แถบเมนูด้านข้างที่แคบ) */
  variant?: "full" | "compact";
  className?: string;
}) {
  const value = useSyncExternalStore(
    subscribe,
    () => current ?? initial,
    () => initial,
  );
  const compact = variant === "compact";
  const t = useT(appearanceMessages);

  const options: SegmentOption<ThemePref>[] = CHOICES.map(({ value: v, label: key, icon: Icon }) => {
    const label = t(key);
    return compact
      ? {
          value: v,
          // ไอคอนอย่างเดียว: ชื่อเต็มอยู่ใน sr-only (โปรแกรมอ่านหน้าจอ) และ title (ชี้เมาส์ค้างไว้)
          label: (
            <span title={label} className="flex items-center">
              <Icon aria-hidden />
              <span className="sr-only">{label}</span>
            </span>
          ),
        }
      : // มือถือ: ซ่อนไอคอน ไม่งั้นคำว่า "ตามเครื่อง" ถูกตัดเป็น "ตามเค..." ในการ์ดที่กว้างแค่ ~300px
        { value: v, label, icon: <Icon aria-hidden className="max-sm:hidden" /> };
  });

  return (
    <SegmentedControl
      label={t("themeLabel")}
      options={options}
      value={value}
      onChange={(v) => {
        if (v !== value) setTheme(v);
      }}
      size={compact ? "sm" : "md"}
      block
      className={className}
    />
  );
}
