"use client";

import { unstable_rethrow } from "next/navigation";
import { toast } from "./toast";

/*
 * ตัวช่วยเรียก Server Action จากคอมโพเนนต์ฝั่ง Client พร้อม toast แจ้งผล
 * ใช้ภายในโดย ActionButton, ActionSwitch, ConfirmSubmit, MenuItem
 */

/** Server Action ที่รับ FormData เช่น toggleRule, deleteRule */
export type FormAction = (formData: FormData) => unknown;

/** ค่าที่ส่งไปกับ action เป็น hidden input เช่น { id: rule.id } */
export type ActionFields = Record<string, string | number | boolean | null | undefined>;

export function toFormData(fields?: ActionFields): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields ?? {})) if (v !== null && v !== undefined) fd.append(k, String(v));
  return fd;
}

export function HiddenFields({ fields }: { fields?: ActionFields }) {
  return (
    <>
      {Object.entries(fields ?? {}).map(([k, v]) =>
        v === null || v === undefined ? null : <input key={k} type="hidden" name={k} value={String(v)} />,
      )}
    </>
  );
}

/**
 * เรียกงาน แล้วแสดง toast สำเร็จ/ไม่สำเร็จ — คืน true เมื่อสำเร็จ
 * ถ้า action redirect() ไปหน้าอื่น ถือว่าสำเร็จ (แสดง toast แล้วปล่อยให้ Next.js ย้ายหน้า)
 */
export async function runAction(run: () => unknown, messages: { success?: string; error?: string } = {}): Promise<boolean> {
  try {
    await run();
  } catch (err) {
    try {
      unstable_rethrow(err);
    } catch (navigation) {
      if (messages.success) toast(messages.success, { tone: "good" });
      throw navigation;
    }
    console.error(err);
    toast(messages.error ?? "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง", { tone: "critical" });
    return false;
  }
  if (messages.success) toast(messages.success, { tone: "good" });
  return true;
}
