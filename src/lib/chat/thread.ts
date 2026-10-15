import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { chatReplies, contacts, events, inboxItems, rules, type Platform } from "@/db/schema";
import { inboxCutoff } from "@/lib/inbox/retention";

/*
 * ห้องแชทกับลูกค้าหนึ่งคน (หน้า /inbox/<platform>/<account>/<user>) — รวมข้อความที่ระบบนี้เห็นจากหลายตาราง
 * - ลูกค้าทักแต่ไม่ตรง keyword → inbox_items (ไม่มีใน events เพราะไม่เก็บว่าใครทัก)
 * - ลูกค้าทักตรง keyword / กดปุ่ม และข้อความอัตโนมัติที่ส่งไป → events (dm_received, button_clicked, dm_sent)
 * - ข้อความที่เจ้าของร้านพิมพ์ตอบเองในหน้านี้ → chat_replies
 * ข้อความที่ตอบจากแอป Messenger / Instagram โดยตรงระบบไม่เห็น (ไม่ได้รับ webhook ของข้อความที่เพจส่งเอง)
 */

/** Meta ให้ส่งข้อความหาลูกค้า (messaging_type RESPONSE) ได้ภายใน 24 ชั่วโมงหลังลูกค้าทัก/กดปุ่มครั้งล่าสุด */
export const REPLY_WINDOW_MS = 24 * 60 * 60_000;

/** ข้อความในห้องแชทที่โหลดมาแสดงมากสุด (ล่าสุด) */
export const CHAT_HISTORY_MAX = 100;

/** platform + account (Connection.id) + user (PSID / IGSID) */
export interface ChatKey {
  platform: Platform;
  account: string;
  user: string;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** ค่าจาก URL → ChatKey (ไม่ถูกต้อง = null) */
export function parseChatKey(platform: unknown, account: unknown, user: unknown): ChatKey | null {
  if (platform !== "facebook" && platform !== "instagram") return null;
  if (typeof account !== "string" || typeof user !== "string") return null;
  const a = decodeURIComponent(account);
  const u = decodeURIComponent(user);
  return ID_PATTERN.test(a) && ID_PATTERN.test(u) ? { platform, account: a, user: u } : null;
}

/** ลิงก์หน้าแชท — from = หน้าที่กดมา (ปุ่มย้อนกลับ) */
export function chatHref(key: ChatKey, from?: "contacts"): string {
  const path = `/inbox/${key.platform}/${encodeURIComponent(key.account)}/${encodeURIComponent(key.user)}`;
  return from ? `${path}?from=${from}` : path;
}

export type ChatEntry =
  | { id: string; at: Date; dir: "in"; kind: "text"; text: string }
  | { id: string; at: Date; dir: "in"; kind: "button"; text: string }
  | { id: string; at: Date; dir: "out"; kind: "auto"; text: string; ruleName: string | null }
  | { id: string; at: Date; dir: "out"; kind: "manual"; text: string; status: "sent" | "failed"; error: string | null };

export interface ChatThread {
  /** ชื่อ / username ของลูกค้า (null = Meta ไม่ส่งมา) */
  name: string | null;
  username: string | null;
  /** เก่าสุด → ใหม่สุด */
  entries: ChatEntry[];
  /** ลูกค้าทักแชท/กดปุ่มครั้งล่าสุด (null = ยังไม่เคยทักแชทเลย เช่น คอมเมนต์อย่างเดียว) */
  lastInboundAt: Date | null;
  /** รายการในหน้าข้อความรอตอบของคนนี้ที่ยังไม่ได้กดเสร็จแล้ว */
  openInboxIds: number[];
}

/** ยังส่งข้อความจากหน้านี้ได้อยู่ไหม — คืนเวลาที่หมดสิทธิ์ (null = ส่งไม่ได้) */
export function replyWindowEndsAt(lastInboundAt: Date | null, now: Date = new Date()): Date | null {
  if (!lastInboundAt) return null;
  const end = new Date(lastInboundAt.getTime() + REPLY_WINDOW_MS);
  return end > now ? end : null;
}

/** ลูกค้าทัก/กดปุ่มครั้งล่าสุด (ใช้ตอนส่ง — ไม่ต้องโหลดทั้งห้อง) */
export async function lastInboundAt(db: Db, key: ChatKey): Promise<Date | null> {
  const [item] = await db
    .select({ at: inboxItems.createdAt })
    .from(inboxItems)
    .where(
      and(eq(inboxItems.platform, key.platform), eq(inboxItems.pageId, key.account), eq(inboxItems.senderId, key.user), eq(inboxItems.kind, "dm")),
    )
    .orderBy(desc(inboxItems.createdAt))
    .limit(1);
  const [event] = await db
    .select({ at: events.createdAt })
    .from(events)
    .where(
      and(
        inArray(events.type, ["dm_received", "button_clicked"]),
        eq(events.platform, key.platform),
        eq(events.pageId, key.account),
        eq(events.actorId, key.user),
        gte(events.createdAt, new Date(Date.now() - 2 * REPLY_WINDOW_MS)),
      ),
    )
    .orderBy(desc(events.createdAt))
    .limit(1);
  const times = [item?.at, event?.at].filter((d): d is Date => d instanceof Date);
  return times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
}

export async function loadChatThread(db: Db, key: ChatKey, now: Date = new Date()): Promise<ChatThread> {
  const since = inboxCutoff(now);
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.platform, key.platform), eq(contacts.platformUserId, key.user)),
  });

  const [items, eventRows, replies] = await Promise.all([
    db
      .select()
      .from(inboxItems)
      .where(
        and(
          eq(inboxItems.platform, key.platform),
          eq(inboxItems.pageId, key.account),
          eq(inboxItems.senderId, key.user),
          eq(inboxItems.kind, "dm"),
          gte(inboxItems.createdAt, since),
        ),
      )
      .orderBy(desc(inboxItems.createdAt))
      .limit(CHAT_HISTORY_MAX),
    db
      .select({
        id: events.id,
        type: events.type,
        text: events.text,
        createdAt: events.createdAt,
        ruleName: rules.name,
      })
      .from(events)
      .leftJoin(rules, eq(rules.id, events.ruleId))
      .where(
        and(
          inArray(events.type, ["dm_received", "button_clicked", "dm_sent"]),
          eq(events.platform, key.platform),
          eq(events.pageId, key.account),
          gte(events.createdAt, since),
          // ข้อความตอบคอมเมนต์ทาง DM (Private Reply): actor = คนคอมเมนต์ (คนละ id กับแชท) แต่ผูก contact ไว้แล้ว
          contact ? or(eq(events.actorId, key.user), eq(events.contactId, contact.id)) : eq(events.actorId, key.user),
        ),
      )
      .orderBy(desc(events.createdAt))
      .limit(CHAT_HISTORY_MAX),
    db
      .select()
      .from(chatReplies)
      .where(and(eq(chatReplies.platform, key.platform), eq(chatReplies.pageId, key.account), eq(chatReplies.recipientId, key.user)))
      .orderBy(desc(chatReplies.sentAt))
      .limit(CHAT_HISTORY_MAX),
  ]);

  const entries: ChatEntry[] = [
    ...items.map((i): ChatEntry => ({ id: `i${i.id}`, at: i.createdAt, dir: "in", kind: "text", text: i.text })),
    ...eventRows.map((e): ChatEntry => {
      const text = e.text ?? "";
      if (e.type === "dm_sent") return { id: `e${e.id}`, at: e.createdAt, dir: "out", kind: "auto", text, ruleName: e.ruleName };
      return { id: `e${e.id}`, at: e.createdAt, dir: "in", kind: e.type === "button_clicked" ? "button" : "text", text };
    }),
    ...replies.map(
      (r): ChatEntry => ({ id: `r${r.id}`, at: r.sentAt, dir: "out", kind: "manual", text: r.text, status: r.status, error: r.error }),
    ),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id))
    .slice(-CHAT_HISTORY_MAX);

  const inbound = [
    ...items.map((i) => i.createdAt),
    ...eventRows.filter((e) => e.type !== "dm_sent").map((e) => e.createdAt),
  ];
  const named = items.find((i) => i.senderName || i.senderUsername);
  return {
    name: contact?.name ?? named?.senderName ?? null,
    username: contact?.username ?? named?.senderUsername ?? null,
    entries,
    lastInboundAt: inbound.length ? new Date(Math.max(...inbound.map((d) => d.getTime()))) : null,
    openInboxIds: items.filter((i) => i.handledAt === null).map((i) => i.id),
  };
}

/** ส่งสำเร็จแล้ว → รายการในหน้าข้อความรอตอบของคนนี้ถือว่าตอบแล้ว (คืนจำนวนที่เปลี่ยน) */
export async function markThreadHandled(db: Db, key: ChatKey, now: Date = new Date()): Promise<number> {
  const rows = await db
    .update(inboxItems)
    .set({ handledAt: now })
    .where(
      and(
        eq(inboxItems.platform, key.platform),
        eq(inboxItems.pageId, key.account),
        eq(inboxItems.senderId, key.user),
        eq(inboxItems.kind, "dm"),
        isNull(inboxItems.handledAt),
        sql`${inboxItems.createdAt} <= ${now.toISOString()}::timestamptz`,
      ),
    )
    .returning({ id: inboxItems.id });
  return rows.length;
}
