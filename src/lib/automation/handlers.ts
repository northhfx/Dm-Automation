import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contacts, dedupKeys, events, links, messages, rules, type Job, type Platform, type TriggerType } from "@/db/schema";
import { randomCode } from "@/lib/crypto";
import { env } from "@/lib/env";
import { fetchProfile, GraphApiError, replyToComment, sendTextMessage, type Recipient, type SendResult } from "@/lib/meta/graph";
import type { CommentJob, DmJob, ReadJob } from "@/lib/meta/webhook";
import { findPageByAccount, getPageById } from "@/lib/pages";
import { enqueue, rescheduleJob, updateJobPayload } from "@/lib/queue/queue";
import { findMatchingRule } from "@/lib/rules/match";
import { firstName, pickRandom, renderTemplate } from "@/lib/rules/template";

export interface SendDmJob {
  type: "send_dm";
  platform: Platform;
  pageId: string;
  ruleId: number;
  source: TriggerType;
  recipient: Recipient;
  actorId: string;
  actorName: string | null;
  postId: string | null;
  /** สร้างครั้งแรกแล้วเก็บไว้ ถ้างานถูกลองใหม่จะได้ใช้ลิงก์เดิม */
  linkCode?: string;
}

type EventInsert = typeof events.$inferInsert;

async function logEvent(db: Db, e: EventInsert): Promise<void> {
  await db.insert(events).values(e);
}

/** true = เพิ่งเห็นครั้งแรก, false = เคยประมวลผลแล้ว */
async function claimOnce(db: Db, key: string): Promise<boolean> {
  const rows = await db.insert(dedupKeys).values({ key }).onConflictDoNothing().returning({ key: dedupKeys.key });
  return rows.length > 0;
}

async function loadActiveRules(db: Db, trigger: TriggerType) {
  return db.query.rules.findMany({ where: and(eq(rules.active, true), eq(rules.trigger, trigger)) });
}

async function upsertContact(
  db: Db,
  data: { platform: Platform; platformUserId: string; pageId: string; name?: string | null; username?: string | null; inbound?: boolean },
): Promise<{ id: number; name: string | null; username: string | null }> {
  const now = new Date();
  const [row] = await db
    .insert(contacts)
    .values({
      platform: data.platform,
      platformUserId: data.platformUserId,
      pageId: data.pageId,
      name: data.name ?? null,
      username: data.username ?? null,
      lastInboundAt: data.inbound ? now : null,
    })
    .onConflictDoUpdate({
      target: [contacts.platform, contacts.platformUserId],
      set: {
        name: sql`coalesce(${contacts.name}, excluded.name)`,
        username: sql`coalesce(${contacts.username}, excluded.username)`,
        lastInboundAt: data.inbound ? now : sql`${contacts.lastInboundAt}`,
      },
    })
    .returning({
      id: contacts.id,
      name: contacts.name,
      username: contacts.username,
    });
  return row;
}

// ---------------------------------------------------------------------------
// คอมเมนต์ใหม่ → หา rule → ตอบคอมเมนต์ + ส่ง DM
// ---------------------------------------------------------------------------

export async function handleComment(db: Db, job: CommentJob): Promise<void> {
  const page = await findPageByAccount(db, job.platform, job.accountId);
  if (!page) return; // webhook ของเพจที่ยังไม่ได้เชื่อมต่อ
  if (!(await claimOnce(db, `comment:${job.commentId}`))) return;

  await logEvent(db, {
    type: "comment_received",
    platform: job.platform,
    pageId: page.id,
    actorId: job.fromId,
    postId: job.postId,
    text: job.text,
    meta: { commentId: job.commentId, fromName: job.fromName },
  });

  const rule = findMatchingRule(await loadActiveRules(db, "comment"), {
    trigger: "comment",
    platform: job.platform,
    text: job.text,
    postId: job.postId,
  });
  if (!rule) return;

  if (rule.oncePerUser) {
    const already = await db.query.events.findFirst({
      where: and(
        eq(events.type, "rule_triggered"),
        eq(events.ruleId, rule.id),
        eq(events.actorId, job.fromId),
        job.postId ? eq(events.postId, job.postId) : isNull(events.postId),
      ),
      columns: { id: true },
    });
    if (already) {
      await logEvent(db, {
        type: "skipped",
        platform: job.platform,
        pageId: page.id,
        ruleId: rule.id,
        actorId: job.fromId,
        postId: job.postId,
        text: job.text,
        meta: { reason: "once_per_user", commentId: job.commentId },
      });
      return;
    }
  }

  await logEvent(db, {
    type: "rule_triggered",
    platform: job.platform,
    pageId: page.id,
    ruleId: rule.id,
    actorId: job.fromId,
    postId: job.postId,
    text: job.text,
    meta: { commentId: job.commentId, trigger: "comment" },
  });

  const sendJob: SendDmJob = {
    type: "send_dm",
    platform: job.platform,
    pageId: page.id,
    ruleId: rule.id,
    source: "comment",
    recipient: { comment_id: job.commentId },
    actorId: job.fromId,
    actorName: job.platform === "facebook" ? firstName(job.fromName) : job.fromName,
    postId: job.postId,
  };
  await enqueue(db, "send_dm", { ...sendJob });

  const publicReply = pickRandom(rule.publicReplies.filter((r) => r.trim()));
  if (publicReply) {
    const message = renderTemplate(publicReply, { name: sendJob.actorName });
    try {
      const res = await replyToComment(job.platform, job.commentId, page.token, message);
      await logEvent(db, {
        type: "public_reply_sent",
        platform: job.platform,
        pageId: page.id,
        ruleId: rule.id,
        actorId: job.fromId,
        postId: job.postId,
        text: message,
        meta: { commentId: job.commentId, replyId: res.id },
      });
    } catch (err) {
      await logEvent(db, {
        type: "public_reply_failed",
        platform: job.platform,
        pageId: page.id,
        ruleId: rule.id,
        actorId: job.fromId,
        postId: job.postId,
        text: message,
        meta: { commentId: job.commentId, error: errorInfo(err) },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// มีคนทัก DM มา → บันทึก contact → หา rule → ตอบกลับ
// ---------------------------------------------------------------------------

export async function handleDm(db: Db, job: DmJob): Promise<void> {
  const page = await findPageByAccount(db, job.platform, job.accountId);
  if (!page) return;
  if (!(await claimOnce(db, `dm:${job.mid}`))) return;

  const contact = await upsertContact(db, {
    platform: job.platform,
    platformUserId: job.senderId,
    pageId: page.id,
    inbound: true,
  });

  let name = contact.name;
  let username = contact.username;
  if (!name && !username) {
    try {
      const profile = await fetchProfile(job.platform, job.senderId, page.token);
      name = profile.name;
      username = profile.username;
      await db.update(contacts).set({ name, username }).where(eq(contacts.id, contact.id));
    } catch {
      // ไม่มีสิทธิ์ดึงโปรไฟล์ก็ส่งข้อความต่อได้ตามปกติ
    }
  }

  await logEvent(db, {
    type: "dm_received",
    platform: job.platform,
    pageId: page.id,
    contactId: contact.id,
    actorId: job.senderId,
    text: job.text,
    meta: { mid: job.mid, payload: job.payload },
  });

  const rule = findMatchingRule(await loadActiveRules(db, "dm"), {
    trigger: "dm",
    platform: job.platform,
    text: job.text || job.payload || "",
  });
  if (!rule) return;

  await logEvent(db, {
    type: "rule_triggered",
    platform: job.platform,
    pageId: page.id,
    ruleId: rule.id,
    contactId: contact.id,
    actorId: job.senderId,
    text: job.text,
    meta: { mid: job.mid, trigger: "dm" },
  });

  const sendJob: SendDmJob = {
    type: "send_dm",
    platform: job.platform,
    pageId: page.id,
    ruleId: rule.id,
    source: "dm",
    recipient: { id: job.senderId },
    actorId: job.senderId,
    actorName: job.platform === "facebook" ? firstName(name) : (username ?? name),
    postId: null,
  };
  await enqueue(db, "send_dm", { ...sendJob });
}

// ---------------------------------------------------------------------------
// ลูกค้าอ่านข้อความแล้ว → อัปเดตสถานะเพื่อคำนวณ % การอ่าน
// ---------------------------------------------------------------------------

export async function handleRead(db: Db, job: ReadJob): Promise<void> {
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.platform, job.platform), eq(contacts.platformUserId, job.senderId)),
    columns: { id: true },
  });
  if (!contact) return;

  let readUpTo = new Date();
  if (job.watermark) {
    readUpTo = new Date(job.watermark);
  } else if (job.mid) {
    const msg = await db.query.messages.findFirst({ where: eq(messages.mid, job.mid), columns: { sentAt: true } });
    if (msg) readUpTo = msg.sentAt;
  }

  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.contactId, contact.id),
        eq(messages.status, "sent"),
        isNull(messages.readAt),
        lte(messages.sentAt, new Date(readUpTo.getTime() + 1000)),
      ),
    );
}

// ---------------------------------------------------------------------------
// ส่ง DM จริง (แยกเป็นงานของตัวเอง เพื่อคุมความเร็วและลองใหม่ได้)
// ---------------------------------------------------------------------------

function hourlyLimit(platform: Platform): number {
  return platform === "instagram" ? env.instagramDmPerHour : env.facebookDmPerHour;
}

/** ถ้าส่งครบโควตาชั่วโมงนี้แล้ว คืนเวลาที่ควรลองใหม่ ไม่งั้นคืน null */
async function nextAllowedSendTime(db: Db, pageId: string, platform: Platform): Promise<Date | null> {
  const limit = hourlyLimit(platform);
  if (limit <= 0) return null;
  const since = new Date(Date.now() - 60 * 60_000);
  const recent = await db
    .select({ sentAt: messages.sentAt })
    .from(messages)
    .where(
      and(eq(messages.pageId, pageId), eq(messages.platform, platform), eq(messages.status, "sent"), gte(messages.sentAt, since)),
    )
    .orderBy(asc(messages.sentAt));
  if (recent.length < limit) return null;
  // รอจนข้อความที่เก่าที่สุดในหน้าต่าง 1 ชม. หลุดออกไป
  const oldest = recent[recent.length - limit].sentAt;
  return new Date(oldest.getTime() + 60 * 60_000 + 5_000);
}

export async function handleSendDm(db: Db, job: Job): Promise<void> {
  const data = job.payload as unknown as SendDmJob;
  const page = await getPageById(db, data.pageId);
  const rule = await db.query.rules.findFirst({ where: eq(rules.id, data.ruleId) });
  if (!page || !rule) return;

  const waitUntil = await nextAllowedSendTime(db, page.id, data.platform);
  if (waitUntil) {
    await rescheduleJob(db, job, waitUntil, `ถึงลิมิต ${hourlyLimit(data.platform)} ข้อความ/ชั่วโมง รอส่งต่อ`);
    throw new RescheduledError();
  }

  let linkCode: string | null = null;
  if (rule.linkUrl) {
    linkCode = data.linkCode ?? null;
    if (!linkCode) {
      linkCode = randomCode();
      await db.insert(links).values({ code: linkCode, targetUrl: rule.linkUrl, ruleId: rule.id, platform: data.platform });
      await updateJobPayload(db, job.id, { ...data, linkCode });
    }
  }
  const linkUrl = linkCode ? `${env.publicBaseUrl}/r/${linkCode}` : null;

  const text = renderTemplate(rule.dmText, { name: data.actorName, link: linkUrl });

  let res: SendResult;
  try {
    res = await sendTextMessage(page.id, page.token, data.recipient, text);
  } catch (err) {
    if (err instanceof GraphApiError && err.retryable && job.attempts < job.maxAttempts) throw err;
    // ส่งไม่สำเร็จแน่แล้ว → ลบลิงก์ทิ้ง เพื่อไม่ให้ไปถ่วงสถิติ % คลิก
    if (linkCode) await db.delete(links).where(eq(links.code, linkCode));
    await db.insert(messages).values({
      platform: data.platform,
      pageId: page.id,
      ruleId: rule.id,
      source: data.source,
      status: "failed",
      error: (err as Error).message.slice(0, 1000),
    });
    await logEvent(db, {
      type: "dm_failed",
      platform: data.platform,
      pageId: page.id,
      ruleId: rule.id,
      actorId: data.actorId,
      postId: data.postId,
      text,
      meta: { source: data.source, error: errorInfo(err) },
    });
    return;
  }

  // ส่งถึงลูกค้าแล้ว: ถ้าบันทึกสถิติพลาด ห้ามโยน error ออกไป ไม่งั้นงานจะถูกลองใหม่และส่ง DM ซ้ำ
  try {
    await recordSent(db, data, page.id, rule.id, res, text, linkCode);
  } catch (err) {
    console.error(`[send_dm] ส่ง DM แล้วแต่บันทึกสถิติไม่สำเร็จ (งาน #${job.id}):`, err);
  }
}

async function recordSent(
  db: Db,
  data: SendDmJob,
  pageId: string,
  ruleId: number,
  res: SendResult,
  text: string,
  linkCode: string | null,
): Promise<void> {
  const contact = res.recipient_id
    ? await upsertContact(db, {
        platform: data.platform,
        platformUserId: res.recipient_id,
        pageId,
        name: data.platform === "facebook" ? data.actorName : null,
        username: data.platform === "instagram" ? data.actorName : null,
      })
    : null;
  await db.insert(messages).values({
    platform: data.platform,
    pageId,
    contactId: contact?.id ?? null,
    ruleId,
    source: data.source,
    mid: res.message_id ?? null,
    status: "sent",
  });
  if (linkCode && contact) {
    await db.update(links).set({ contactId: contact.id }).where(eq(links.code, linkCode));
  }
  await logEvent(db, {
    type: "dm_sent",
    platform: data.platform,
    pageId,
    ruleId,
    contactId: contact?.id ?? null,
    actorId: data.actorId,
    postId: data.postId,
    text,
    meta: { mid: res.message_id, source: data.source },
  });
}

/** ใช้บอก worker ว่างานถูกเลื่อนเวลาแล้ว ไม่ต้องทำเครื่องหมายว่าเสร็จ */
export class RescheduledError extends Error {
  constructor() {
    super("rescheduled");
    this.name = "RescheduledError";
  }
}

function errorInfo(err: unknown): Record<string, unknown> {
  if (err instanceof GraphApiError) return { message: err.message, code: err.code, subcode: err.subcode, status: err.status };
  return { message: (err as Error)?.message ?? String(err) };
}
