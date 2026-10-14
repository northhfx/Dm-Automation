import { defineMessages } from "../core";

/**
 * ชื่อเมนูหลัก (แถบด้านซ้าย / หัวข้อบนมือถือ) — ใช้เป็นชื่อหน้าได้ด้วย เช่น <PageHeader title={t("contacts")} />
 * ชื่อภาษาอังกฤษตามที่เจ้าของร้านกำหนด: Dashboard, Automation, New Automation, Contacts, Activity
 */
export const navMessages = defineMessages({
  th: {
    mainMenu: "เมนูหลัก",
    dashboard: "ภาพรวม",
    automation: "กฎอัตโนมัติ",
    contacts: "รายชื่อลูกค้า",
    inbox: "ข้อความรอตอบ",
    activity: "กิจกรรม",
    groupSystem: "ระบบ",
    guide: "คู่มือตั้งค่า",
    settings: "ตั้งค่า",
    /** สำหรับโปรแกรมอ่านหน้าจอ ต่อท้ายตัวเลขบนเมนู "ข้อความรอตอบ" */
    inboxWaiting: "รอตอบ {count} รายการ",
  },
  en: {
    mainMenu: "Main menu",
    dashboard: "Dashboard",
    automation: "Automation",
    contacts: "Contacts",
    inbox: "Inbox",
    activity: "Activity",
    groupSystem: "System",
    guide: "Setup guide",
    settings: "Settings",
    inboxWaiting: "Waiting for a reply: {count}",
  },
});
