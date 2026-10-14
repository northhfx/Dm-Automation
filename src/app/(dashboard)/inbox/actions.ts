"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { requireAuth } from "@/lib/auth";
import { parseInboxIds, setInboxHandled } from "@/lib/inbox/status";

/*
 * ปุ่มในหน้าข้อความรอตอบ — ฟอร์มส่ง ids = "12,13,14" (ทุกข้อความในแถวนั้น)
 * refresh(): โหลดหน้าใหม่ทั้งหน้า รวมตัวเลขบนเมนูใน layout (layout ไม่โหลดใหม่เองตอนเปลี่ยนหน้า)
 */

/** "เสร็จแล้ว" — คืนจำนวนรายการที่เปลี่ยน */
export async function markInboxDone(formData: FormData): Promise<number> {
  await requireAuth();
  const changed = await setInboxHandled(getDb(), parseInboxIds(formData.get("ids")), true);
  refresh();
  return changed;
}

/** "เลิกทำ" / "ยังไม่เสร็จ" — ย้ายกลับมารอตอบ */
export async function markInboxWaiting(formData: FormData): Promise<number> {
  await requireAuth();
  const changed = await setInboxHandled(getDb(), parseInboxIds(formData.get("ids")), false);
  refresh();
  return changed;
}
