import type { Platform } from "@/db/schema";

/**
 * แปลง webhook payload จาก Meta ให้เป็นงาน (job) ที่ระบบเข้าใจ
 * แยกเป็นฟังก์ชันล้วนๆ เพื่อให้ทดสอบได้ง่าย
 */

export interface CommentJob {
  type: "comment";
  platform: Platform;
  /** Facebook = Page ID, Instagram = IG User ID */
  accountId: string;
  commentId: string;
  postId: string | null;
  parentId: string | null;
  text: string;
  fromId: string;
  fromName: string | null;
}

export interface DmJob {
  type: "dm";
  platform: Platform;
  accountId: string;
  senderId: string;
  mid: string;
  text: string;
  /** payload จากการกดปุ่ม/quick reply (ถ้ามี) */
  payload: string | null;
}

export interface ReadJob {
  type: "read";
  platform: Platform;
  accountId: string;
  senderId: string;
  /** Messenger บอกเวลาที่อ่านถึง (ms) */
  watermark: number | null;
  /** Instagram บอก message id ที่อ่านแล้ว */
  mid: string | null;
}

/** เพจลงโพสต์ใหม่บน Facebook (ใช้ผูกกฎ "โพสต์ถัดไป" ทันที — Instagram ไม่มี webhook แบบนี้) */
export interface PagePostJob {
  type: "page_post";
  platform: "facebook";
  accountId: string;
  postId: string;
  /** เวลาที่ลงโพสต์ (ms) ตามที่ Meta ส่งมา */
  createdTime: number | null;
  caption: string;
}

export type WebhookJob = CommentJob | DmJob | ReadJob | PagePostJob;

/** ประเภทโพสต์ใน webhook feed ที่นับว่าเป็น "โพสต์/รีลใหม่ของเพจ" */
const PAGE_POST_ITEMS = new Set(["status", "photo", "video", "post", "share", "reel"]);

/* eslint-disable @typescript-eslint/no-explicit-any -- payload จากภายนอก ตรวจทีละ field เอง */

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : typeof v === "number" ? String(v) : null;
}

export function parseWebhook(body: any): WebhookJob[] {
  const jobs: WebhookJob[] = [];
  const object = body?.object;
  if (object !== "page" && object !== "instagram") return jobs;
  const platform: Platform = object === "page" ? "facebook" : "instagram";

  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    const accountId = str(entry?.id);
    if (!accountId) continue;

    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      const job = parseChange(platform, accountId, change);
      if (job) jobs.push(job);
    }

    for (const event of Array.isArray(entry.messaging) ? entry.messaging : []) {
      const job = parseMessaging(platform, accountId, event);
      if (job) jobs.push(job);
    }
  }
  return jobs;
}

function parseChange(platform: Platform, accountId: string, change: any): CommentJob | PagePostJob | null {
  const v = change?.value;
  if (!v) return null;

  if (platform === "facebook" && change.field === "feed") {
    if (v.item !== "comment") return parsePagePost(accountId, v);
    if (v.verb !== "add") return null;
    const commentId = str(v.comment_id);
    const fromId = str(v.from?.id);
    if (!commentId || !fromId) return null;
    // คอมเมนต์ที่เพจตอบเอง → ไม่ต้องประมวลผล (กันวนลูป)
    if (fromId === accountId) return null;
    return {
      type: "comment",
      platform,
      accountId,
      commentId,
      postId: str(v.post_id),
      parentId: str(v.parent_id),
      text: typeof v.message === "string" ? v.message : "",
      fromId,
      fromName: str(v.from?.name),
    };
  }

  if (platform === "instagram" && change.field === "comments") {
    const commentId = str(v.id);
    const fromId = str(v.from?.id);
    if (!commentId || !fromId) return null;
    if (fromId === accountId) return null;
    return {
      type: "comment",
      platform,
      accountId,
      commentId,
      postId: str(v.media?.id),
      parentId: str(v.parent_id),
      text: typeof v.text === "string" ? v.text : "",
      fromId,
      fromName: str(v.from?.username),
    };
  }

  return null;
}

/** โพสต์ใหม่ที่เพจลงเอง (โพสต์ของคนอื่นบนหน้าเพจ และโพสต์ที่ยังไม่เผยแพร่/ตั้งเวลาไว้ → ข้าม) */
function parsePagePost(accountId: string, v: any): PagePostJob | null {
  if (v.verb !== "add" || !PAGE_POST_ITEMS.has(v.item)) return null;
  if (str(v.from?.id) !== accountId) return null;
  if (v.published === 0 || v.published === "0" || v.published === false) return null;
  const postId = str(v.post_id);
  if (!postId) return null;
  const created = typeof v.created_time === "number" ? v.created_time * 1000 : null;
  return {
    type: "page_post",
    platform: "facebook",
    accountId,
    postId,
    createdTime: created,
    caption: typeof v.message === "string" ? v.message : "",
  };
}

function parseMessaging(platform: Platform, accountId: string, event: any): DmJob | ReadJob | null {
  const senderId = str(event?.sender?.id);
  if (!senderId || senderId === accountId) return null;

  if (event.read) {
    return {
      type: "read",
      platform,
      accountId,
      senderId,
      watermark: typeof event.read.watermark === "number" ? event.read.watermark : null,
      mid: str(event.read.mid),
    };
  }

  if (event.message) {
    const m = event.message;
    if (m.is_echo || m.is_deleted) return null;
    const mid = str(m.mid);
    if (!mid) return null;
    return {
      type: "dm",
      platform,
      accountId,
      senderId,
      mid,
      text: typeof m.text === "string" ? m.text : "",
      payload: str(m.quick_reply?.payload),
    };
  }

  if (event.postback) {
    const p = event.postback;
    const mid = str(p.mid) ?? `postback:${senderId}:${event.timestamp ?? Date.now()}`;
    return {
      type: "dm",
      platform,
      accountId,
      senderId,
      mid,
      text: typeof p.title === "string" ? p.title : "",
      payload: str(p.payload),
    };
  }

  return null;
}
