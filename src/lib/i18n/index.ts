/*
 * ส่วนของระบบแปลภาษาที่ใช้ได้ทุกที่ (Server / Client / ฟังก์ชันธรรมดา / เทส)
 * - ฝั่งเซิร์ฟเวอร์: getT / getFormat / getLocale อยู่ใน "@/lib/i18n/server"
 * - ฝั่ง Client:     useT / useFormat / useLocale / I18nProvider อยู่ใน "@/lib/i18n/client"
 * - ข้อความ:         "@/lib/i18n/messages/<หมวด>"
 * - ข้อความที่โค้ดเบื้องหลังสร้าง/เก็บลงฐานข้อมูล (error, lastError ฯลฯ): systemMessage / localizeSystemMessage ใน "@/lib/i18n/system"
 * วิธีใช้ทั้งหมด: CONVENTIONS ของทีม (ดูหัวไฟล์ core.ts)
 */
export * from "./locale";
export * from "./core";
export * from "./format";
