"use client";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cx } from "./ui";

/*
 * ข้อความแจ้งเตือนลอย (toast) มุมจอ
 * - วาง <Toaster /> ครั้งเดียวใน root layout (ทำไว้แล้ว)
 * - เรียก toast("บันทึกแล้ว") หรือ toast("ลบไม่สำเร็จ", { tone: "critical" }) จาก Client Component ไหนก็ได้
 * - หลัง redirect จาก Server Action ใช้ <ToastOnMount param="saved" message="บันทึกแล้ว" /> ในหน้าปลายทาง
 */

export type ToastTone = "neutral" | "good" | "critical" | "warning" | "accent";

export interface ToastOptions {
  tone?: ToastTone;
  /** ข้อความรองบรรทัดที่สอง */
  description?: string;
  /** มิลลิวินาที (ค่าเริ่มต้น 4000, critical 7000) */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  description?: string;
  tone: ToastTone;
  duration: number;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** แสดง toast — คืนค่า id สำหรับปิดเองด้วย dismissToast(id) */
export function toast(message: string, options: ToastOptions = {}): number {
  const tone = options.tone ?? "neutral";
  const id = nextId++;
  // ข้อความเดิมซ้ำติดกัน (เช่น กดปุ่มรัวๆ) แสดงอันเดียวพอ
  items = [...items.filter((t) => t.message !== message), { id, message, description: options.description, tone, duration: options.duration ?? (tone === "critical" ? 7000 : 4000) }].slice(-4);
  emit();
  return id;
}

toast.success = (message: string, options: Omit<ToastOptions, "tone"> = {}) => toast(message, { ...options, tone: "good" });
toast.error = (message: string, options: Omit<ToastOptions, "tone"> = {}) => toast(message, { ...options, tone: "critical" });

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

const ICONS: Record<ToastTone, ReactNode> = {
  neutral: <Info aria-hidden className="text-fg-3" />,
  accent: <Info aria-hidden className="text-accent" />,
  good: <CircleCheck aria-hidden className="text-good" />,
  warning: <TriangleAlert aria-hidden className="text-warning" />,
  critical: <CircleAlert aria-hidden className="text-critical" />,
};

/** ที่แสดง toast — วางครั้งเดียวใน root layout */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  const ref = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  // แสดงเป็น popover (ชั้นบนสุด) เพื่อให้ toast อยู่เหนือหน้าต่าง Dialog ที่เปิดอยู่ด้วย
  useEffect(() => {
    const el = ref.current;
    const grew = list.length > count.current;
    count.current = list.length;
    if (!el || typeof el.showPopover !== "function") return;
    try {
      const isOpen = el.matches(":popover-open");
      if (list.length === 0) {
        if (isOpen) el.hidePopover();
      } else if (!isOpen) {
        el.showPopover();
      } else if (grew && document.querySelector("dialog:modal")) {
        // มี Dialog เปิดทับอยู่ → ยก toast ขึ้นมาไว้บนสุดอีกครั้ง
        el.hidePopover();
        el.showPopover();
      }
    } catch {
      // เบราว์เซอร์เก่าที่ไม่รองรับ popover: แสดงแบบ fixed ธรรมดา
    }
  }, [list]);

  const lastPolite = [...list].reverse().find((t) => t.tone !== "critical");
  const lastCritical = [...list].reverse().find((t) => t.tone === "critical");

  return (
    <>
      {/* ให้โปรแกรมอ่านหน้าจออ่านข้อความ (กล่องนี้มีอยู่ตลอด จึงอ่านได้ทุกครั้ง) */}
      <div className="sr-only" role="status" aria-live="polite">
        {lastPolite ? `${lastPolite.message} ${lastPolite.description ?? ""}` : ""}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive">
        {lastCritical ? `${lastCritical.message} ${lastCritical.description ?? ""}` : ""}
      </div>
      <div
        ref={ref}
        popover="manual"
        className="pointer-events-none fixed inset-x-0 top-[calc(var(--app-topbar-h)+0.5rem)] bottom-auto z-[1000] m-0 flex h-auto w-auto flex-col items-center gap-2 overflow-visible border-0 bg-transparent px-4 text-fg sm:top-auto sm:right-0 sm:bottom-0 sm:left-auto sm:items-end sm:p-6 [&:not(:popover-open)]:hidden"
      >
        {list.map((t) => (
          <ToastView key={t.id} item={t} />
        ))}
      </div>
    </>
  );
}

function ToastView({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => dismissToast(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, paused]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="ui-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface py-3 pr-2 pl-4 text-sm text-fg shadow-lg"
    >
      <span className="mt-0.5 shrink-0 [&_svg]:size-[18px]">{ICONS[item.tone]}</span>
      <div className="min-w-0 flex-1 py-px leading-6">
        <p className="font-medium">{item.message}</p>
        {item.description && <p className="text-fg-2">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="ปิดข้อความแจ้งเตือน"
        className={cx("-my-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg")}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * แสดง toast เมื่อ URL มี ?<param> (เช่น หลัง Server Action redirect ไป "/rules?saved=1")
 * แล้วลบพารามิเตอร์นั้นออกจาก URL (รีเฟรชหน้าแล้วจะไม่ขึ้นซ้ำ)
 * วางไว้ในหน้าได้เลยโดยไม่ต้องเช็กเอง: <ToastOnMount param="saved" message="บันทึกกฎแล้ว" />
 * value: ขึ้นเฉพาะเมื่อค่าตรง เช่น param="done" value="deleted"
 */
export function ToastOnMount(props: { param: string; value?: string; message: string; tone?: ToastTone; description?: string }) {
  return (
    <Suspense fallback={null}>
      <ToastFromParam {...props} />
    </Suspense>
  );
}

function ToastFromParam({
  param,
  value,
  message,
  tone = "good",
  description,
}: {
  param: string;
  value?: string;
  message: string;
  tone?: ToastTone;
  description?: string;
}) {
  const current = useSearchParams().get(param);
  const lastShown = useRef<string | null>(null);

  useEffect(() => {
    if (current === null) {
      lastShown.current = null;
      return;
    }
    if (value !== undefined && current !== value) return;
    if (lastShown.current === current) return; // StrictMode เรียก effect ซ้ำ
    lastShown.current = current;
    toast(message, { tone, description });
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [current, value, param, message, tone, description]);

  return null;
}
