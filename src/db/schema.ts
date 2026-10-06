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

/** กฎอัตโนมัติ: เมื่อเจอ keyword → ตอบคอมเมนต์ / ส่ง DM */
export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  trigger: text("trigger").$type<TriggerType>().notNull(),
  platforms: text("platforms").array().$type<Platform[]>().notNull(),
  matchType: text("match_type").$type<MatchType>().notNull().default("contains"),
  keywords: text("keywords").array().notNull().default([]),
  postIds: text("post_ids").array().notNull().default([]), // ว่าง = ทุกโพสต์
  publicReplies: text("public_replies").array().notNull().default([]),
  dmText: text("dm_text").notNull(),
  linkUrl: text("link_url"),
  oncePerUser: boolean("once_per_user").notNull().default(true),
  priority: integer("priority").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** คนที่เคยคุยกับเพจ (PSID สำหรับ Facebook, IGSID สำหรับ Instagram) */
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
    source: text("source").$type<TriggerType>().notNull(),
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
    contactId: integer("contact_id"),
    platform: text("platform").$type<Platform>(),
    clicks: integer("clicks").notNull().default(0),
    firstClickedAt: timestamp("first_clicked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("links_code_idx").on(t.code),
    index("links_rule_idx").on(t.ruleId, t.createdAt),
  ],
);

/**
 * บันทึกเหตุการณ์ทั้งหมด ใช้ทำสถิติและหน้า Activity
 * type: comment_received | dm_received | rule_triggered | public_reply_sent |
 *       public_reply_failed | dm_sent | dm_failed | link_clicked | skipped
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
  ],
);

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
    body: jsonb("body").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_logs_received_idx").on(t.receivedAt)],
);

/** ค่าตั้งค่าที่ผู้ใช้กรอกผ่านหน้าเว็บ (App ID, รหัสผ่าน ฯลฯ) — ค่าลับถูกเข้ารหัสก่อนเก็บ */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Page = typeof pages.$inferSelect;
export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type Job = typeof jobs.$inferSelect;
