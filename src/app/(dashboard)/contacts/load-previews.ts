import { and, desc, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { events } from "@/db/schema";
import { fitText } from "@/lib/flows/types";

/** ข้อความล่าสุดที่ลูกค้าพิมพ์มา (แสดงแทนชื่อเมื่อ Meta ไม่ให้ชื่อ) */
export interface Preview {
  text: string;
  via: "comment" | "dm";
}

/**
 * เหตุการณ์ที่ผูกกับ contact และเก็บข้อความที่ลูกค้าพิมพ์มาเอง
 * - dm_received: DM ที่ตรง keyword
 * - rule_triggered: DM หรือคอมเมนต์ที่ตรงกฎ (คอมเมนต์ผูกกับ contact ตอนส่ง Private Reply สำเร็จ — meta.trigger = "comment")
 * comment_received ไม่อยู่ในนี้: ไม่เคยมี contact_id (ตอนคอมเมนต์เข้ามายังไม่รู้ว่าเป็นใครใน Messenger/Instagram DM)
 */
export const PREVIEW_EVENT_TYPES = ["dm_received", "rule_triggered"] as const;
const PREVIEW_MAX = 60;

/**
 * คำสั่งดึงข้อความล่าสุดของลูกค้าแต่ละคน (แยกออกมาให้เทสดูแผนการค้นหาได้)
 * ใช้ index events_contact_created_idx (contact_id, created_at) อ่านเฉพาะกิจกรรมของลูกค้าในหน้านี้ ไม่ไล่ทั้งตาราง
 * (ตาราง events ไม่ถูกล้าง โตตามจำนวนข้อความเข้าทั้งหมด)
 */
export function previewQuery(db: Db, contactIds: number[]) {
  return db
    .selectDistinctOn([events.contactId], {
      contactId: events.contactId,
      trigger: sql<string | null>`${events.meta}->>'trigger'`,
      text: sql<string>`left(${events.text}, 500)`,
    })
    .from(events)
    .where(
      and(
        inArray(events.contactId, contactIds),
        inArray(events.type, [...PREVIEW_EVENT_TYPES]),
        sql`${events.text} ~ '[^[:space:]]'`, // ข้ามข้อความว่าง (เช่น ส่งแต่รูป/สติกเกอร์)
      ),
    )
    .orderBy(events.contactId, desc(events.createdAt), desc(events.id));
}

/** ข้อความล่าสุดที่ลูกค้าแต่ละคนพิมพ์มา — ดึงทั้งหน้าในคำสั่งเดียว */
export async function loadPreviews(db: Db, contactIds: number[]): Promise<Map<number, Preview>> {
  const previews = new Map<number, Preview>();
  if (contactIds.length === 0) return previews;
  const rows = await previewQuery(db, contactIds);
  for (const r of rows) {
    if (r.contactId === null) continue;
    const text = r.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    previews.set(r.contactId, { text: fitText(text, PREVIEW_MAX), via: r.trigger === "comment" ? "comment" : "dm" });
  }
  return previews;
}
