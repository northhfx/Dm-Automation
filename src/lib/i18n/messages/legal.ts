import { defineMessages } from "../core";

/*
 * หน้านโยบายความเป็นส่วนตัว / การลบข้อมูล (/privacy, /data-deletion) — src/components/legal-page.tsx
 * หน้าสาธารณะ (ผู้ตรวจของ Meta เปิดอ่านได้) ภาษาตามคุกกี้ "lang" เหมือนหน้าอื่น — ไม่มีคุกกี้ = ไทย
 * ภาษาอังกฤษต้องแปลตรงตามภาษาไทย (เป็นเอกสารนโยบาย ห้ามเพิ่ม/ลดเนื้อหาในภาษาเดียว)
 */
export const legalMessages = defineMessages({
  th: {
    // ---- ส่วนกลางของหน้าเอกสาร (components/legal-page.tsx) ----
    backHome: "กลับหน้าหลัก",
    relatedDocs: "เอกสารที่เกี่ยวข้อง",
    navPrivacy: "นโยบายความเป็นส่วนตัว",
    navDataDeletion: "การลบข้อมูล",

    // ---- /privacy ----
    privacyTitle: "นโยบายความเป็นส่วนตัว",
    /** {business} เมื่อไม่ได้ตั้ง BUSINESS_NAME */
    privacyBusinessFallback: "ผู้ให้บริการเพจ",
    privacyIntro:
      '{business} ("เรา") ใช้ระบบนี้เพื่อตอบคอมเมนต์และข้อความบน Facebook และ Instagram ของเราโดยอัตโนมัติ นโยบายนี้อธิบายว่าเราเก็บและใช้ข้อมูลของคุณอย่างไร',
    privacyCollectHeading: "ข้อมูลที่เราเก็บ",
    privacyCollectProfile: "ชื่อ, ชื่อผู้ใช้ และรหัสผู้ใช้ที่ Facebook/Instagram ส่งให้เรา เมื่อคุณคอมเมนต์หรือส่งข้อความถึงเพจ",
    privacyCollectMessages: "ข้อความในคอมเมนต์หรือแชทที่คุณส่งถึงเพจ",
    privacyCollectClicks: "ข้อมูลการกดลิงก์ที่เราส่งให้ (จำนวนครั้งและเวลา)",
    privacyUseHeading: "เราใช้ข้อมูลเพื่อ",
    privacyUseReply: "ตอบคอมเมนต์และส่งข้อมูลที่คุณขอทางข้อความ",
    privacyUseStats: "ดูสถิติภาพรวม เช่น จำนวนข้อความที่ส่งและอัตราการคลิก เพื่อปรับปรุงการบริการ",
    privacySharing:
      "เราไม่ขายหรือเปิดเผยข้อมูลของคุณให้บุคคลภายนอก นอกจากผู้ให้บริการที่จำเป็นต่อการทำงานของระบบ (เช่น ผู้ให้บริการเซิร์ฟเวอร์)",
    privacyRetentionHeading: "การเก็บรักษาและการลบข้อมูล",
    /** {link} = ลิงก์ privacyRetentionLink ไปหน้าการลบข้อมูล */
    privacyRetention: "ข้อมูลจะถูกเก็บไว้ตราบเท่าที่จำเป็นต่อการให้บริการ คุณสามารถขอลบข้อมูลได้ตามขั้นตอนใน {link}",
    privacyRetentionLink: "หน้าการลบข้อมูล",
    privacyContactHeading: "ติดต่อเรา",
    /** ไม่ได้ตั้ง CONTACT_EMAIL */
    privacyContact: "ส่งข้อความหาเพจของเราโดยตรง",
    /** {email} = ลิงก์อีเมลจาก CONTACT_EMAIL */
    privacyContactEmail: "ส่งข้อความหาเพจของเราโดยตรง หรืออีเมล {email}",

    // ---- /data-deletion (ใช้กรอกช่อง Data Deletion Instructions URL ใน Meta App) ----
    deletionTitle: "การขอลบข้อมูล",
    /** ชื่อแท็บของเบราว์เซอร์ */
    deletionMetaTitle: "การลบข้อมูลผู้ใช้",
    deletionHowHeading: "วิธีขอลบข้อมูล",
    deletionHowIntro: "หากต้องการให้เราลบข้อมูลของคุณที่ได้รับผ่าน Facebook หรือ Instagram ทำได้ดังนี้",
    /** {phrase} = deletionHowPhrase (ตัวหนา) */
    deletionHowMessage: "ส่งข้อความถึงเพจของเราว่า {phrase} พร้อมชื่อบัญชีของคุณ",
    deletionHowPhrase: '"ขอลบข้อมูล"',
    /** {email} = ลิงก์อีเมลจาก CONTACT_EMAIL (แสดงเมื่อตั้งไว้) */
    deletionHowEmail: "หรือส่งอีเมลมาที่ {email}",
    deletionWhatHeading: "สิ่งที่เราจะลบ",
    deletionWhat:
      "เราจะลบชื่อ รหัสผู้ใช้ ประวัติข้อความ และข้อมูลการคลิกลิงก์ของคุณออกจากระบบภายใน 30 วัน และแจ้งกลับเมื่อดำเนินการเสร็จ",
    deletionSelfHeading: "ถอนสิทธิ์ของแอปด้วยตัวเอง",
    /** {settings} → {apps} → {select} → {remove} = เมนูใน Facebook (ตัวหนา) */
    deletionSelf: "คุณยังสามารถถอนสิทธิ์การเข้าถึงของแอปได้เองที่ Facebook: {settings} → {apps} → {select} → {remove}",
    deletionSelfSettings: "การตั้งค่า",
    deletionSelfApps: "แอปและเว็บไซต์",
    deletionSelfSelect: "เลือกแอปนี้",
    deletionSelfRemove: "ลบ",
  },
  en: {
    backHome: "Back to home",
    relatedDocs: "Related documents",
    navPrivacy: "Privacy Policy",
    navDataDeletion: "Data Deletion",

    privacyTitle: "Privacy Policy",
    privacyBusinessFallback: "The operator of this Page",
    privacyIntro:
      '{business} ("we") uses this system to automatically reply to comments and messages on our Facebook and Instagram accounts. This policy explains how we collect and use your information.',
    privacyCollectHeading: "Information we collect",
    privacyCollectProfile:
      "Your name, username, and user ID, which Facebook/Instagram share with us when you comment on or send a message to our Page",
    privacyCollectMessages: "The comments and chat messages you send to our Page",
    privacyCollectClicks: "Clicks on the links we send you (how many times and when)",
    privacyUseHeading: "How we use your information",
    privacyUseReply: "To reply to your comments and send you the information you ask for by message",
    privacyUseStats: "To review overall statistics, such as the number of messages sent and click rates, so we can improve our service",
    privacySharing:
      "We do not sell or disclose your information to third parties, except to service providers that the system needs in order to work (such as our server provider).",
    privacyRetentionHeading: "Data retention and deletion",
    privacyRetention:
      "We keep your information only as long as we need it to provide our service. You can ask us to delete your information by following the steps on our {link}.",
    privacyRetentionLink: "Data Deletion page",
    privacyContactHeading: "Contact us",
    privacyContact: "Send a message to our Page directly.",
    privacyContactEmail: "Send a message to our Page directly, or email {email}.",

    deletionTitle: "Data Deletion Instructions",
    deletionMetaTitle: "User Data Deletion",
    deletionHowHeading: "How to request deletion",
    deletionHowIntro: "If you want us to delete your information that we received through Facebook or Instagram, you can:",
    deletionHowMessage: "Send our Page a message saying {phrase}, along with your account name.",
    deletionHowPhrase: '"Delete my data"',
    deletionHowEmail: "Or email us at {email}.",
    deletionWhatHeading: "What we delete",
    deletionWhat:
      "We will delete your name, user ID, message history, and link-click data from our system within 30 days, and let you know once it's done.",
    deletionSelfHeading: "Remove the app's access yourself",
    deletionSelf: "You can also remove the app's access yourself on Facebook: {settings} → {apps} → {select} → {remove}",
    deletionSelfSettings: "Settings",
    deletionSelfApps: "Apps and websites",
    deletionSelfSelect: "Select this app",
    deletionSelfRemove: "Remove",
  },
});
