import type { InboxKind, Platform } from "@/db/schema";

/*
 * ลิงก์ "ตอบ" ของแต่ละรายการในหน้าข้อความรอตอบ — เปิดที่ที่เจ้าของร้านตอบได้ทันที (แท็บใหม่)
 * ฟังก์ชันล้วน (ไม่ยิง API) ใช้ได้ทั้งฝั่ง Server และในเทส
 *
 * - แชท Facebook   → ห้องแชทนั้นใน Meta Business Suite (แบบเดียวกับปุ่ม "เปิดแชท" ในหน้ารายชื่อลูกค้า)
 * - แชท Instagram  → https://ig.me/m/<username> เปิดห้องแชทในแอป Instagram (Meta: ใช้บนเว็บ instagram.com ไม่ได้)
 *                    คอมพิวเตอร์ (เมาส์) จึงใช้หน้าโปรไฟล์แทน แล้วกด "ส่งข้อความ" · ไม่รู้ username → กล่องข้อความ Instagram
 * - คอมเมนต์ Facebook  → โพสต์ + ?comment_id= (Facebook เลื่อนไปที่คอมเมนต์นั้นให้) สร้างจาก id ใน webhook ไม่ต้องถาม Meta
 * - คอมเมนต์ Instagram → ลิงก์โพสต์จาก Meta (permalink) · ยังไม่รู้ → กล่องข้อความใน Meta Business Suite
 */

export interface InboxLinkInput {
  platform: Platform;
  kind: InboxKind;
  /** Connection.id: Page ID หรือ IG account ID (Instagram Login) */
  pageId: string;
  senderId: string;
  senderUsername: string | null;
  postId: string | null;
  commentId: string | null;
  permalink: string | null;
}

/** ข้อความอธิบายลิงก์ (key ใน inboxMessages) */
export type ReplyHint =
  | "replyHintMessenger"
  | "replyHintInstagramChat"
  | "replyHintInstagramProfile"
  | "replyHintInstagramInbox"
  | "replyHintFacebookComment"
  | "replyHintInstagramComment"
  | "replyHintBusinessSuite";

export interface ReplyLink {
  href: string;
  /** ลิงก์สำหรับเครื่องที่ใช้เมาส์ (คอมพิวเตอร์) เมื่อ href เปิดบนเว็บไม่ได้ — มาคู่กับ desktopHint */
  desktopHref?: string;
  desktopHint?: ReplyHint;
  /** แอปปลายทาง (ใช้ในคำอธิบายสำหรับโปรแกรมอ่านหน้าจอ — ไม่แปล) */
  where: "Meta Business Suite" | "Instagram" | "Facebook";
  hint: ReplyHint;
}

const BUSINESS_INBOX = "https://business.facebook.com/latest/inbox/all";

/** ห้องแชท Messenger ของเพจใน Meta Business Suite */
export function businessSuiteThreadUrl(pageId: string, psid: string): string {
  const url = new URL(BUSINESS_INBOX);
  url.searchParams.set("asset_id", pageId);
  url.searchParams.set("mailbox_id", pageId);
  url.searchParams.set("selected_item_id", psid);
  url.searchParams.set("thread_type", "FB_MESSAGE");
  return url.toString();
}

/** โพสต์ Facebook จาก post_id ใน webhook ("<page id>_<post id>") */
export function facebookPostUrl(postId: string): string {
  const m = /^(\d+)_(\d+)$/.exec(postId);
  return m ? `https://www.facebook.com/${m[1]}/posts/${m[2]}` : `https://www.facebook.com/${encodeURIComponent(postId)}`;
}

/** คอมเมนต์บนโพสต์ Facebook — comment_id ใน webhook เป็น "<post id>_<comment id>" ส่วนท้ายคือ id ที่ Facebook ใช้ใน URL */
export function facebookCommentUrl(postId: string, commentId: string): string {
  const url = new URL(facebookPostUrl(postId));
  url.searchParams.set("comment_id", commentId.split("_").pop() || commentId);
  return url.toString();
}

/** ลิงก์โพสต์ที่คอมเมนต์ (ปุ่มเล็ก "บนโพสต์") — null = ไม่รู้ */
export function inboxPostUrl(item: InboxLinkInput): string | null {
  if (item.kind !== "comment") return null;
  if (item.permalink) return item.permalink;
  return item.platform === "facebook" && item.postId ? facebookPostUrl(item.postId) : null;
}

/**
 * ลิงก์ปุ่ม "ตอบ"
 * facebookPageIds = เพจที่เชื่อมไว้ (ใช้เลือกเพจใน Meta Business Suite ให้ตรง — บัญชี Instagram Login ไม่มีเพจ)
 */
export function inboxReplyLink(item: InboxLinkInput, facebookPageIds: ReadonlySet<string> = new Set()): ReplyLink {
  if (item.kind === "dm") {
    if (item.platform === "facebook") {
      return { href: businessSuiteThreadUrl(item.pageId, item.senderId), where: "Meta Business Suite", hint: "replyHintMessenger" };
    }
    if (item.senderUsername) {
      const username = encodeURIComponent(item.senderUsername);
      return {
        href: `https://ig.me/m/${username}`,
        desktopHref: `https://www.instagram.com/${username}/`,
        where: "Instagram",
        hint: "replyHintInstagramChat",
        desktopHint: "replyHintInstagramProfile",
      };
    }
    return { href: "https://www.instagram.com/direct/inbox/", where: "Instagram", hint: "replyHintInstagramInbox" };
  }

  if (item.platform === "facebook" && item.postId) {
    return {
      href: item.commentId ? facebookCommentUrl(item.postId, item.commentId) : facebookPostUrl(item.postId),
      where: "Facebook",
      hint: "replyHintFacebookComment",
    };
  }
  if (item.platform === "instagram" && item.permalink) {
    return { href: item.permalink, where: "Instagram", hint: "replyHintInstagramComment" };
  }
  const url = new URL(BUSINESS_INBOX);
  if (facebookPageIds.has(item.pageId)) url.searchParams.set("asset_id", item.pageId);
  return { href: url.toString(), where: "Meta Business Suite", hint: "replyHintBusinessSuite" };
}
