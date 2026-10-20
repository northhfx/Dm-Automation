import { sql } from "drizzle-orm";
import type { FlowCanvas, FlowStep } from "@/lib/flows/types";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type Platform = "facebook" | "instagram";
export type TriggerType = "comment" | "dm";
export type MatchType = "contains" | "exact" | "any";
/**
 * กฎคอมเมนต์ใช้กับโพสต์ไหน: ทุกโพสต์/รีล, เฉพาะที่เลือก (postIds),
 * หรือโพสต์/รีลถัดไปที่ลงหลังบันทึกกฎ (ระบบผูกให้อัตโนมัติ แยก Facebook กับ Instagram — ดู boundPosts)
 */
export type PostScope = "any" | "specific" | "next";
/** โพสต์ที่กฎแบบ "โพสต์ถัดไป" ผูกไว้แล้ว ของแต่ละแพลตฟอร์ม */
export type BoundPosts = Partial<Record<Platform, { id: string; boundAt: string }>>;
/** ข้อความถูกส่งเพราะ: คอมเมนต์, ทัก DM, หรือลูกค้ากดปุ่มในข้อความก่อนหน้า */
export type MessageSource = TriggerType | "button";
/** ช่องทาง API ที่ใช้คุยกับบัญชี: "facebook" = graph.facebook.com + Page token, "instagram" = graph.instagram.com + Instagram Login token */
export type GraphApi = "facebook" | "instagram";
/** webhook มาทางไหน (ตัดสินจาก secret ที่ลายเซ็นตรง) */
export type WebhookVia = "facebook_login" | "instagram_login";

/** Facebook Page ที่เชื่อมต่อแล้ว (และบัญชี Instagram ที่ผูกกับเพจนั้น ถ้ามี) */
export const pages = pgTable("pages", {
  id: text("id").primaryKey(), // Facebook Page ID
  name: text("name").notNull(),
  accessToken: text("access_token").notNull(), // เข้ารหัสไว้ (ดู lib/crypto.ts)
  igUserId: text("ig_user_id"),
  igUsername: text("ig_username"),
  subscribed: boolean("subscribed").notNull().default(false),
  lastError: text("last_error"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});

/** บัญชี Instagram ที่เชื่อมแยกผ่าน Instagram Login (ไม่ขึ้นกับเพจ Facebook) */
export const instagramAccounts = pgTable(
  "instagram_accounts",
  {
    id: text("id").primaryKey(), // /me user_id = entry.id ใน webhook = ค่าที่เก็บใน pageId ของ contacts/messages/events
    appScopedId: text("app_scoped_id"), // /me id (ห้ามใช้ส่งข้อความ เก็บไว้จับคู่ webhook เท่านั้น)
    username: text("username").notNull(),
    name: text("name"),
    accountType: text("account_type"),
    accessToken: text("access_token").notNull(), // เข้ารหัส (lib/crypto.ts)
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    tokenExpiryEstimated: boolean("token_expiry_estimated").notNull().default(false),
    tokenRefreshedAt: timestamp("token_refreshed_at", { withTimezone: true }).notNull().defaultNow(),
    tokenCheckedAt: timestamp("token_checked_at", { withTimezone: true }), // ลองต่ออายุครั้งล่าสุด (สำเร็จหรือไม่ก็ตาม)
    subscribed: boolean("subscribed").notNull().default(false),
    lastError: text("last_error"),
    lastCommentWebhookAt: timestamp("last_comment_webhook_at", { withTimezone: true }), // รับคอมเมนต์ผ่าน Instagram Login ล่าสุด
    lastMessagingWebhookAt: timestamp("last_messaging_webhook_at", { withTimezone: true }), // รับ DM/กดปุ่มผ่าน Instagram Login ล่าสุด
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("instagram_accounts_app_scoped_idx").on(t.appScopedId)],
);
export type InstagramAccountRow = typeof instagramAccounts.$inferSelect;

/** โฟลเดอร์ (โปรเจกต์) สำหรับจัดกลุ่มกฎในหน้ากฎอัตโนมัติ — ชั้นเดียว กฎหนึ่งอยู่ได้โฟลเดอร์เดียว (ไม่มีผลกับการตอบ) */
export const ruleFolders = pgTable("rule_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** กฎอัตโนมัติ: เมื่อเจอ keyword → ตอบคอมเมนต์ / ส่ง DM */
export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  trigger: text("trigger").$type<TriggerType>().notNull(),
  platforms: text("platforms").array().$type<Platform[]>().notNull(),
  matchType: text("match_type").$type<MatchType>().notNull().default("contains"),
  keywords: text("keywords").array().notNull().default([]),
  postScope: text("post_scope").$type<PostScope>().notNull().default("any"),
  postIds: text("post_ids").array().notNull().default([]), // ใช้เมื่อ postScope = "specific"
  /** กฎแบบ "โพสต์ถัดไป": เริ่มรอโพสต์ที่ลงตั้งแต่เวลานี้ */
  nextPostSince: timestamp("next_post_since", { withTimezone: true }),
  boundPosts: jsonb("bound_posts").$type<BoundPosts>().notNull().default({}),
  publicReplies: text("public_replies").array().notNull().default([]),
  /** ข้อความที่จะส่ง ข้อความแรกคือข้อความเริ่มต้น ข้อความถัดไปส่งเมื่อลูกค้ากดปุ่ม */
  steps: jsonb("steps").$type<FlowStep[]>().notNull().default([]),
  /** ตำแหน่งการ์ดบนแผนผังที่ผู้ใช้จัดเอง (null = จัดเรียงอัตโนมัติ) */
  canvas: jsonb("canvas").$type<FlowCanvas>(),
  oncePerUser: boolean("once_per_user").notNull().default(true),
  priority: integer("priority").notNull().default(100),
  /** โฟลเดอร์ (null = ไม่อยู่ในโฟลเดอร์) — ลบโฟลเดอร์แล้วกฎยังอยู่ */
  folderId: integer("folder_id").references(() => ruleFolders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ลูกค้าที่คอมเมนต์/ทักตรง keyword ของกฎ หรือกดปุ่มในข้อความของเรา (PSID สำหรับ Facebook, IGSID สำหรับ Instagram)
 * คนที่ทักเรื่องอื่นไม่ถูกเก็บที่นี่ — ดู lib/automation/handlers.ts และ migration 0007_keyword_only_contacts
 */
export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    platform: text("platform").$type<Platform>().notNull(),
    platformUserId: text("platform_user_id").notNull(),
    pageId: text("page_id").notNull(),
    name: text("name"),
    username: text("username"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("contacts_platform_user_idx").on(t.platform, t.platformUserId),
    index("contacts_first_seen_idx").on(t.firstSeenAt),
  ],
);

/** ข้อความที่ระบบส่งออกไป ใช้คำนวณสถิติส่งสำเร็จ / อ่านแล้ว */
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    platform: text("platform").$type<Platform>().notNull(),
    pageId: text("page_id").notNull(),
    contactId: integer("contact_id"),
    ruleId: integer("rule_id"),
    source: text("source").$type<MessageSource>().notNull(),
    stepId: text("step_id"),
    mid: text("mid"),
    status: text("status").$type<"sent" | "failed">().notNull(),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("messages_sent_at_idx").on(t.sentAt),
    index("messages_rule_idx").on(t.ruleId, t.sentAt),
    index("messages_contact_idx").on(t.contactId),
    index("messages_mid_idx").on(t.mid),
  ],
);

/** ลิงก์ติดตามการคลิก: /r/<code> → linkUrl */
export const links = pgTable(
  "links",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    targetUrl: text("target_url").notNull(),
    ruleId: integer("rule_id"),
    stepId: text("step_id"),
    buttonId: text("button_id"),
    contactId: integer("contact_id"),
    platform: text("platform").$type<Platform>(),
    clicks: integer("clicks").notNull().default(0),
    firstClickedAt: timestamp("first_clicked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("links_code_idx").on(t.code),
    index("links_rule_idx").on(t.ruleId, t.createdAt),
    // ยอดคลิกของลูกค้าแต่ละคน (หน้ารายชื่อลูกค้า)
    index("links_contact_idx").on(t.contactId),
  ],
);

/**
 * บันทึกเหตุการณ์ทั้งหมด ใช้ทำสถิติและหน้า Activity
 * type: comment_received | dm_received | rule_triggered | public_reply_sent |
 *       public_reply_failed | dm_sent | dm_failed | button_clicked | link_clicked | skipped |
 *       post_bound (กฎแบบ "โพสต์ถัดไป" ผูกกับโพสต์แล้ว)
 */
export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: text("type").notNull(),
    platform: text("platform").$type<Platform>(),
    pageId: text("page_id"),
    ruleId: integer("rule_id"),
    contactId: integer("contact_id"),
    actorId: text("actor_id"), // id ของคนที่คอมเมนต์ / ทักมา
    postId: text("post_id"),
    text: text("text"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_type_created_idx").on(t.type, t.createdAt),
    index("events_rule_created_idx").on(t.ruleId, t.createdAt),
    index("events_created_idx").on(t.createdAt),
    // ข้อความล่าสุดของลูกค้าแต่ละคน (หน้ารายชื่อลูกค้า) — เฉพาะแถวที่ผูกกับ contact
    // ข้อความเข้าที่ไม่ตรงกฎ (ส่วนใหญ่ของตาราง) ไม่มี contact_id จึงไม่เพิ่มขนาด index
    index("events_contact_created_idx").on(t.contactId, t.createdAt).where(sql`${t.contactId} IS NOT NULL`),
    // หา contact ของคนคอมเมนต์จากกิจกรรมอื่นของคนเดียวกัน (นับคนบนหน้าภาพรวม — lib/funnel.ts)
    index("events_actor_contact_idx")
      .on(t.platform, t.actorId, t.contactId)
      .where(sql`${t.contactId} IS NOT NULL AND ${t.type} IN ('rule_triggered', 'dm_sent')`),
  ],
);

/** รายการในหน้า "ข้อความรอตอบ": แชท 1 ข้อความ หรือคอมเมนต์ 1 อัน */
export type InboxKind = "dm" | "comment";

/**
 * ข้อความรอตอบ (/inbox): คนที่ทัก DM หรือคอมเมนต์โดยไม่ตรง keyword ของกฎไหน (ระบบไม่ได้ตอบให้)
 * แยกจาก contacts โดยตั้งใจ — เก็บแค่พอให้เจ้าของร้านกดไปตอบเอง และลบอัตโนมัติเมื่อครบ 30 วัน
 * (INBOX_RETENTION_DAYS ใน lib/inbox/retention.ts) ส่วน events ของข้อความเหล่านี้ยังไม่ระบุตัวตนเหมือนเดิม
 */
export const inboxItems = pgTable(
  "inbox_items",
  {
    id: serial("id").primaryKey(),
    platform: text("platform").$type<Platform>().notNull(),
    /** Connection.id แบบเดียวกับ events.page_id: Page ID (Facebook / Instagram ผ่านเพจ) หรือ IG account ID (Instagram Login) */
    pageId: text("page_id").notNull(),
    kind: text("kind").$type<InboxKind>().notNull(),
    /** PSID / IGSID (แชท) หรือ from.id (คอมเมนต์) */
    senderId: text("sender_id").notNull(),
    senderName: text("sender_name"),
    senderUsername: text("sender_username"),
    /** ข้อความที่ลูกค้าพิมพ์ (ตัดไว้ไม่เกิน 1000 ตัวอักษร) — ว่าง = ส่งรูป/สติกเกอร์/ไฟล์ */
    text: text("text").notNull().default(""),
    /** message id ของแชท (กันบันทึกซ้ำ) */
    mid: text("mid"),
    postId: text("post_id"),
    commentId: text("comment_id"),
    /** ลิงก์โพสต์จาก Meta (Instagram) — null = ยังไม่รู้ */
    permalink: text("permalink"),
    /** ถาม Meta หาชื่อ/username/ลิงก์โพสต์ที่ขาดแล้ว (สำเร็จหรือไม่ก็ตาม) — null = ยังไม่ได้ถาม */
    detailsCheckedAt: timestamp("details_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** เจ้าของร้านกด "เสร็จแล้ว" — null = ยังรอตอบ */
    handledAt: timestamp("handled_at", { withTimezone: true }),
  },
  (t) => [
    // รายการที่ยังรอตอบ ใหม่สุดก่อน (หน้า /inbox และตัวเลขบนเมนู)
    index("inbox_items_open_idx").on(t.handledAt, t.createdAt.desc()),
    // แสดงรายการที่เสร็จแล้วด้วย + ลบรายการที่เกิน 30 วัน
    index("inbox_items_created_idx").on(t.createdAt),
    // แชทของคนเดียวกัน (รวมเป็นแถวเดียว / เติมชื่อให้ทุกแถวของคนนั้น)
    index("inbox_items_sender_idx").on(t.platform, t.senderId),
    // กันบันทึกซ้ำ: คอมเมนต์เดิม / ข้อความเดิม (NULL ไม่ชนกัน)
    uniqueIndex("inbox_items_comment_idx").on(t.kind, t.commentId),
    uniqueIndex("inbox_items_mid_idx").on(t.kind, t.mid),
  ],
);
export type InboxItem = typeof inboxItems.$inferSelect;

/** คิวงานแบบง่ายบน Postgres (ไม่ต้องใช้ Redis) */
export const jobs = pgTable(
  "jobs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").$type<"pending" | "running" | "done" | "failed">().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("jobs_status_run_at_idx").on(t.status, t.runAt)],
);

/** กันประมวลผล webhook ซ้ำ (Meta อาจส่ง event เดิมมาซ้ำได้) */
export const dedupKeys = pgTable("dedup_keys", {
  key: text("key").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** webhook ดิบที่ได้รับ เก็บไว้ดูย้อนหลังเวลาตรวจปัญหา (ลบอัตโนมัติหลัง 7 วัน) */
export const webhookLogs = pgTable(
  "webhook_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    object: text("object"),
    /** มาทาง Facebook Login หรือ Instagram Login (null = แถวเก่าก่อนมีคอลัมน์นี้) */
    source: text("source").$type<WebhookVia>(),
    body: jsonb("body").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_logs_received_idx").on(t.receivedAt)],
);

/**
 * ผลตรวจลิงก์ปลายทางในกฎที่เปิดอยู่ (worker เปิดลิงก์ดูเองทุก 6 ชั่วโมง — lib/link-health.ts)
 * failures = ตรวจไม่ผ่านติดกันกี่รอบ (แจ้งเตือนเมื่อ >= 2 กันเว็บที่ล่มแป๊บเดียว)
 */
export const linkChecks = pgTable("link_checks", {
  url: text("url").primaryKey(),
  ok: boolean("ok").notNull(),
  status: integer("status"),
  error: text("error"),
  failures: integer("failures").notNull().default(0),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

/** ค่าตั้งค่าที่ผู้ใช้กรอกผ่านหน้าเว็บ (App ID, รหัสผ่าน ฯลฯ) — ค่าลับถูกเข้ารหัสก่อนเก็บ */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Page = typeof pages.$inferSelect;
export type Rule = typeof rules.$inferSelect;
export type RuleFolder = typeof ruleFolders.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type Job = typeof jobs.$inferSelect;
