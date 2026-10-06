import { PAGE_WEBHOOK_FIELDS } from "./graph";

/** ค่าที่ผู้ใช้ต้องคัดลอกไปใส่ในเว็บ Meta (ใช้ทั้งหน้าคู่มือและหน้าตั้งค่า) */

export { PAGE_WEBHOOK_FIELDS };

export const INSTAGRAM_WEBHOOK_FIELDS = ["comments", "messages", "messaging_postbacks", "messaging_seen"];

export const REQUIRED_PERMISSIONS = [
  "pages_show_list",
  "pages_manage_metadata",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_engagement",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "business_management",
];

/** ตัวอย่างคำอธิบายสำหรับยื่น App Review (Meta ตรวจเป็นภาษาอังกฤษ) */
export const APP_REVIEW_TEXTS: { permission: string; text: string }[] = [
  {
    permission: "pages_messaging",
    text: "Our app automatically replies to people who message our own Facebook Page or comment on its posts with a keyword, sending them the product information they asked for.",
  },
  {
    permission: "pages_manage_metadata",
    text: "Used to subscribe our own Page to webhooks so the app is notified when new comments and messages arrive.",
  },
  {
    permission: "pages_read_engagement",
    text: "Used to read our Page's posts and comments so the page owner can choose which posts the automation applies to and the app can check comments for keywords.",
  },
  {
    permission: "pages_read_user_content",
    text: "Used to read comments that people leave on our Page's posts to check whether they contain a keyword requesting information.",
  },
  {
    permission: "pages_manage_engagement",
    text: "Used to reply publicly to a customer's comment to let them know we have sent the requested information by private message.",
  },
  {
    permission: "pages_show_list",
    text: "Used to let the page owner choose which of their Pages to connect to the automation.",
  },
  {
    permission: "instagram_basic",
    text: "Used to read our Instagram professional account profile and recent posts so the owner can choose which posts the automation applies to.",
  },
  {
    permission: "instagram_manage_comments",
    text: "Used to receive comments on our own Instagram posts and reply to comments that contain a keyword.",
  },
  {
    permission: "instagram_manage_messages",
    text: "Used to send a private reply to a person who commented a keyword on our post, and to auto-reply to direct messages that contain a keyword, with the information they requested.",
  },
  {
    permission: "business_management",
    text: "Used to access the Page and Instagram account that are owned by our Business portfolio so they can be connected to the automation.",
  },
];
