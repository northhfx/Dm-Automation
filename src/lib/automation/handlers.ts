import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  contacts,
  dedupKeys,
  events,
  links,
  messages,
  rules,
  type Job,
  type MessageSource,
  type Platform,
  type TriggerType,
} from "@/db/schema";
import { getPublicBaseUrl } from "@/lib/config";
import { randomCode } from "@/lib/crypto";
import { env } from "@/lib/env";
import { fitText, FLOW_LIMITS, flowPayload, parseFlowPayload } from "@/lib/flows/types";
import {
  buildMessage,
  fetchProfile,
  GraphApiError,
  replyToComment,
  sendMessage,
  type GraphButton,
  type Recipient,
  type SendResult,
} from "@/lib/meta/graph";
import type { CommentJob, DmJob, ReadJob } from "@/lib/meta/webhook";
import { findPageByAccount, getPageById, type ConnectedPage } from "@/lib/pages";
import { enqueue, rescheduleJob, updateJobPayload } from "@/lib/queue/queue";
import { findMatchingRule } from "@/lib/rules/match";
import { firstName, pickRandom, renderTemplate } from "@/lib/rules/template";

export interface SendDmJob {
  type: "send_dm";
  platform: Platform;
  pageId: string;
  ruleId: number;
  /** ข้อความไหนในกฎที่จะส่ง */
  stepId: string;
  source: MessageSource;
  recipient: Recipient;
  actorId: string;
  actorName: string | null;
  postId: string | null;
  /** ลิงก์ติดตามของแต่ละปุ่ม (buttonId → code) สร้างครั้งแรกแล้วเก็บไว้ ถ้างานถูกลองใหม่จะได้ใช้ลิงก์เดิม */
  linkCodes?: Record<string, string>;
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
  const token = page.token;

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
  const firstStep = rule.steps[0];
  if (!firstStep) return;
  if (!token) {
    await logTokenProblem(db, job.platform, page.id, rule.id, job.fromId);
    return;
  }

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
    stepId: firstStep.id,
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
      const res = await replyToComment(job.platform, job.commentId, token, message);
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
  if (!name && !username && page.token) {
    try {
      const profile = await fetchProfile(job.platform, job.senderId, page.token);
      name = profile.name;
      username = profile.username;
      await db.update(contacts).set({ name, username }).where(eq(contacts.id, contact.id));
    } catch {
      // ไม่มีสิทธิ์ดึงโปรไฟล์ก็ส่งข้อความต่อได้ตามปกติ
    }
  }

  const actorName = job.platform === "facebook" ? firstName(name) : (username ?? name);

  // ลูกค้ากดปุ่มในข้อความของเรา → ส่งข้อความถัดไป (ไม่ต้องเอาไปจับ keyword ซ้ำ)
  const tap = parseFlowPayload(job.payload);
  if (tap) {
    await handleButtonTap(db, page, job, contact.id, actorName, tap);
    return;
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
  const firstStep = rule.steps[0];
  if (!firstStep) return;
  if (!page.token) {
    await logTokenProblem(db, job.platform, page.id, rule.id, job.senderId);
    return;
  }

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
    stepId: firstStep.id,
    source: "dm",
    recipient: { id: job.senderId },
    actorId: job.senderId,
    actorName,
    postId: null,
  };
  await enqueue(db, "send_dm", { ...sendJob });
}

/** ลูกค้ากดปุ่ม "ส่งข้อความถัดไป" → บันทึกการกด แล้วส่งข้อความที่ปุ่มนั้นพาไป */
async function handleButtonTap(
  db: Db,
  page: ConnectedPage,
  job: DmJob,
  contactId: number,
  actorName: string | null,
  tap: { ruleId: number; stepId: string; buttonId: string },
): Promise<void> {
  const rule = await db.query.rules.findFirst({ where: eq(rules.id, tap.ruleId) });
  const button = rule?.steps.find((s) => s.id === tap.stepId)?.buttons.find((b) => b.id === tap.buttonId);

  await logEvent(db, {
    type: "button_clicked",
    platform: job.platform,
    pageId: page.id,
    ruleId: rule ? rule.id : null,
    contactId,
    actorId: job.senderId,
    text: job.text,
    meta: { mid: job.mid, stepId: tap.stepId, buttonId: tap.buttonId },
  });

  // ปุ่มจากข้อความเก่าที่ถูกแก้/ลบไปแล้ว → ไม่ต้องทำอะไรต่อ
  if (!rule || button?.type !== "next") return;
  const next = rule.steps.find((s) => s.id === button.nextStepId);
  if (!next) return;
  if (!rule.active) {
    await logEvent(db, {
      type: "skipped",
      platform: job.platform,
      pageId: page.id,
      ruleId: rule.id,
      contactId,
      actorId: job.senderId,
      text: job.text,
      meta: { reason: "rule_inactive" },
    });
    return;
  }
  if (!page.token) {
    await logTokenProblem(db, job.platform, page.id, rule.id, job.senderId);
    return;
  }

  const sendJob: SendDmJob = {
    type: "send_dm",
    platform: job.platform,
    pageId: page.id,
    ruleId: rule.id,
    stepId: next.id,
    source: "button",
    recipient: { id: job.senderId },
    actorId: job.senderId,
    actorName,
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
  // งานที่เข้าคิวไว้ก่อนอัปเดตเป็นแบบหลายข้อความจะไม่มี stepId → ส่งข้อความแรก
  const step = data.stepId ? rule.steps.find((s) => s.id === data.stepId) : rule.steps[0];
  if (!step) {
    // ข้อความถูกลบออกจากกฎระหว่างรอส่ง
    await logEvent(db, {
      type: "dm_failed",
      platform: data.platform,
      pageId: page.id,
      ruleId: rule.id,
      actorId: data.actorId,
      postId: data.postId,
      meta: { stepId: data.stepId, error: { message: "ไม่พบข้อความนี้ในกฎแล้ว (อาจถูกลบระหว่างรอส่ง)" } },
    });
    return;
  }
  const token = page.token;
  if (!token) {
    await logTokenProblem(db, data.platform, page.id, rule.id, data.actorId);
    return;
  }

  const waitUntil = await nextAllowedSendTime(db, page.id, data.platform);
  if (waitUntil) {
    await rescheduleJob(db, job, waitUntil, `ถึงลิมิต ${hourlyLimit(data.platform)} ข้อความ/ชั่วโมง รอส่งต่อ`);
    throw new RescheduledError();
  }

  // ปุ่มเปิดลิงก์ → แปลงเป็นลิงก์ติดตาม (ต้องรู้ URL ของระบบ ถ้ายังไม่รู้ให้ใช้ลิงก์ปลายทางตรงๆ ดีกว่าไม่ส่ง)
  const hasLinks = step.buttons.some((b) => b.type === "link" && b.url);
  const baseUrl = hasLinks ? await getPublicBaseUrl(db) : null;
  const linkCodes: Record<string, string> = { ...(data.linkCodes ?? {}) };
  // ลิงก์ของงานเวอร์ชันเก่า (ก่อนมีปุ่ม) ไม่ได้ใช้แล้ว ลบทิ้งไม่ให้ถ่วงสถิติ
  const legacyCode = (data as { linkCode?: string }).linkCode;
  if (legacyCode && !data.linkCodes) await db.delete(links).where(eq(links.code, legacyCode));
  let createdLinks = false;
  for (const b of step.buttons) {
    if (b.type !== "link" || !b.url || !baseUrl || linkCodes[b.id]) continue;
    const code = randomCode();
    await db.insert(links).values({
      code,
      targetUrl: b.url,
      ruleId: rule.id,
      stepId: step.id,
      buttonId: b.id,
      platform: data.platform,
    });
    linkCodes[b.id] = code;
    createdLinks = true;
  }
  if (createdLinks) await updateJobPayload(db, job.id, { ...data, linkCodes });

  const buttons: GraphButton[] = step.buttons.flatMap((b): GraphButton[] => {
    if (b.type === "link") {
      if (!b.url) return [];
      return [{ type: "web_url", title: b.title, url: linkCodes[b.id] ? `${baseUrl}/r/${linkCodes[b.id]}` : b.url }];
    }
    return b.nextStepId ? [{ type: "postback", title: b.title, payload: flowPayload(rule.id, step.id, b.id) }] : [];
  });
  // เผื่อชื่อลูกค้ายาวจนข้อความเกินลิมิตของ Meta (ข้อความที่มีปุ่มห้ามว่างด้วย)
  const maxLength = buttons.length ? FLOW_LIMITS.textWithButtons : FLOW_LIMITS.textPlain;
  const text = fitText(renderTemplate(step.text, { name: data.actorName }) || (buttons.length ? "👇" : ""), maxLength);
  const logText = buttons.length ? `${text}\n\n${buttons.map((b) => `[${b.title}]`).join(" ")}` : text;
  const codes = Object.values(linkCodes);

  let res: SendResult;
  try {
    res = await sendMessage(page.id, token, data.recipient, buildMessage(text, buttons));
  } catch (err) {
    if (err instanceof GraphApiError && err.retryable && job.attempts < job.maxAttempts) throw err;
    // ส่งไม่สำเร็จแน่แล้ว → ลบลิงก์ทิ้ง เพื่อไม่ให้ไปถ่วงสถิติ % คลิก
    if (codes.length) await db.delete(links).where(inArray(links.code, codes));
    await db.insert(messages).values({
      platform: data.platform,
      pageId: page.id,
      ruleId: rule.id,
      stepId: step.id,
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
      text: logText,
      meta: { source: data.source, stepId: step.id, error: errorInfo(err) },
    });
    return;
  }

  // ส่งถึงลูกค้าแล้ว: ถ้าบันทึกสถิติพลาด ห้ามโยน error ออกไป ไม่งั้นงานจะถูกลองใหม่และส่ง DM ซ้ำ
  try {
    await recordSent(db, data, page.id, rule.id, step.id, res, logText, codes);
  } catch (err) {
    console.error(`[send_dm] ส่ง DM แล้วแต่บันทึกสถิติไม่สำเร็จ (งาน #${job.id}):`, err);
  }
}

async function recordSent(
  db: Db,
  data: SendDmJob,
  pageId: string,
  ruleId: number,
  stepId: string,
  res: SendResult,
  text: string,
  linkCodes: string[],
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
    stepId,
    source: data.source,
    mid: res.message_id ?? null,
    status: "sent",
  });
  if (linkCodes.length && contact) {
    await db.update(links).set({ contactId: contact.id }).where(inArray(links.code, linkCodes));
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
    meta: { mid: res.message_id, source: data.source, stepId },
  });
}

/** ใช้บอก worker ว่างานถูกเลื่อนเวลาแล้ว ไม่ต้องทำเครื่องหมายว่าเสร็จ */
export class RescheduledError extends Error {
  constructor() {
    super("rescheduled");
    this.name = "RescheduledError";
  }
}

/** token ของเพจใช้ไม่ได้ → บันทึกให้เห็นในหน้ากิจกรรม พร้อมบอกวิธีแก้ */
async function logTokenProblem(db: Db, platform: Platform, pageId: string, ruleId: number, actorId: string): Promise<void> {
  await logEvent(db, {
    type: "dm_failed",
    platform,
    pageId,
    ruleId,
    actorId,
    meta: { error: { message: "token ของเพจใช้ไม่ได้ — ไปที่หน้าตั้งค่าแล้วเชื่อมต่อเพจใหม่" } },
  });
}

function errorInfo(err: unknown): Record<string, unknown> {
  if (err instanceof GraphApiError) return { message: err.message, code: err.code, subcode: err.subcode, status: err.status };
  return { message: (err as Error)?.message ?? String(err) };
}
