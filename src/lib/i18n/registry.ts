import type { Catalog, MessageKey, Messages } from "./core";
import { activityMessages } from "./messages/activity";
import { appearanceMessages } from "./messages/appearance";
import { authMessages } from "./messages/auth";
import { builderMessages } from "./messages/builder";
import { commonMessages } from "./messages/common";
import { contactsMessages } from "./messages/contacts";
import { dashboardMessages } from "./messages/dashboard";
import { guideMessages } from "./messages/guide";
import { inboxMessages } from "./messages/inbox";
import { legalMessages } from "./messages/legal";
import { navMessages } from "./messages/nav";
import { rulesMessages } from "./messages/rules";
import { settingsMessages } from "./messages/settings";
import { shellMessages } from "./messages/shell";

/*
 * รวมทุกหมวด (namespace) ไว้ที่เดียว — ใช้ฝั่งเซิร์ฟเวอร์ (getT("nav")) และในเทสที่ตรวจว่าแปลครบ
 * ห้าม import ไฟล์นี้ใน Client Component: จะดึงข้อความทุกหน้าไปไว้ในเบราว์เซอร์ (ใช้ useT(navMessages) แทน)
 * เพิ่มหมวดใหม่: สร้าง messages/<หมวด>.ts แล้วเพิ่มบรรทัดในรายการนี้ (เรียงตามตัวอักษร)
 */
export const catalogs = {
  activity: activityMessages,
  appearance: appearanceMessages,
  auth: authMessages,
  builder: builderMessages,
  common: commonMessages,
  contacts: contactsMessages,
  dashboard: dashboardMessages,
  guide: guideMessages,
  inbox: inboxMessages,
  legal: legalMessages,
  nav: navMessages,
  rules: rulesMessages,
  settings: settingsMessages,
  shell: shellMessages,
} as const;

export type Namespace = keyof typeof catalogs;

/** key ของหมวด เช่น KeyOf<"nav"> = "dashboard" | "automation" | ... */
export type KeyOf<N extends Namespace> = MessageKey<(typeof catalogs)[N]>;

/** key แบบเต็ม "<หมวด>.<key>" ของทุกหมวด (ใช้กับ getT() ที่ไม่ระบุหมวด) */
export type AnyKey = { [N in Namespace]: `${N}.${KeyOf<N>}` }[Namespace];

let merged: Catalog<Record<AnyKey, string>> | undefined;

/** ทุกหมวดรวมเป็นหมวดเดียว key = "<หมวด>.<key>" เช่น "nav.dashboard" (สร้างครั้งแรกที่เรียก) */
export function mergedCatalog(): Catalog<Record<AnyKey, string>> {
  if (!merged) {
    const th: Messages = {};
    const en: Messages = {};
    for (const [ns, catalog] of Object.entries(catalogs) as [Namespace, Catalog][]) {
      for (const [key, value] of Object.entries(catalog.th)) th[`${ns}.${key}`] = value;
      for (const [key, value] of Object.entries(catalog.en)) en[`${ns}.${key}`] = value;
    }
    merged = { th, en } as unknown as Catalog<Record<AnyKey, string>>;
  }
  return merged;
}
