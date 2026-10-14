import { and, desc, eq, or, isNotNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contacts, inboxItems, type InboxKind, type Platform } from "@/db/schema";
import { fitText } from "@/lib/flows/types";
import { INBOX_TEXT_MAX } from "./retention";

/*
 * เก็บข้อความที่ไม่ตรงกฎไหนเลยเข้า "ข้อความรอตอบ" (เรียกจาก lib/automation/handlers.ts)
 * - เก็บเฉพาะข้อมูลที่ webhook ส่งมา + ชื่อที่ระบบรู้อยู่แล้ว (ไม่ถาม Meta ตอนนี้ — งานในคิวจะได้ไม่ช้าลง
 *   ชื่อ/username/ลิงก์โพสต์ที่ขาด ค่อยถามตอนเจ้าของร้านเปิดหน้า /inbox ดู lib/inbox/details.ts)
 * - กันซ้ำด้วย unique index (kind, comment_id) / (kind, mid) — ผู้เรียกกันซ้ำด้วย dedup_keys อยู่แล้ว นี่คือชั้นที่สอง
 * - พลาดก็ไม่เป็นไร: ไม่โยน error ออกไป (ข้อความเข้าถูกนับในสถิติไปแล้ว และงานในคิวต้องจบตามปกติ)
 */

export interface InboxCapture {
  platform: Platform;
  /** Connection.id (ค่าเดียวกับ events.page_id) */
  pageId: string;
  kind: InboxKind;
  senderId: string;
  senderName?: string | null;
  senderUsername?: string | null;
  text: string;
  mid?: string | null;
  postId?: string | null;
  commentId?: string | null;
}

/**
 * ชื่อ/username ของคนนี้ที่ระบบรู้อยู่แล้ว (ไม่ต้องถาม Meta):
 * contact (เคยพิมพ์ keyword) หรือรายการรอตอบก่อนหน้าของคนเดียวกัน
 */
async function knownSender(db: Db, platform: Platform, senderId: string): Promise<{ name: string | null; username: string | null }> {
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.platform, platform), eq(contacts.platformUserId, senderId)),
    columns: { name: true, username: true },
  });
  if (contact?.name || contact?.username) return { name: contact.name, username: contact.username };
  const [previous] = await db
    .select({ name: inboxItems.senderName, username: inboxItems.senderUsername })
    .from(inboxItems)
    .where(
      and(
        eq(inboxItems.platform, platform),
        eq(inboxItems.senderId, senderId),
        or(isNotNull(inboxItems.senderName), isNotNull(inboxItems.senderUsername)),
      ),
    )
    .orderBy(desc(inboxItems.id))
    .limit(1);
  return { name: previous?.name ?? null, username: previous?.username ?? null };
}

/** บันทึกเข้าข้อความรอตอบ — คืน true ถ้าเพิ่มแถวใหม่ (false = ซ้ำ หรือบันทึกไม่สำเร็จ) */
export async function captureInboxItem(db: Db, item: InboxCapture): Promise<boolean> {
  try {
    let name = item.senderName?.trim() || null;
    let username = item.senderUsername?.trim() || null;
    // ถามเฉพาะเมื่อ webhook ไม่ได้บอกชื่อมาเลย (แชท) — คอมเมนต์มีชื่อหรือ username มากับ webhook อยู่แล้ว
    if (!name && !username) {
      const known = await knownSender(db, item.platform, item.senderId);
      name ??= known.name;
      username ??= known.username;
    }
    const rows = await db
      .insert(inboxItems)
      .values({
        platform: item.platform,
        pageId: item.pageId,
        kind: item.kind,
        senderId: item.senderId,
        senderName: name,
        senderUsername: username,
        // ตัดไม่เกิน INBOX_TEXT_MAX ตัวอักษร (ไม่ตัดกลางอีโมจิ)
        text: fitText(item.text ?? "", INBOX_TEXT_MAX),
        mid: item.kind === "dm" ? (item.mid ?? null) : null,
        postId: item.postId ?? null,
        commentId: item.kind === "comment" ? (item.commentId ?? null) : null,
      })
      .onConflictDoNothing()
      .returning({ id: inboxItems.id });
    return rows.length > 0;
  } catch (err) {
    console.error("[inbox] บันทึกข้อความรอตอบไม่สำเร็จ:", err);
    return false;
  }
}
