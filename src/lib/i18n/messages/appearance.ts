import { defineMessages } from "../core";

/**
 * ธีมสี + ภาษา: ปุ่มในแถบด้านซ้าย (components/theme-toggle.tsx, components/language-toggle.tsx)
 * และการ์ด "การแสดงผล" ในหน้าตั้งค่า (settings/appearance-card.tsx)
 */
export const appearanceMessages = defineMessages({
  th: {
    title: "การแสดงผล",
    description: "ธีมสีและภาษาของหน้าจัดการ (จำไว้เฉพาะเบราว์เซอร์นี้)",
    themeLabel: "ธีมสี",
    themeLight: "สว่าง",
    themeDark: "มืด",
    themeSystem: "ตามเครื่อง",
    themeHint: "“ตามเครื่อง” จะสลับสว่าง/มืดเองตามที่ตั้งไว้ในมือถือหรือคอมพิวเตอร์",
    /** เขียนสองภาษา ให้คนที่อ่านภาษาปัจจุบันไม่ออกหาเจอ */
    languageLabel: "ภาษา / Language",
    languageHint: "เปลี่ยนเฉพาะภาษาของหน้าจัดการ — ข้อความที่ระบบส่งหาลูกค้าไม่เปลี่ยนตาม",
    languageSwitching: "กำลังเปลี่ยนภาษา…",
  },
  en: {
    title: "Appearance",
    description: "Color theme and language of this dashboard (saved for this browser only)",
    themeLabel: "Color theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "Auto",
    themeHint: "“Auto” switches between light and dark to match your phone or computer.",
    languageLabel: "Language / ภาษา",
    languageHint: "Changes the dashboard language only — messages sent to your customers stay the same.",
    languageSwitching: "Switching language…",
  },
});
