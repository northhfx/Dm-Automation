import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { inboxItems, type InboxItem, type Platform } from "@/db/schema";
import { getConnection, type Connection } from "@/lib/connections";
import { fetchMessengerParticipantName, fetchProfile, getPostInfo } from "@/lib/meta/graph";
import { inboxCutoff } from "./retention";

/*
 * เติมข้อมูลที่ webhook ไม่ได้ส่งมา ให้รายการในหน้าข้อความรอตอบ — ถาม Meta "ตอนเจ้าของร้านเปิดหน้า /inbox"
 * (หน้าเว็บเรียก POST /api/inbox/details หลังแสดงผลแล้ว ชื่อจึงค่อยขึ้นตามมา ไม่ทำให้หน้าช้า)
 * - แชท: ชื่อ (Facebook) / username (Instagram — ใช้ทำลิงก์ ig.me) จากโปรไฟล์ Facebook ดึงไม่ได้ลองห้องแชทของเพจ
 * - คอมเมนต์ Instagram: ลิงก์โพสต์ (permalink)
 * ถามแค่ครั้งเดียวต่อรายการ (details_checked_at) ไม่ว่าจะได้หรือไม่ — Meta ปฏิเสธ/ช้า หน้าเว็บก็ยังใช้ได้
 * ทำไมไม่ถามตอนข้อความเข้า: งานในคิวไม่ต้องรอ Meta เพิ่ม และถามเฉพาะคนที่เจ้าของร้านเปิดดูจริง
 */

/** ถามได้ครั้งละไม่เกินกี่รายการ (หน้าเว็บส่งเฉพาะแถวที่เห็นอยู่) */
export const DETAILS_BATCH_MAX = 30;

/** รายการนี้ยังขาดข้อมูลที่ถาม Meta ได้หรือเปล่า */
export function needsInboxDetails(item: Pick<InboxItem, "kind" | "platform" | "senderName" | "senderUsername" | "postId" | "permalink">): boolean {
  if (item.kind === "dm") return item.platform === "facebook" ? !item.senderName : !item.senderUsername;
  return item.platform === "instagram" && Boolean(item.postId) && !item.permalink;
}

/** ลิงก์โพสต์ไม่เปลี่ยน — จำไว้ในหน่วยความจำ (คอมเมนต์หลายคนบนโพสต์เดียวกันถาม Meta ครั้งเดียว) */
const PERMALINK_TTL_MS = 6 * 60 * 60_000;
const PERMALINK_MAX = 500;
const permalinks = new Map<string, { url: string; expires: number }>();

/** ล้างแคช (ใช้ในเทส) */
export function clearInboxDetailsCache(): void {
  permalinks.clear();
}

async function postPermalink(conn: Connection, postId: string): Promise<string | null> {
  const key = `${conn.platform}:${postId}`;
  const hit = permalinks.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;
  if (!conn.token) return null;
  const info = await getPostInfo(conn.platform, postId, conn.token, conn.api);
  if (!info.permalink) return null;
  if (permalinks.size >= PERMALINK_MAX) {
    const oldest = permalinks.keys().next().value;
    if (oldest !== undefined) permalinks.delete(oldest);
  }
  permalinks.set(key, { url: info.permalink, expires: Date.now() + PERMALINK_TTL_MS });
  return info.permalink;
}

/** ชื่อ / username ของคนทัก — ไม่ได้ก็คืน null (ไม่โยน error) */
async function senderProfile(conn: Connection, senderId: string): Promise<{ name: string | null; username: string | null }> {
  let name: string | null = null;
  let username: string | null = null;
  if (!conn.token) return { name, username };
  try {
    ({ name, username } = await fetchProfile(conn.platform, senderId, conn.token, conn.api));
  } catch (err) {
    console.warn(`[inbox] ดึงโปรไฟล์ ${conn.platform} ไม่สำเร็จ:`, (err as Error).message);
  }
  // Facebook: Meta ให้ดูโปรไฟล์เฉพาะคนที่มีบทบาทในแอป (ก่อนได้ Advanced Access) → ลองชื่อจากห้องแชทของเพจ
  if (!name && conn.platform === "facebook" && conn.api === "facebook") {
    try {
      name = await fetchMessengerParticipantName(conn.id, senderId, conn.token);
    } catch (err) {
      console.warn("[inbox] หาชื่อจากห้องแชทของเพจไม่สำเร็จ:", (err as Error).message);
    }
  }
  return { name: name?.trim() || null, username: username?.trim() || null };
}

/**
 * ถาม Meta หาข้อมูลที่ขาดของรายการ ids (เฉพาะที่ยังไม่เคยถาม และยังไม่หมดอายุ) — คืนจำนวนรายการที่ได้ข้อมูลเพิ่ม
 * แชทของคนเดียวกันถามครั้งเดียว แล้วเติมให้ทุกรายการของคนนั้น
 */
export async function fillInboxDetails(db: Db, ids: number[], now: Date = new Date()): Promise<number> {
  const wanted = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, DETAILS_BATCH_MAX);
  if (wanted.length === 0) return 0;
  // จองก่อนถาม (กันสองแท็บถามซ้ำพร้อมกัน) — แถวที่อีกแท็บจองไปแล้วจะไม่กลับมา
  const claimed = await db
    .update(inboxItems)
    .set({ detailsCheckedAt: now })
    .where(and(inArray(inboxItems.id, wanted), isNull(inboxItems.detailsCheckedAt), gte(inboxItems.createdAt, inboxCutoff(now))))
    .returning();
  const pending = claimed.filter(needsInboxDetails);
  if (pending.length === 0) return 0;

  const connections = new Map<string, Promise<Connection | null>>();
  const connectionOf = (platform: Platform, pageId: string) => {
    const key = `${platform}:${pageId}`;
    let conn = connections.get(key);
    if (!conn) {
      // api ไม่ระบุ: Page ID → เพจ (หรือ Instagram Login ของบัญชีที่ผูกกับเพจ), ไม่ใช่เพจ → บัญชี Instagram Login
      conn = getConnection(db, platform, pageId).catch(() => null);
      connections.set(key, conn);
    }
    return conn;
  };

  const senders = new Map<string, InboxItem>();
  const posts = new Map<string, InboxItem[]>();
  for (const item of pending) {
    if (item.kind === "dm") {
      senders.set(`${item.platform}:${item.pageId}:${item.senderId}`, item);
    } else {
      const key = `${item.platform}:${item.pageId}:${item.postId}`;
      posts.set(key, [...(posts.get(key) ?? []), item]);
    }
  }

  const updated = await Promise.all([
    ...[...senders.values()].map(async (item) => {
      const sender = and(
        eq(inboxItems.platform, item.platform),
        eq(inboxItems.senderId, item.senderId),
        eq(inboxItems.pageId, item.pageId),
        eq(inboxItems.kind, "dm"),
      );
      // ถามแทนทุกข้อความของคนนี้แล้ว — ข้อความเก่าในแถวเดียวกันจะได้ไม่ถูกส่งมาถามซ้ำ (ข้อความใหม่ที่เข้ามาทีหลังค่อยลองอีกครั้ง)
      await db.update(inboxItems).set({ detailsCheckedAt: now }).where(and(sender, isNull(inboxItems.detailsCheckedAt)));
      const conn = await connectionOf(item.platform, item.pageId);
      if (!conn) return 0;
      const { name, username } = await senderProfile(conn, item.senderId);
      if (!name && !username) return 0;
      // ทุกรายการของคนนี้ (รวมข้อความอื่นที่ยังไม่ได้ถาม) — ไม่ทับชื่อที่มีอยู่แล้ว
      const rows = await db
        .update(inboxItems)
        .set({
          senderName: sql`coalesce(${inboxItems.senderName}, ${name})`,
          senderUsername: sql`coalesce(${inboxItems.senderUsername}, ${username})`,
        })
        .where(sender)
        .returning({ id: inboxItems.id });
      return rows.length;
    }),
    ...[...posts.values()].map(async (items) => {
      const conn = await connectionOf(items[0].platform, items[0].pageId);
      if (!conn || !items[0].postId) return 0;
      let permalink: string | null = null;
      try {
        permalink = await postPermalink(conn, items[0].postId);
      } catch (err) {
        console.warn("[inbox] ดึงลิงก์โพสต์ไม่สำเร็จ:", (err as Error).message);
      }
      if (!permalink) return 0;
      const rows = await db
        .update(inboxItems)
        .set({ permalink })
        .where(inArray(inboxItems.id, items.map((i) => i.id)))
        .returning({ id: inboxItems.id });
      return rows.length;
    }),
  ]);
  return updated.reduce((a, b) => a + b, 0);
}
