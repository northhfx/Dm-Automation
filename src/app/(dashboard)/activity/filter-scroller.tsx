"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * กล่องเลื่อนซ้าย/ขวาสำหรับแถบตัวกรองบนมือถือ
 * ตอนเปิดหน้า จะเลื่อนให้ตัวกรองที่เลือกอยู่ (aria-current="page") มองเห็นได้เสมอ
 */
export function FilterScroller({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    const active = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !active) return;
    const boxRect = box.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    if (rect.left < boxRect.left || rect.right > boxRect.right) {
      box.scrollLeft += rect.left - boxRect.left - (boxRect.width - rect.width) / 2;
    }
  });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
