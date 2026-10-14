import { defineMessages } from "../core";

/** หน้าภาพรวม (/) — src/app/(dashboard)/page.tsx, overview-parts.tsx */
export const dashboardMessages = defineMessages({
  th: {
    // ---- หัวหน้า (ชื่อหน้าอยู่ใน nav: "dashboard") ----
    description: "ผลงานของระบบตอบอัตโนมัติ",
    /** {since} = วันแรกของช่วง เช่น "15 ก.ย." */
    descriptionRange: "ผลงานของระบบตอบอัตโนมัติ {days} วันล่าสุด ({since} – วันนี้)",
    rangeLabel: "ช่วงเวลา",
    rangeDays: "{days} วัน",
  },
  en: {
    description: "How your automations are doing",
    descriptionRange: "How your automations did over the last {days} days ({since} – today)",
    rangeLabel: "Time range",
    rangeDays: "{days} days",
  },
});
