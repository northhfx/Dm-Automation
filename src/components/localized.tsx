"use client";

import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/core";
import { commonMessages } from "@/lib/i18n/messages/common";
import { navMessages } from "@/lib/i18n/messages/nav";

/*
 * ข้อความเล็กๆ ที่ต้องแปล แต่อยู่ในคอมโพเนนต์ที่เรียก getT()/useT() เองไม่ได้
 * - คอมโพเนนต์กลางใน ui.tsx ถูกเรนเดอร์ได้ทั้งฝั่ง Server และ Client (จึงเป็น async หรือใช้ hook ไม่ได้)
 * - loading.tsx ควรเป็นคอมโพเนนต์ธรรมดาที่แสดงได้ทันที (ไม่ต้องรออ่านคุกกี้)
 * - คอมโพเนนต์ธรรมดา (ไม่ใช่ async) ที่ Server Component เรียก เช่น GuideView
 * → ฝากคำที่ต้องแปลไว้ใน Client Component ตัวเล็กๆ ตรงนี้ (อ่านภาษาจาก I18nProvider ได้ทั้งตอน SSR และในเบราว์เซอร์)
 */

/** "(ไม่บังคับ)" / "(optional)" — ใช้ใน <Field optional> */
export function OptionalMark() {
  return <>{useT(commonMessages)("optional")}</>;
}

/** "กำลังโหลด…" / "Loading…" — ใส่ใน <span className="sr-only"> ของหน้า loading.tsx */
export function LoadingLabel() {
  return <>{useT(commonMessages)("loading")}</>;
}

/**
 * ชื่อเมนูใช้เป็นชื่อหน้า เช่น <PageHeader title={<NavTitle name="contacts" />} />
 * ชื่อหน้าจึงตรงกับเมนูและหัวข้อบนมือถือเสมอ (ภาษาเดียวกัน) แม้เนื้อหาส่วนอื่นของหน้ายังไม่ได้แปล
 */
export function NavTitle({ name }: { name: MessageKey<typeof navMessages> }) {
  return <>{useT(navMessages)(name)}</>;
}
