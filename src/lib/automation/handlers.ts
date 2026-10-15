import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  contacts,
  dedupKeys,
  events,
  links,
  messages,
  rules,
  type GraphApi,
  type Job,
  type MessageSource,
  type Platform,
  type TriggerType,
  type WebhookVia,
} from "@/db/schema";
import { getPublicBaseUrl } from "@/lib/config";
import { findConnection, getConnection, type Connection, type LoginKind } from "@/lib/connections";
import { randomCode } from "@/lib/crypto";
import { env } from "@/lib/env";
import { systemMessage } from "@/lib/i18n/system";
import { fitText, FLOW_LIMITS, flowPayload, parseFlowPayload } from "@/lib/flows/types";
import { captureInboxItem } from "@/lib/inbox/capture";
import { INSTAGRAM_ERRORS, markInstagramLoginDelivery, updateInstagramAccountStatus } from "@/lib/instagram/accounts";
import {
  buildMessage,
  errorInfo,
  fetchMessengerParticipantName,
  fetchProfile,
  GraphApiError,
  replyToComment,
  sendMessage,
  type GraphButton,
  type Recipient,
  type SendResult,
} from "@/lib/meta/graph";
import type { CommentJob, DmJob, PagePostJob, ReadJob } from "@/lib/meta/webhook";
import { enqueue, postponePendingJobs, rescheduleJob, updateJobPayload } from "@/lib/queue/queue";
import { findMatchingRule } from "@/lib/rules/match";
import { bindPublishedFacebookPost, checkNextPost } from "@/lib/rules/next-post";
import { postScopeMatches } from "@/lib/rules/post-scope";
import { firstName, pickRandom, renderTemplate } from "@/lib/rules/template";

export interface SendDmJob {
  type: "send_dm";
  platform: Platform;
  /** Connection.id: Page ID (Facebook และ Instagram ผ่านเพจ) หรือ IG account ID (Instagram Login) */
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
  /** ส่งผ่าน API ไหน — งานที่เข้าคิวก่อนมีฟิลด์นี้ไม่มีค่า (pageId เป็น Page ID เสมอ) */
  api?: GraphApi;
  /** Meta ขอให้ชะลอ (rate limit) งานนี้มาแล้วกี่รอบ — ครบ RATE_LIMIT_MAX_WAITS แล้วยังไม่ผ่านจะเลิกส่ง */
  rateLimitHits?: number;
}

/**
 * ช่องทาง Instagram Login ถือว่า "ใช้ได้จริง" สำหรับ DM ถ้าส่ง DM ของบัญชีนั้นมาภายในช่วงนี้
 * ระหว่างนั้น DM ที่มาทาง Facebook Login จะถูกข้าม (ไม่งั้นใช้เป็นทางสำรอง) — คอมเมนต์ไม่ใช้กติกานี้ ดู handleComment
 */
export const LOGIN_CHANNEL_FRESH_MS = 7 * 24 * 60 * 60_000;

/** ข้อความธรรมดา (ไม่มีปุ่ม) ผ่าน Instagram Login ยาวได้ไม่เกิน 1000 ไบต์ UTF-8 (ภาษาไทยตัวละ 3 ไบต์) */
const INSTAGRAM_TEXT_MAX_BYTES = 1000;

/** token ใช้ไม่ได้ → บอกวิธีแก้ให้ตรงกับช่องทางที่เชื่อมไว้ */
const TOKEN_PROBLEM_MESSAGE: Record<GraphApi, string> = {
  facebook: systemMessage("pageTokenRejected"),
  instagram: INSTAGRAM_ERRORS.tokenRejected,
};

type EventInsert = typeof events.$inferInsert;

async function logEvent(db: Db, e: EventInsert): Promise<void> {
  await db.insert(events).values(e);
}

/**
 * ข้อความเข้า (คอมเมนต์ / DM) ที่ไม่ตรงกฎไหนเลย → บันทึกแค่ว่ามีข้อความเข้ามา ไว้นับสถิติ "ข้อความเข้า"
 * ไม่เก็บว่าใครส่ง (actorId / contactId) ข้อความ ชื่อ หรือ comment id — เก็บข้อมูลเฉพาะคนที่พิมพ์ตรง keyword
 * (migration 0007_keyword_only_contacts ล้างข้อมูลเก่าให้อยู่ในรูปเดียวกันนี้)
 * ข้อมูลที่ให้เจ้าของร้านตามตอบเองเก็บแยกในตาราง inbox_items (ลบเองเมื่อครบ 30 วัน — lib/inbox/capture.ts)
 */
function anonymousReceived(
  type: "comment_received" | "dm_received",
  platform: Platform,
  pageId: string,
  via: WebhookVia,
  postId: string | null = null,
): EventInsert {
  return { type, platform, pageId, postId, meta: { via, matched: false } };
}

/** งานที่เข้าคิวก่อนมีฟิลด์ via ถือว่ามาทาง Facebook Login */
function viaOf(job: { via?: WebhookVia }): WebhookVia {
  return job.via ?? "facebook_login";
}

/** จดว่าช่องทาง Instagram Login ส่งเหตุการณ์ประเภทนี้ (คอมเมนต์ / DM) ของบัญชีนี้มาแล้ว — หน้าตั้งค่าแสดงเวลาล่าสุด */
async function noteInstagramLoginDelivery(
  db: Db,
  conn: Connection,
  via: WebhookVia | undefined,
  kind: LoginKind,
): Promise<void> {
  if (via === "instagram_login" && conn.api === "instagram") await markInstagramLoginDelivery(db, conn.id, kind);
}

/**
 * DM ที่มาทาง Facebook Login ของบัญชีที่ใช้ Instagram Login อยู่ → ข้าม เมื่อช่องทาง Instagram Login ส่ง DM
 * ของบัญชีนี้มาแล้วภายใน 7 วัน ก่อนหน้านั้นยังประมวลผล (ส่งออกทาง Instagram Login) เผื่อ Meta ยังไม่ส่งทาง Instagram Login ให้
 * (ต้องเรียกก่อน claimOnce — สำเนาที่ข้ามจะได้ไม่จองคีย์กันซ้ำไว้)
 */
function skipFacebookDmCopy(conn: Connection, via: WebhookVia | undefined, mid: string, now = Date.now()): boolean {
  if ((via ?? "facebook_login") !== "facebook_login" || conn.api !== "instagram") return false;
  const at = conn.loginChannel?.messagingAt;
  if (at == null || now - at.getTime() >= LOGIN_CHANNEL_FRESH_MS) return false;
  console.info(`[webhook] ข้ามข้อความ ${mid} ที่มาทาง Facebook Login — @${conn.username} ใช้ Instagram Login แล้ว`);
  return true;
}

/** คอมเมนต์ของบัญชี Instagram ร้านเอง (เช่น คำตอบที่ระบบโพสต์) → ข้าม กันตอบตัวเองวนไปเรื่อยๆ */
function isOwnInstagramComment(conn: Connection, job: CommentJob): boolean {
  if (job.platform !== "instagram") return false;
  if (conn.igUserId && job.fromId === conn.igUserId) return true;
  return Boolean(conn.username && job.fromName?.toLowerCase() === conn.username.toLowerCase());
}

/** Instagram ปฏิเสธ token (code 190) → บันทึกไว้ที่บัญชี ให้หน้าตั้งค่าบอกว่าต้องวาง token ใหม่ */
async function noteRejectedToken(db: Db, conn: Connection, err: unknown): Promise<void> {
  if (conn.api !== "instagram" || !(err instanceof GraphApiError) || err.code !== 190) return;
  try {
    await updateInstagramAccountStatus(db, conn.id, { lastError: TOKEN_PROBLEM_MESSAGE.instagram });
  } catch (e) {
    console.error(`[instagram] บันทึกว่า token ของ @${conn.username} ใช้ไม่ได้ ไม่สำเร็จ:`, e);
  }
}

/** ตัดข้อความให้ไม่เกิน maxBytes ไบต์ (UTF-8) โดยไม่ตัดกลางตัวอักษร แล้วต่อท้ายด้วย "…" */
function fitUtf8Bytes(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  let budget = maxBytes - Buffer.byteLength("…", "utf8");
  let out = "";
  for (const ch of text) {
    const size = Buffer.byteLength(ch, "utf8");
    if (size > budget) break;
    out += ch;
    budget -= size;
  }
  return `${out}…`;
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
  const conn = await findConnection(db, job.platform, job.accountId);
  if (!conn) return; // webhook ของเพจ/บัญชีที่ยังไม่ได้เชื่อมต่อ
  // คอมเมนต์ของร้านเอง (เช่น คำตอบที่ระบบโพสต์) ไม่นับว่าช่องทาง Instagram Login ส่งคอมเมนต์ลูกค้ามาแล้ว
  if (isOwnInstagramComment(conn, job)) return;
  await noteInstagramLoginDelivery(db, conn, job.via, "comments");
  // คอมเมนต์ไม่ข้ามสำเนาจาก Facebook Login ตามเวลาแบบ DM: comment id เป็น ID เดียวกันทั้งสองช่องทาง claimOnce จึงกันตอบซ้ำได้พอดี
  // และถ้า Meta ส่งคอมเมนต์ทาง Instagram Login ให้เฉพาะบัญชีที่มีชื่อในแอป คอมเมนต์ลูกค้าจะยังมาทาง Facebook Login ได้ไม่หาย
  if (!(await claimOnce(db, `comment:${job.commentId}`))) return;
  const token = conn.token;
  const via = viaOf(job);

  // บันทึกว่ามีคอมเมนต์เข้ามาก่อนหากฎ (ลำดับในหน้ากิจกรรมจะได้มาก่อน "กฎเริ่มใช้กับโพสต์ใหม่แล้ว")
  // แต่ยังไม่เก็บว่าใครคอมเมนต์ / พิมพ์อะไร — ใส่ให้ทีหลังเฉพาะคอมเมนต์ที่ตรงกฎ
  const [received] = await db
    .insert(events)
    .values(anonymousReceived("comment_received", job.platform, conn.id, via, job.postId))
    .returning({ id: events.id });

  const { rule, lookupFailed } = await findCommentRule(db, conn, job);
  // ตรงกฎ หรือตรง keyword ของกฎ "โพสต์ถัดไป" แต่ถาม Meta ไม่สำเร็จ (คนนี้พิมพ์คำที่ตั้งไว้ และกิจกรรม "ข้าม"
  // ที่บันทึกไว้มีชื่อ/ข้อความของเขา ให้เจ้าของร้านตามตอบเองได้) → เก็บว่าใครคอมเมนต์ / พิมพ์อะไร
  if (rule || lookupFailed) {
    await db
      .update(events)
      .set({ actorId: job.fromId, text: job.text, meta: { commentId: job.commentId, fromName: job.fromName, via } })
      .where(eq(events.id, received.id));
  }
  if (!rule) {
    // ไม่มีกฎไหนตอบคอมเมนต์นี้ (ไม่ตรง keyword หรือเช็คโพสต์ถัดไปกับ Meta ไม่สำเร็จ) → ให้เจ้าของร้านตามตอบเองในหน้า "ข้อความรอตอบ"
    // ชื่อมากับ webhook: Facebook = from.name, Instagram = from.username (เก็บใน job.fromName)
    await captureInboxItem(db, {
      platform: job.platform,
      pageId: conn.id,
      kind: "comment",
      senderId: job.fromId,
      senderName: job.platform === "facebook" ? job.fromName : null,
      senderUsername: job.platform === "instagram" ? job.fromName : null,
      text: job.text,
      postId: job.postId,
      commentId: job.commentId,
    });
    return;
  }
  const firstStep = rule.steps[0];
  if (!firstStep) return;
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
        pageId: conn.id,
        ruleId: rule.id,
        actorId: job.fromId,
        postId: job.postId,
        text: job.text,
        meta: { reason: "once_per_user", commentId: job.commentId },
      });
      return;
    }
  }

  // เช็กหลัง "ตอบคนละครั้ง" — คนที่ได้ DM ไปแล้วไม่ถือว่าส่งไม่สำเร็จ แม้ตอนนี้ token ใช้ไม่ได้
  if (!token) {
    await logTokenProblem(db, job.platform, conn.id, rule.id, job.fromId, conn.api, "comment");
    return;
  }

  await logEvent(db, {
    type: "rule_triggered",
    platform: job.platform,
    pageId: conn.id,
    ruleId: rule.id,
    actorId: job.fromId,
    postId: job.postId,
    text: job.text,
    meta: { commentId: job.commentId, trigger: "comment", via },
  });

  const sendJob: SendDmJob = {
    type: "send_dm",
    platform: job.platform,
    pageId: conn.id,
    ruleId: rule.id,
    stepId: firstStep.id,
    source: "comment",
    recipient: { comment_id: job.commentId },
    actorId: job.fromId,
    actorName: job.platform === "facebook" ? firstName(job.fromName) : job.fromName,
    postId: job.postId,
    api: conn.api,
  };
  await enqueue(db, "send_dm", { ...sendJob });

  const publicReply = pickRandom(rule.publicReplies.filter((r) => r.trim()));
  if (publicReply) {
    const message = renderTemplate(publicReply, { name: sendJob.actorName });
    try {
      const res = await replyToComment(job.platform, job.commentId, token, message, conn.api);
      await logEvent(db, {
        type: "public_reply_sent",
        platform: job.platform,
        pageId: conn.id,
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
        pageId: conn.id,
        ruleId: rule.id,
        actorId: job.fromId,
        postId: job.postId,
        text: message,
        meta: { commentId: job.commentId, error: errorInfo(err) },
      });
      await noteRejectedToken(db, conn, err);
    }
  }
}

/**
 * หากฎคอมเมนต์ตามลำดับ priority แบบเดียวกับ findMatchingRule
 * แต่กฎ "โพสต์ถัดไป" ที่ยังไม่ได้ผูกโพสต์ของแพลตฟอร์มนี้ จะถาม Meta ว่าโพสต์นี้คือโพสต์ถัดไปหรือเปล่า
 * (เช็คข้อความก่อนเสมอ คอมเมนต์ที่ไม่ตรง keyword จะไม่ทำให้ต้องเรียก Graph API)
 * lookupFailed = ไม่มีกฎไหนตรง แต่มีกฎ "โพสต์ถัดไป" ที่ keyword ตรงและถาม Meta ไม่สำเร็จ (บันทึก "ข้าม" ไว้แล้ว)
 */
async function findCommentRule(db: Db, conn: Connection, job: CommentJob) {
  const incoming = { trigger: "comment" as const, platform: job.platform, text: job.text, postId: job.postId };
  const sorted = (await loadActiveRules(db, "comment")).sort((a, b) => a.priority - b.priority || a.id - b.id);
  let lookupFailed = false;
  for (const rule of sorted) {
    if (findMatchingRule([rule], incoming)) return { rule, lookupFailed };
    if (postScopeMatches(rule, job.platform, job.postId) !== "resolve") continue;
    // เงื่อนไขอื่น (เปิดอยู่, แพลตฟอร์ม, keyword) ต้องผ่านก่อน — เช็คโดยมองข้ามเรื่องโพสต์ไปชั่วคราว
    if (!findMatchingRule([{ ...rule, postScope: "any" as const }], incoming)) continue;
    // conn.api ทำให้ถามข้อมูลโพสต์ผ่าน API เดียวกับที่ใช้ตอบ (Instagram Login → graph.instagram.com)
    const check = await checkNextPost(db, rule, job.platform, conn, job.postId, {
      commentId: job.commentId,
      actorId: job.fromId,
      text: job.text,
    });
    if (check === "match") return { rule, lookupFailed };
    if (check === "lookup_failed") lookupFailed = true;
  }
  return { rule: null, lookupFailed };
}

// ---------------------------------------------------------------------------
// เพจลงโพสต์ใหม่บน Facebook → ผูกกฎ "โพสต์ถัดไป" ที่รออยู่ทันที
// ---------------------------------------------------------------------------

export async function handlePagePost(db: Db, job: PagePostJob): Promise<void> {
  const conn = await findConnection(db, "facebook", job.accountId);
  if (!conn) return;
  // โพสต์หลายรูปส่ง webhook มาหลายครั้งด้วย post_id เดียวกัน
  if (!(await claimOnce(db, `page_post:${job.postId}`))) return;
  await bindPublishedFacebookPost(db, conn.id, { id: job.postId, createdMs: job.createdTime, caption: job.caption });
}

// ---------------------------------------------------------------------------
// มีคนทัก DM มา → หา rule → ตรง keyword (หรือกดปุ่มของเรา) ค่อยบันทึก contact → ตอบกลับ
// ---------------------------------------------------------------------------

/**
 * contact ที่ยังไม่รู้ชื่อ → ดึงชื่อจากโปรไฟล์ (ไม่ได้ก็ไม่เป็นไร ส่งข้อความต่อได้ตามปกติ)
 * Facebook: Meta ให้ดูโปรไฟล์เฉพาะคนที่มีบทบาทในแอป ถ้ายังไม่ได้ Advanced Access
 * → ดึงไม่ได้/ไม่ได้ชื่อ ลองหาชื่อจากห้องแชท Messenger ของเพจแทน (Instagram ไม่ใช้ทางนี้)
 */
async function fillContactName(
  db: Db,
  conn: Connection,
  job: DmJob,
  contact: { id: number; name: string | null; username: string | null },
): Promise<{ name: string | null; username: string | null }> {
  let { name, username } = contact;
  if (name || username || !conn.token) return { name, username };
  try {
    const profile = await fetchProfile(job.platform, job.senderId, conn.token, conn.api);
    name = profile.name;
    username = profile.username;
  } catch (err) {
    await noteRejectedToken(db, conn, err);
  }
  if (!name && job.platform === "facebook" && conn.api === "facebook") {
    try {
      name = await fetchMessengerParticipantName(conn.id, job.senderId, conn.token);
    } catch (err) {
      // ไม่ได้ชื่อก็ส่งข้อความต่อได้ตามปกติ
      console.warn("[dm] หาชื่อลูกค้าจากห้องแชทของเพจไม่สำเร็จ:", (err as Error).message);
    }
  }
  if (name || username) {
    await db
      .update(contacts)
      .set({ name: sql`coalesce(${contacts.name}, ${name})`, username: sql`coalesce(${contacts.username}, ${username})` })
      .where(eq(contacts.id, contact.id));
  }
  return { name, username };
}

/**
 * คนที่พิมพ์ตรง keyword หรือกดปุ่มในข้อความของเรา → บันทึก/อัปเดต contact (เวลาทักล่าสุด + ชื่อ)
 * คืน id และชื่อที่ใช้แทน {name} ในข้อความ (Facebook ใช้ชื่อต้น, Instagram ใช้ username)
 */
async function saveKeywordContact(db: Db, conn: Connection, job: DmJob): Promise<{ id: number; actorName: string | null }> {
  const contact = await upsertContact(db, {
    platform: job.platform,
    platformUserId: job.senderId,
    pageId: conn.id,
    inbound: true,
  });
  const { name, username } = await fillContactName(db, conn, job, contact);
  return { id: contact.id, actorName: job.platform === "facebook" ? firstName(name) : (username ?? name) };
}

export async function handleDm(db: Db, job: DmJob): Promise<void> {
  const conn = await findConnection(db, job.platform, job.accountId);
  if (!conn) return;
  await noteInstagramLoginDelivery(db, conn, job.via, "messaging");
  if (skipFacebookDmCopy(conn, job.via, job.mid)) return;
  if (!(await claimOnce(db, `dm:${job.mid}`))) return;
  const via = viaOf(job);

  // ลูกค้ากดปุ่มในข้อความของเรา (เคยได้ DM จากกฎแล้ว) → ส่งข้อความถัดไป (ไม่ต้องเอาไปจับ keyword ซ้ำ)
  const tap = parseFlowPayload(job.payload);
  if (tap) {
    const contact = await saveKeywordContact(db, conn, job);
    await handleButtonTap(db, conn, job, contact.id, contact.actorName, tap);
    return;
  }

  const rule = findMatchingRule(await loadActiveRules(db, "dm"), {
    trigger: "dm",
    platform: job.platform,
    text: job.text || job.payload || "",
  });
  if (!rule) {
    // ไม่ตรง keyword → ไม่สร้าง contact และไม่เก็บว่าใครทัก/ทักว่าอะไร
    // (ถ้าเป็นลูกค้าที่เคยพิมพ์ keyword อยู่แล้ว แค่อัปเดตเวลา "ทักมาล่าสุด")
    await db
      .update(contacts)
      .set({ lastInboundAt: new Date() })
      .where(and(eq(contacts.platform, job.platform), eq(contacts.platformUserId, job.senderId)));
    await logEvent(db, anonymousReceived("dm_received", job.platform, conn.id, via));
    // ไม่มีกฎไหนตอบ → ขึ้นในหน้า "ข้อความรอตอบ" แยกจาก contacts (ลบเองเมื่อครบ 30 วัน)
    // ไม่ถามชื่อจาก Meta ตรงนี้ — ถามตอนเจ้าของร้านเปิดหน้านั้น (lib/inbox/details.ts)
    await captureInboxItem(db, {
      platform: job.platform,
      pageId: conn.id,
      kind: "dm",
      senderId: job.senderId,
      text: job.text,
      mid: job.mid,
    });
    return;
  }

  const contact = await saveKeywordContact(db, conn, job);
  await logEvent(db, {
    type: "dm_received",
    platform: job.platform,
    pageId: conn.id,
    contactId: contact.id,
    actorId: job.senderId,
    text: job.text,
    meta: { mid: job.mid, payload: job.payload, via },
  });

  const firstStep = rule.steps[0];
  if (!firstStep) return;
  if (!conn.token) {
    await logTokenProblem(db, job.platform, conn.id, rule.id, job.senderId, conn.api, "dm");
    return;
  }

  await logEvent(db, {
    type: "rule_triggered",
    platform: job.platform,
    pageId: conn.id,
    ruleId: rule.id,
    contactId: contact.id,
    actorId: job.senderId,
    text: job.text,
    meta: { mid: job.mid, trigger: "dm", via },
  });

  const sendJob: SendDmJob = {
    type: "send_dm",
    platform: job.platform,
    pageId: conn.id,
    ruleId: rule.id,
    stepId: firstStep.id,
    source: "dm",
    recipient: { id: job.senderId },
    actorId: job.senderId,
    actorName: contact.actorName,
    postId: null,
    api: conn.api,
  };
  await enqueue(db, "send_dm", { ...sendJob });
}

/** ลูกค้ากดปุ่ม "ส่งข้อความถัดไป" → บันทึกการกด แล้วส่งข้อความที่ปุ่มนั้นพาไป */
async function handleButtonTap(
  db: Db,
  conn: Connection,
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
    pageId: conn.id,
    ruleId: rule ? rule.id : null,
    contactId,
    actorId: job.senderId,
    text: job.text,
    meta: { mid: job.mid, stepId: tap.stepId, buttonId: tap.buttonId, via: viaOf(job) },
  });

  // ปุ่มจากข้อความเก่าที่ถูกแก้/ลบไปแล้ว → ส่งต่อไม่ได้ บันทึกไว้ให้เห็นใน "ปัญหาที่ต้องดู" (ลูกค้ากดแล้วไม่มีอะไรเกิดขึ้น)
  const next = button?.type === "next" ? rule?.steps.find((s) => s.id === button.nextStepId) : undefined;
  // (ปุ่มที่ส่ง postback มาได้คือปุ่ม "ส่งข้อความถัดไป" ตอนที่ส่งข้อความนั้น — ถ้าตอนนี้กลายเป็นลิงก์ก็ส่งต่อไม่ได้เหมือนกัน)
  if (!rule || !next) {
    await logEvent(db, {
      type: "skipped",
      platform: job.platform,
      pageId: conn.id,
      ruleId: rule ? rule.id : null,
      contactId,
      actorId: job.senderId,
      text: job.text,
      meta: { reason: "button_target_missing", stepId: tap.stepId, buttonId: tap.buttonId },
    });
    return;
  }
  if (!rule.active) {
    await logEvent(db, {
      type: "skipped",
      platform: job.platform,
      pageId: conn.id,
      ruleId: rule.id,
      contactId,
      actorId: job.senderId,
      text: job.text,
      meta: { reason: "rule_inactive" },
    });
    return;
  }
  if (!conn.token) {
    await logTokenProblem(db, job.platform, conn.id, rule.id, job.senderId, conn.api, "button");
    return;
  }

  const sendJob: SendDmJob = {
    type: "send_dm",
    platform: job.platform,
    pageId: conn.id,
    ruleId: rule.id,
    stepId: next.id,
    source: "button",
    recipient: { id: job.senderId },
    actorId: job.senderId,
    actorName,
    postId: null,
    api: conn.api,
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

const HOUR_MS = 60 * 60_000;

/**
 * ลิมิตต่อชั่วโมงของบัญชีหนึ่ง (Connection.id) ตามที่ตั้งใน env (ดู lib/env.ts):
 * - Private Reply (ส่งถึง comment_id) มีโควตาของตัวเอง นับเฉพาะ Private Reply (messages.source = "comment")
 * - *_DM_PER_HOUR (ถ้าตั้งไว้) นับ DM ทุกแบบ
 * นับทุกครั้งที่ยิงไปหา Meta (ส่งสำเร็จหรือไม่ก็ตาม) เพราะ Meta นับจำนวนครั้งที่เรียก API
 */
interface HourlyCap {
  limit: number;
  privateRepliesOnly: boolean;
  note: string;
}

/** DM ที่ส่งถึง comment_id = Private Reply (DM แรกที่ตอบคอมเมนต์ ระบบบันทึก source เป็น "comment") */
function isPrivateReply(data: SendDmJob): boolean {
  return "comment_id" in data.recipient;
}

function hourlyCaps(data: SendDmJob): HourlyCap[] {
  const instagram = data.platform === "instagram";
  const caps: HourlyCap[] = [];
  // ลิมิตต้องเป็นจำนวนเต็ม (ค่าใน env อาจมีทศนิยม) และ 0 หรือติดลบ = ไม่จำกัด
  const all = Math.floor(instagram ? env.instagramDmPerHour : env.facebookDmPerHour);
  if (all > 0) {
    caps.push({ limit: all, privateRepliesOnly: false, note: systemMessage("capDm", { limit: String(all) }) });
  }
  if (isPrivateReply(data)) {
    const privateReplies = Math.floor(instagram ? env.instagramPrivateReplyPerHour : env.facebookPrivateReplyPerHour);
    if (privateReplies > 0) {
      caps.push({
        limit: privateReplies,
        privateRepliesOnly: true,
        note: systemMessage("capPrivateReply", { limit: String(privateReplies) }),
      });
    }
  }
  return caps;
}

/** ถ้าส่งครบโควตาชั่วโมงนี้แล้ว คืนเวลาที่ส่งต่อได้พร้อมเหตุผล ไม่งั้นคืน null */
async function nextAllowedSendTime(db: Db, pageId: string, data: SendDmJob): Promise<{ at: Date; note: string } | null> {
  const since = new Date(Date.now() - HOUR_MS);
  let wait: { at: Date; note: string } | null = null;
  for (const cap of hourlyCaps(data)) {
    // ข้อความลำดับที่ limit นับจากล่าสุด — พอข้อความนี้พ้นหน้าต่าง 1 ชม. จำนวนก็จะต่ำกว่าลิมิต
    const [edge] = await db
      .select({ sentAt: messages.sentAt })
      .from(messages)
      .where(
        and(
          eq(messages.pageId, pageId),
          eq(messages.platform, data.platform),
          gte(messages.sentAt, since),
          cap.privateRepliesOnly ? eq(messages.source, "comment") : undefined,
        ),
      )
      .orderBy(desc(messages.sentAt))
      .offset(cap.limit - 1)
      .limit(1);
    if (!edge) continue;
    const at = new Date(edge.sentAt.getTime() + HOUR_MS + 5_000);
    if (!wait || at > wait.at) wait = { at, note: cap.note };
  }
  return wait;
}

/**
 * error ที่ Meta ใช้บอกว่า "เรียกถี่เกิน/เกินโควตา": 4 (ทั้งแอป), 17 (ผู้ใช้), 32 (เพจ), 613 (ลิมิตเฉพาะ API),
 * 80001 / 80002 / 80004 / 80006 (Business Use Case: เพจ / Instagram / Ads Management / Messenger)
 * และ subcode 2534040 (จำกัดจำนวนการส่งข้อความ)
 */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80001, 80002, 80004, 80006]);
const RATE_LIMIT_SUBCODES = new Set([2534040]);

export function isRateLimitError(err: unknown): err is GraphApiError {
  if (!(err instanceof GraphApiError)) return false;
  return (
    (err.code !== undefined && RATE_LIMIT_CODES.has(err.code)) ||
    (err.subcode !== undefined && RATE_LIMIT_SUBCODES.has(err.subcode))
  );
}

/** Meta ขอให้ชะลอได้กี่รอบก่อนเลิกส่ง (รอ 1+2+4+8+15×6 ≈ 1 ชม. 45 นาที ครอบคลุมลิมิตรายชั่วโมงของ Meta) */
export const RATE_LIMIT_MAX_WAITS = 10;

/** รอก่อนลองใหม่หลังโดนชะลอรอบที่ hits: 1, 2, 4, 8 แล้ว 15 นาทีทุกรอบ */
export function rateLimitDelayMs(hits: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, hits - 1), 15 * 60_000);
}

function errorCodeText(err: GraphApiError): string {
  return [err.code, err.subcode].filter((v) => v !== undefined).join(" / ");
}

/**
 * Meta ขอให้ชะลอ → เลื่อนงานนี้ออกไป (ไม่นับเป็นความล้มเหลว) และเลื่อนงานส่ง DM อื่นที่รออยู่ของบัญชีเดียวกันไปพร้อมกัน
 * (ไม่ยิงซ้ำระหว่างโดนชะลอ ซึ่งอาจทำให้ Meta ชะลอนานขึ้น) แล้วบันทึกในหน้ากิจกรรมครั้งเดียวต่อบัญชีต่อชั่วโมง
 */
async function pauseForRateLimit(db: Db, job: Job, next: SendDmJob, conn: Connection, err: GraphApiError): Promise<void> {
  const hits = next.rateLimitHits ?? 1;
  const delayMs = rateLimitDelayMs(hits);
  const runAt = new Date(Date.now() + delayMs);
  const code = errorCodeText(err);
  const minutes = Math.round(delayMs / 60_000);
  const note = systemMessage("rateLimitWait", {
    code,
    hits: String(hits),
    max: String(RATE_LIMIT_MAX_WAITS),
    minutes: String(minutes),
  });
  await rescheduleJob(db, job, runAt, note, { ...next });
  await postponePendingJobs(
    db,
    "send_dm",
    { platform: next.platform, pageId: [...new Set([conn.id, next.pageId])] },
    runAt,
    systemMessage("rateLimitWaitAccount", { note }),
  );
  if (hits !== 1 || !(await claimOnce(db, `rate_limited:${next.platform}:${conn.id}:${Math.floor(Date.now() / HOUR_MS)}`))) {
    return;
  }
  await logEvent(db, {
    type: "dm_rate_limited",
    platform: next.platform,
    pageId: conn.id,
    text: systemMessage("rateLimitNotice", { code, minutes: String(minutes) }),
    meta: {
      api: conn.api,
      // ชื่อเพจหรือ "@username" ของบัญชีร้าน (หน้ากิจกรรมแสดงว่าบัญชีไหนโดนชะลอ)
      accountName: conn.name,
      source: next.source,
      stepId: next.stepId,
      retryAt: runAt.toISOString(),
      rateLimit: { message: err.message, code: err.code, subcode: err.subcode, status: err.status },
    },
  });
}

export async function handleSendDm(db: Db, job: Job): Promise<void> {
  const data = job.payload as unknown as SendDmJob;
  // งานเก่าไม่มี api (pageId = Page ID) → ถ้าบัญชี IG ของเพจเชื่อม Instagram Login ไว้ จะส่งผ่าน Instagram Login
  const conn = await getConnection(db, data.platform, data.pageId, data.api);
  const rule = await db.query.rules.findFirst({ where: eq(rules.id, data.ruleId) });
  if (!conn || !rule) return;
  // งานที่เข้าคิวไว้ก่อนอัปเดตเป็นแบบหลายข้อความจะไม่มี stepId → ส่งข้อความแรก
  const step = data.stepId ? rule.steps.find((s) => s.id === data.stepId) : rule.steps[0];
  if (!step) {
    // ข้อความถูกลบออกจากกฎระหว่างรอส่ง
    await logEvent(db, {
      type: "dm_failed",
      platform: data.platform,
      pageId: conn.id,
      ruleId: rule.id,
      actorId: data.actorId,
      postId: data.postId,
      meta: {
        api: conn.api,
        source: data.source,
        stepId: data.stepId,
        error: { message: systemMessage("stepMissing") },
      },
    });
    return;
  }
  const token = conn.token;
  if (!token) {
    await logTokenProblem(db, data.platform, conn.id, rule.id, data.actorId, conn.api, data.source);
    return;
  }

  const wait = await nextAllowedSendTime(db, conn.id, data);
  if (wait) {
    await rescheduleJob(db, job, wait.at, systemMessage("capWait", { note: wait.note }));
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
  const fitted = fitText(renderTemplate(step.text, { name: data.actorName }) || (buttons.length ? "👇" : ""), maxLength);
  // Instagram Login นับลิมิตข้อความธรรมดาเป็นไบต์ (ภาษาไทย 1000 ตัวอักษรเกินแน่นอน)
  const text =
    conn.api === "instagram" && buttons.length === 0 ? fitUtf8Bytes(fitted, INSTAGRAM_TEXT_MAX_BYTES) : fitted;
  const logText = buttons.length ? `${text}\n\n${buttons.map((b) => `[${b.title}]`).join(" ")}` : text;
  const codes = Object.values(linkCodes);

  let res: SendResult;
  try {
    res = await sendMessage(conn.messagingId, token, data.recipient, buildMessage(text, buttons), conn.api);
  } catch (err) {
    // Meta ขอให้ชะลอ → รอแล้วลองใหม่ (ไม่กินจำนวนครั้งที่ลองได้) จนครบ RATE_LIMIT_MAX_WAITS รอบ แล้วค่อยถือว่าส่งไม่สำเร็จ
    const rateLimitHits = isRateLimitError(err) ? (data.rateLimitHits ?? 0) + 1 : 0;
    if (isRateLimitError(err) && rateLimitHits <= RATE_LIMIT_MAX_WAITS) {
      await pauseForRateLimit(db, job, { ...data, linkCodes, rateLimitHits }, conn, err);
      throw new RescheduledError();
    }
    if (!rateLimitHits && err instanceof GraphApiError && err.retryable && job.attempts < job.maxAttempts) throw err;
    // ส่งไม่สำเร็จแน่แล้ว → ลบลิงก์ทิ้ง เพื่อไม่ให้ไปถ่วงสถิติ % คลิก
    if (codes.length) await db.delete(links).where(inArray(links.code, codes));
    await db.insert(messages).values({
      platform: data.platform,
      pageId: conn.id,
      ruleId: rule.id,
      stepId: step.id,
      source: data.source,
      status: "failed",
      error: (err as Error).message.slice(0, 1000),
    });
    await logEvent(db, {
      type: "dm_failed",
      platform: data.platform,
      pageId: conn.id,
      ruleId: rule.id,
      actorId: data.actorId,
      postId: data.postId,
      text: logText,
      meta: {
        api: conn.api,
        source: data.source,
        stepId: step.id,
        error: errorInfo(err),
        ...(rateLimitHits > 0 && { rateLimitHits }),
      },
    });
    await noteRejectedToken(db, conn, err);
    return;
  }

  // ส่งถึงลูกค้าแล้ว: ถ้าบันทึกสถิติพลาด ห้ามโยน error ออกไป ไม่งั้นงานจะถูกลองใหม่และส่ง DM ซ้ำ
  try {
    await recordSent(db, data, conn.id, rule.id, step.id, res, logText, codes);
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
  // Private Reply: ตอนคอมเมนต์เข้ามายังไม่รู้ว่าเป็น contact ไหน (ได้ PSID/IGSID ตอนส่ง DM สำเร็จ)
  // → ผูก "ตรงกับกฎ" ของคอมเมนต์นี้กับ contact หน้ารายชื่อลูกค้าจะแสดงคอมเมนต์ล่าสุดของคนที่ไม่รู้ชื่อได้
  // (ทำหลังบันทึก dm_sent — ถ้าขั้นนี้พลาด สถิติการส่งยังครบ)
  if (contact && "comment_id" in data.recipient) {
    await db
      .update(events)
      .set({ contactId: contact.id })
      .where(
        and(
          eq(events.ruleId, ruleId),
          gte(events.createdAt, new Date(Date.now() - 7 * 24 * HOUR_MS)), // ใช้ index (rule_id, created_at)
          eq(events.type, "rule_triggered"),
          isNull(events.contactId),
          sql`${events.meta}->>'commentId' = ${data.recipient.comment_id}`,
        ),
      );
  }
}

/** ใช้บอก worker ว่างานถูกเลื่อนเวลาแล้ว ไม่ต้องทำเครื่องหมายว่าเสร็จ */
export class RescheduledError extends Error {
  constructor() {
    super("rescheduled");
    this.name = "RescheduledError";
  }
}

/** token ของเพจ / บัญชี Instagram ใช้ไม่ได้ → บันทึกให้เห็นในหน้ากิจกรรม พร้อมบอกวิธีแก้ตามช่องทางที่เชื่อมไว้ */
async function logTokenProblem(
  db: Db,
  platform: Platform,
  pageId: string,
  ruleId: number,
  actorId: string,
  api: GraphApi,
  source: MessageSource,
): Promise<void> {
  await logEvent(db, {
    type: "dm_failed",
    platform,
    pageId,
    ruleId,
    actorId,
    meta: { api, source, error: { message: TOKEN_PROBLEM_MESSAGE[api] } },
  });
}
