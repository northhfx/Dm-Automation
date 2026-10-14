import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contacts, events, rules, type Platform } from "@/db/schema";

/** กิจกรรม 1 รายการ ในรูปที่หน้าเว็บใช้แสดงได้ทันที (ชื่อคน / ชื่อกฎ / สาเหตุที่ผิดพลาด) */
export interface TimelineEvent {
  id: number;
  type: string;
  platform: Platform | null;
  createdAt: Date;
  ruleId: number | null;
  /** null = กฎถูกลบไปแล้ว หรือกิจกรรมนี้ไม่เกี่ยวกับกฎ */
  ruleName: string | null;
  /** ชื่อลูกค้าที่เกี่ยวข้อง (ถ้ารู้) */
  person: string | null;
  text: string | null;
  /** ชื่อปุ่มที่แนบไปกับ DM (แยกออกจากข้อความ เพื่อแสดงเป็นปุ่ม) */
  buttons: string[];
  /** message = null เมื่อ Meta ไม่ได้บอกสาเหตุมา (หน้าเว็บแสดง "ไม่ทราบสาเหตุ" ตามภาษาที่เลือก) */
  error: { message: string | null; code: string | null } | null;
  /** เหตุผลที่ข้าม (เฉพาะ type = skipped) */
  skipReason: string | null;
  /**
   * คอมเมนต์ / แชทที่ไม่ตรงกฎ (meta.matched = false) — ระบบเก็บแค่ว่ามีข้อความเข้ามา
   * ไม่เก็บว่าใครส่ง ส่งว่าอะไร (ดู anonymousReceived ใน lib/automation/handlers.ts)
   */
  unmatched: boolean;
}

type ErrorMeta = { message?: unknown; code?: unknown; subcode?: unknown };

/** ชื่อที่ใช้แสดง: ชื่อจริง → @username → null */
function displayName(name: string | null, username: string | null): string | null {
  return name?.trim() || (username?.trim() ? `@${username.trim()}` : null);
}

function readError(meta: Record<string, unknown> | null): TimelineEvent["error"] {
  const err = meta?.error as ErrorMeta | undefined;
  if (!err || typeof err !== "object") return null;
  const message = typeof err.message === "string" && err.message.trim() ? err.message.trim() : null;
  const code = err.code != null ? [err.code, err.subcode].filter((v) => v != null && v !== "").join(" / ") : null;
  return { message, code: code || null };
}

/** DM ที่มีปุ่มถูกบันทึกเป็น "ข้อความ\n\n[ปุ่ม 1] [ปุ่ม 2]" → แยกชื่อปุ่มออกมา */
function splitButtons(type: string, text: string | null): { text: string | null; buttons: string[] } {
  if (!text || (type !== "dm_sent" && type !== "dm_failed")) return { text, buttons: [] };
  const match = text.match(/\n\n((?:\[[^\]\n]*\] ?)+)$/);
  if (!match) return { text, buttons: [] };
  const buttons = [...match[1].matchAll(/\[([^\]\n]*)\]/g)].map((m) => m[1]);
  return { text: text.slice(0, match.index).trim() || null, buttons };
}

/**
 * อ่านกิจกรรมล่าสุด (ใหม่ → เก่า) พร้อมชื่อกฎและชื่อลูกค้า
 * before = id ของรายการสุดท้ายในหน้าก่อน (ใช้ทำปุ่ม "ดูรายการที่เก่ากว่า")
 */
export async function loadEvents(
  db: Db,
  opts: { types?: readonly string[] | null; before?: number | null; limit: number },
): Promise<{ items: TimelineEvent[]; hasMore: boolean }> {
  const conditions = [];
  if (opts.types) conditions.push(inArray(events.type, [...opts.types]));
  if (opts.before) conditions.push(lt(events.id, opts.before));

  const rows = await db
    .select({
      event: events,
      ruleName: rules.name,
      contactName: contacts.name,
      contactUsername: contacts.username,
    })
    .from(events)
    .leftJoin(rules, eq(rules.id, events.ruleId))
    .leftJoin(contacts, eq(contacts.id, events.contactId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(events.id))
    .limit(opts.limit + 1);

  const hasMore = rows.length > opts.limit;
  const page = rows.slice(0, opts.limit);

  // กิจกรรมที่ไม่มี contactId (เช่น คอมเมนต์) → หาชื่อจาก id ของคนที่คอมเมนต์/ทักมา
  const byActor = new Map<string, string>();
  const actorIds = [
    ...new Set(
      page
        .filter((r) => !displayName(r.contactName, r.contactUsername) && r.event.actorId)
        .map((r) => r.event.actorId as string),
    ),
  ];
  if (actorIds.length > 0) {
    const known = await db
      .select({ platform: contacts.platform, platformUserId: contacts.platformUserId, name: contacts.name, username: contacts.username })
      .from(contacts)
      .where(inArray(contacts.platformUserId, actorIds));
    for (const c of known) {
      const name = displayName(c.name, c.username);
      if (name) byActor.set(`${c.platform}:${c.platformUserId}`, name);
    }
  }
  // ชื่อที่มากับคอมเมนต์ (Instagram ส่งมาเป็น username)
  for (const { event } of page) {
    const fromName = (event.meta as { fromName?: unknown } | null)?.fromName;
    if (event.type !== "comment_received" || !event.actorId || typeof fromName !== "string" || !fromName.trim()) continue;
    const key = `${event.platform}:${event.actorId}`;
    if (!byActor.has(key)) byActor.set(key, event.platform === "instagram" ? `@${fromName.trim()}` : fromName.trim());
  }

  const items = page.map(({ event, ruleName, contactName, contactUsername }): TimelineEvent => {
    const meta = event.meta ?? null;
    const reason = (meta as { reason?: unknown } | null)?.reason;
    // กิจกรรมระดับบัญชี (ไม่มีลูกค้าเกี่ยวข้อง) → แสดงชื่อบัญชีร้านแทน
    //  token_refresh_failed: meta.username (ไม่มี @) / dm_rate_limited: meta.accountName (ชื่อเพจหรือ "@username")
    const account = (meta as { username?: unknown } | null)?.username;
    const accountLabel = (meta as { accountName?: unknown } | null)?.accountName;
    const accountName =
      event.type === "token_refresh_failed" && typeof account === "string" && account.trim()
        ? `@${account.trim()}`
        : event.type === "dm_rate_limited" && typeof accountLabel === "string" && accountLabel.trim()
          ? accountLabel.trim()
          : null;
    const body = splitButtons(event.type, event.text?.trim() || null);
    return {
      id: event.id,
      type: event.type,
      platform: event.platform,
      createdAt: event.createdAt,
      ruleId: event.ruleId,
      ruleName: ruleName ?? null,
      person:
        accountName ??
        displayName(contactName, contactUsername) ??
        (event.actorId ? (byActor.get(`${event.platform}:${event.actorId}`) ?? null) : null),
      text: body.text,
      buttons: body.buttons,
      error: readError(meta),
      skipReason: event.type === "skipped" && typeof reason === "string" ? reason : null,
      unmatched:
        (event.type === "comment_received" || event.type === "dm_received") &&
        (meta as { matched?: unknown } | null)?.matched === false,
    };
  });

  return { items, hasMore };
}
