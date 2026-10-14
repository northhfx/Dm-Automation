"use client";

import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/core";
import { rulesMessages } from "@/lib/i18n/messages/rules";

/**
 * ข้อความหนึ่งข้อความจากหมวด rules สำหรับที่ที่เรียก getT()/useT() เองไม่ได้
 * เช่น loading.tsx (ควรแสดงได้ทันทีโดยไม่ต้องรออ่านคุกกี้) — อ่านภาษาจาก I18nProvider
 */
export function RulesText({ id }: { id: MessageKey<typeof rulesMessages> }) {
  return <>{useT(rulesMessages)(id)}</>;
}
