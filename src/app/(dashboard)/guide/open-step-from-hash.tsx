"use client";

import { useEffect } from "react";

/** hash ที่หน้าคู่มือรู้จัก: การ์ดของขั้น (#step-5) หรือจุดในขั้นนั้น (#step-5-token) */
const STEP_HASH = /^step-\d+(?:-[a-z0-9-]+)?$/;

/**
 * เปิดการ์ดที่พับอยู่จาก hash แล้วเลื่อนไปที่จุดนั้น
 * - #step-N → เปิด <details> ในการ์ดของขั้นนั้น
 * - #step-N-xxx (จุดในขั้น เช่น ข้อย่อยที่ 7) → เปิด <details> ทุกชั้นที่ครอบจุดนั้นอยู่
 */
export function openStepFromHash(hash: string, doc: Pick<Document, "getElementById"> = document): boolean {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!STEP_HASH.test(id)) return false;
  const target = doc.getElementById(id);
  if (!target) return false;
  let opened = false;
  const inner = target.querySelector("details");
  if (inner && !inner.open && /^step-\d+$/.test(id)) {
    inner.open = true;
    opened = true;
  }
  for (let d = target.closest("details"); d; d = d.parentElement?.closest("details") ?? null) {
    if (!d.open) {
      d.open = true;
      opened = true;
    }
  }
  return opened;
}

/**
 * ลิงก์ไปขั้นที่เสร็จแล้ว (เช่น /guide#step-5 หรือ /guide#step-5-token จากหน้าตั้งค่า) → เปิดการ์ดที่พับไว้ให้เลย
 * เบราว์เซอร์ไม่เปิด <details> ให้เองเมื่อลิงก์ชี้ที่ตัวการ์ด ผู้ใช้จะเห็นแค่หัวการ์ดแล้วไม่รู้ว่าต้องกดเปิด
 * (จุดที่อยู่ในการ์ดที่พับไว้ เบราว์เซอร์เลื่อนไปไม่ถูก → เปิดแล้วเลื่อนให้เอง)
 */
export function OpenStepFromHash() {
  useEffect(() => {
    const open = (hash: string) => {
      if (!openStepFromHash(hash)) return;
      const id = decodeURIComponent(hash.replace(/^#/, ""));
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    const onHash = () => open(window.location.hash);
    // กดลิงก์ #step-N ซ้ำตอนที่ hash เป็นค่าเดิมอยู่แล้วจะไม่มี hashchange → ดักการคลิกด้วย
    const onClick = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest('a[href^="#step-"]') : null;
      if (link) open(link.getAttribute("href") ?? "");
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
