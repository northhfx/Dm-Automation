import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { getPool, type Db } from "@/db/client";
import * as schema from "@/db/schema";
import { contacts, events, links, messages } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import { loadEvents } from "@/app/(dashboard)/activity/load-events";
import { loadPreviews, previewQuery } from "@/app/(dashboard)/contacts/load-previews";
import { flowPayload } from "@/lib/flows/types";
import { drainQueue } from "@/lib/queue/worker";
import { clearNextPostCache } from "@/lib/rules/next-post";
import { createRule, resetDatabase, seedInstagramAccount, singleStep, startMockGraph, type GraphCall } from "./helpers";
import { fbComment, fbDm, igComment, igDm, postback } from "./fixtures";

/*
 * เก็บข้อมูลลูกค้าเฉพาะคนที่พิมพ์ตรง keyword (คอมเมนต์ / DM) หรือกดปุ่มในข้อความของเรา
 * คนอื่นที่คอมเมนต์/ทักมา: ไม่เป็น contact และกิจกรรม "ข้อความเข้า" ไม่มีว่าใครส่ง ส่งว่าอะไร
 */

let graph: Awaited<ReturnType<typeof startMockGraph>>;
let db: Db;

beforeAll(async () => {
  graph = await startMockGraph();
});
afterAll(async () => {
  await graph.close();
});
beforeEach(async () => {
  process.env.INSTAGRAM_DM_PER_HOUR = "180";
  db = await resetDatabase();
  graph.resetAll();
  clearNextPostCache();
});

async function deliver(payload: unknown, via?: "facebook_login" | "instagram_login") {
  await ingestWebhook(db, payload, { via });
  await drainQueue(db);
}

async function eventsOf(type: string) {
  return db.select().from(events).where(eq(events.type, type)).orderBy(events.id);
}

function sends(): GraphCall[] {
  return graph.calls.filter((c) => c.method === "POST" && c.path.endsWith("/messages"));
}

function conversationLookups(): GraphCall[] {
  return graph.calls.filter((c) => c.path.endsWith("/conversations"));
}

/** กิจกรรมข้อความเข้าที่ไม่มีข้อมูลของคนส่ง */
function expectAnonymous(row: typeof events.$inferSelect, via = "facebook_login") {
  expect(row).toMatchObject({ contactId: null, actorId: null, text: null, ruleId: null });
  expect(row.meta).toEqual({ via, matched: false });
}

describe("DM ที่ไม่ตรง keyword → ไม่เก็บข้อมูลคนทัก", () => {
  it("Facebook: ไม่สร้าง contact ไม่ดึงโปรไฟล์ และ dm_received ไม่มีว่าใครทัก/ทักว่าอะไร", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    await deliver(fbDm({ text: "สวัสดีค่ะ เปิดกี่โมง" }));

    expect(graph.calls).toHaveLength(0);
    expect(await db.select().from(contacts)).toHaveLength(0);
    const [received] = await eventsOf("dm_received");
    expect(received).toMatchObject({ platform: "facebook", pageId: "PAGE1" });
    expectAnonymous(received);
    expect(JSON.stringify(received)).not.toContain("PSID1");
    expect(JSON.stringify(received)).not.toContain("เปิดกี่โมง");
  });

  it("ไม่มีกฎ DM เลย → ไม่สร้าง contact เหมือนกัน (Instagram Login)", async () => {
    await seedInstagramAccount(db);
    await deliver(igDm({ text: "ราคา" }), "instagram_login");

    expect(graph.calls).toHaveLength(0);
    expect(await db.select().from(contacts)).toHaveLength(0);
    const [received] = await eventsOf("dm_received");
    expect(received).toMatchObject({ platform: "instagram", pageId: "IG1" });
    expectAnonymous(received, "instagram_login");
  });

  it("quick reply ที่ไม่ใช่ปุ่มของเราและไม่ตรง keyword → ไม่เก็บ payload", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    const payload = igDm({ text: "เลือกสี" });
    (payload.entry[0].messaging[0].message as Record<string, unknown>).quick_reply = { payload: "COLOR_RED" };
    await deliver(payload);

    expect(await db.select().from(contacts)).toHaveLength(0);
    const [received] = await eventsOf("dm_received");
    expectAnonymous(received);
  });

  it("ลูกค้าที่เคยพิมพ์ keyword ทักมาเรื่องอื่น → อัปเดตเวลาทักล่าสุดอย่างเดียว ข้อความไม่ถูกเก็บ", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    await deliver(fbDm({ text: "ขอราคา", mid: "mid.1" }));
    const [before] = await db.select().from(contacts);
    expect(before).toMatchObject({ platformUserId: "PSID1", name: "Mint Chan" });
    // ย้อนเวลาทักล่าสุดไปก่อน จะได้เห็นว่าถูกอัปเดต
    const past = new Date(Date.now() - 60 * 60_000);
    await db.update(contacts).set({ lastInboundAt: past }).where(eq(contacts.id, before.id));
    graph.reset();

    await deliver(fbDm({ text: "ส่งของวันไหนคะ", mid: "mid.2" }));

    expect(graph.calls).toHaveLength(0); // ไม่ตอบ ไม่ดึงโปรไฟล์ซ้ำ
    const rows = await db.select().from(contacts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: before.id, name: "Mint Chan" });
    expect(rows[0].lastInboundAt!.getTime()).toBeGreaterThan(past.getTime());
    const [keyword, other] = await eventsOf("dm_received");
    expect(keyword).toMatchObject({ contactId: before.id, actorId: "PSID1", text: "ขอราคา" });
    expectAnonymous(other);
  });
});

describe("DM ที่ตรง keyword → เก็บ contact และข้อมูลครบ", () => {
  it("สร้าง contact พร้อมชื่อ และ dm_received / rule_triggered ผูกกับ contact", async () => {
    const rule = await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("สวัสดี {name}") });
    await deliver(fbDm({ text: "ขอราคาหน่อย" }));

    const [contact] = await db.select().from(contacts);
    expect(contact).toMatchObject({ platform: "facebook", platformUserId: "PSID1", pageId: "PAGE1", name: "Mint Chan" });
    expect(contact.lastInboundAt).not.toBeNull();
    const [received] = await eventsOf("dm_received");
    expect(received).toMatchObject({ contactId: contact.id, actorId: "PSID1", text: "ขอราคาหน่อย" });
    expect(received.meta).toMatchObject({ mid: "mid.1", via: "facebook_login" });
    const [triggered] = await eventsOf("rule_triggered");
    expect(triggered).toMatchObject({ ruleId: rule.id, contactId: contact.id, actorId: "PSID1" });
    expect(sends()[0].body).toMatchObject({ recipient: { id: "PSID1" }, message: { text: "สวัสดี Mint" } });
  });
});

describe("คอมเมนต์", () => {
  it("ไม่ตรง keyword → comment_received ไม่มีว่าใครคอมเมนต์ ข้อความ ชื่อ หรือ comment id (แต่ยังรู้ว่าโพสต์ไหน)", async () => {
    await createRule({ keywords: ["สนใจ"] });
    await deliver(fbComment({ text: "สวยมากค่ะ", commentId: "C9", fromId: "USER9" }));

    expect(graph.calls).toHaveLength(0);
    expect(await db.select().from(contacts)).toHaveLength(0);
    const [received] = await eventsOf("comment_received");
    expect(received).toMatchObject({ platform: "facebook", pageId: "PAGE1", postId: "PAGE1_POST1" });
    expectAnonymous(received);
    expect(JSON.stringify(received)).not.toMatch(/USER9|C9|Somchai|สวยมาก/);
  });

  it("ตรง keyword แต่ไม่ใช่โพสต์ที่เลือก / ไม่มีกฎคอมเมนต์ → ไม่เก็บข้อมูลเหมือนกัน", async () => {
    await createRule({ postScope: "specific", postIds: ["OTHERPOST"] });
    await deliver(fbComment({ text: "สนใจ", commentId: "C1" }));
    await deliver(igComment({ text: "สนใจ", commentId: "IGC2" }));

    const rows = await eventsOf("comment_received");
    expect(rows).toHaveLength(2);
    expectAnonymous(rows[0]);
    expectAnonymous(rows[1]);
    expect(rows[1]).toMatchObject({ platform: "instagram", postId: "MEDIA1" });
    expect(await db.select().from(contacts)).toHaveLength(0);
  });

  it("ตรง keyword → comment_received ข้อมูลครบ ตอบคอมเมนต์ + Private Reply และสร้าง contact หลังส่ง DM", async () => {
    const rule = await createRule();
    await deliver(fbComment({ text: "สนใจค่ะ", commentId: "C1", fromId: "USER1" }));

    const [received] = await eventsOf("comment_received");
    expect(received).toMatchObject({ actorId: "USER1", text: "สนใจค่ะ", postId: "PAGE1_POST1" });
    expect(received.meta).toEqual({ commentId: "C1", fromName: "Somchai Jaidee", via: "facebook_login" });
    expect(graph.calls.filter((c) => c.path === "/C1/comments")).toHaveLength(1);
    expect(sends().map((c) => c.body!.recipient)).toEqual([{ comment_id: "C1" }]);
    const [contact] = await db.select().from(contacts);
    expect(contact).toMatchObject({ platformUserId: "PSID_FROM_C1", name: "Somchai" });
    const [triggered] = await eventsOf("rule_triggered");
    // ส่ง Private Reply สำเร็จ → "ตรงกับกฎ" ของคอมเมนต์นี้ผูกกับ contact (หน้ารายชื่อแสดงคอมเมนต์ล่าสุดได้)
    expect(triggered).toMatchObject({ ruleId: rule.id, actorId: "USER1", contactId: contact.id });
    expect(received.contactId).toBeNull();
  });

  it("Private Reply ส่งไม่สำเร็จ → ไม่มี contact และ rule_triggered ไม่ผูกกับใคร", async () => {
    await createRule({ publicReplies: [], steps: singleStep("FAIL_PERMANENT") });
    await deliver(fbComment({ text: "สนใจ", commentId: "C1", fromId: "USER1" }));

    expect(await db.select().from(contacts)).toHaveLength(0);
    const [triggered] = await eventsOf("rule_triggered");
    expect(triggered).toMatchObject({ actorId: "USER1", contactId: null });
    expect(await eventsOf("dm_failed")).toHaveLength(1);
  });

  it("คอมเมนต์ซ้ำ (Meta ส่งมาสองรอบ) ยังบันทึกครั้งเดียว และ oncePerUser ยังทำงาน", async () => {
    await createRule();
    await deliver(fbComment({ commentId: "C1" }));
    await deliver(fbComment({ commentId: "C1" }));
    await deliver(fbComment({ commentId: "C2" }));

    expect(sends()).toHaveLength(1);
    const received = await eventsOf("comment_received");
    expect(received).toHaveLength(2);
    // คอมเมนต์ที่สองตรง keyword (ข้ามเพราะเคยส่งให้คนนี้แล้ว) → ยังนับเป็นคนที่พิมพ์ keyword
    expect(received.map((r) => r.actorId)).toEqual(["USER1", "USER1"]);
    const [skipped] = await eventsOf("skipped");
    expect(skipped.meta).toMatchObject({ reason: "once_per_user", commentId: "C2" });
  });

  it("กฎโพสต์ถัดไป: คอมเมนต์ใต้โพสต์เก่าไม่เก็บข้อมูล, คอมเมนต์ใต้โพสต์ที่ผูกได้เก็บครบ (ลำดับกิจกรรมเหมือนเดิม)", async () => {
    const since = new Date(Date.now() - 10 * 60_000);
    graph.setPosts([
      { id: "PAGE1_OLD", platform: "facebook", createdAt: new Date(since.getTime() - 60_000).toISOString() },
      { id: "PAGE1_NEW", platform: "facebook", createdAt: new Date(since.getTime() + 60_000).toISOString() },
    ]);
    await createRule({ postScope: "next", nextPostSince: since, publicReplies: [] });
    await deliver(fbComment({ postId: "PAGE1_OLD", commentId: "C0", fromId: "USER0" }));
    await deliver(fbComment({ postId: "PAGE1_NEW", commentId: "C1", fromId: "USER1" }));

    const types = (await db.select({ type: events.type }).from(events).orderBy(events.id)).map((r) => r.type);
    expect(types).toEqual(["comment_received", "comment_received", "post_bound", "rule_triggered", "dm_sent"]);
    const [old, matched] = await eventsOf("comment_received");
    expectAnonymous(old);
    expect(old.postId).toBe("PAGE1_OLD");
    expect(matched).toMatchObject({ actorId: "USER1", postId: "PAGE1_NEW" });
  });

  it("กฎโพสต์ถัดไป: ตรง keyword แต่ถาม Meta ไม่สำเร็จ → คอมเมนต์กับ 'ข้าม' เก็บข้อมูลคนเดียวกัน ไม่ขัดกันในหน้ากิจกรรม", async () => {
    graph.failWhen((c) => c.method === "GET");
    const rule = await createRule({ postScope: "next", nextPostSince: new Date(Date.now() - 60_000), publicReplies: [] });
    await deliver(fbComment({ postId: "PAGE1_NEW", text: "สนใจค่ะ", commentId: "C1", fromId: "USER77" }));

    expect(sends()).toHaveLength(0);
    expect(await db.select().from(contacts)).toHaveLength(0);
    const [received] = await eventsOf("comment_received");
    expect(received).toMatchObject({ actorId: "USER77", text: "สนใจค่ะ", postId: "PAGE1_NEW", contactId: null });
    expect(received.meta).toEqual({ commentId: "C1", fromName: "Somchai Jaidee", via: "facebook_login" });
    const [skipped] = await eventsOf("skipped");
    expect(skipped).toMatchObject({ ruleId: rule.id, actorId: "USER77", text: "สนใจค่ะ" });
    expect(skipped.meta).toMatchObject({ reason: "next_post_lookup_failed", commentId: "C1" });

    // หน้ากิจกรรม: ไม่มีแถวไหนบอกว่า "ไม่ตรงกฎ" ทั้งที่อีกแถวมีข้อความของคนเดียวกัน — ทั้งสองแถวบอกว่าเป็นใคร
    const { items } = await loadEvents(db, { limit: 10 });
    expect(items.map((i) => [i.type, i.unmatched, i.person, i.text])).toEqual([
      ["skipped", false, "Somchai Jaidee", "สนใจค่ะ"],
      ["comment_received", false, "Somchai Jaidee", "สนใจค่ะ"],
    ]);
  });

  it("กฎโพสต์ถัดไปถาม Meta ไม่สำเร็จ แต่ไม่ตรง keyword → ไม่ถาม Meta และยังไม่เก็บข้อมูล", async () => {
    graph.failWhen((c) => c.method === "GET");
    await createRule({ postScope: "next", nextPostSince: new Date(Date.now() - 60_000) });
    await deliver(fbComment({ postId: "PAGE1_NEW", text: "สวยจัง", commentId: "C1", fromId: "USER77" }));

    expect(graph.calls).toHaveLength(0);
    expect(await eventsOf("skipped")).toHaveLength(0);
    expectAnonymous((await eventsOf("comment_received"))[0]);
  });
});

describe("กดปุ่มในข้อความของเรา", () => {
  it("contact เดิม (จากคอมเมนต์) กดปุ่ม → ใช้ contact เดิม ส่งข้อความถัดไป", async () => {
    const rule = await createRule();
    await deliver(fbComment({ commentId: "C1" }));
    const [contact] = await db.select().from(contacts);
    graph.reset();

    await deliver(postback("facebook", flowPayload(rule.id, "s1", "b1"), { senderId: contact.platformUserId }));

    expect(sends()).toHaveLength(1);
    expect(sends()[0].body).toMatchObject({ recipient: { id: contact.platformUserId } });
    expect(conversationLookups()).toHaveLength(0);
    const rows = await db.select().from(contacts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: contact.id, name: "Somchai" });
    expect(rows[0].lastInboundAt).not.toBeNull();
    const [tap] = await eventsOf("button_clicked");
    expect(tap).toMatchObject({ ruleId: rule.id, contactId: contact.id });
    expect(await eventsOf("dm_received")).toHaveLength(0);
  });
});

describe("ชื่อลูกค้า Facebook: ดึงโปรไฟล์ไม่ได้ → หาจากห้องแชท Messenger ของเพจ", () => {
  beforeEach(async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("สวัสดี {name}") });
  });

  it("ดึงโปรไฟล์ไม่สำเร็จ → ได้ชื่อจากผู้ร่วมสนทนาที่ id ตรงกับ PSID", async () => {
    graph.failWhen((c) => c.method === "GET" && c.path === "/PSID1");
    graph.setConversations([{ userId: "PSID1", name: "Nok Jaidee" }, { userId: "PSID2", name: "คนอื่น" }]);
    await deliver(fbDm({ text: "ราคา" }));

    const [lookup] = conversationLookups();
    expect(lookup).toMatchObject({ method: "GET", path: "/PAGE1/conversations", api: "facebook" });
    expect(lookup.query).toMatchObject({ platform: "messenger", user_id: "PSID1", fields: "participants" });
    expect(lookup.authorization).toBe("Bearer PAGE_TOKEN");
    const [contact] = await db.select().from(contacts);
    expect(contact.name).toBe("Nok Jaidee");
    expect(sends()[0].body).toMatchObject({ message: { text: "สวัสดี Nok" } });
  });

  it("ดึงโปรไฟล์ได้แต่ไม่มีชื่อ → ใช้ชื่อจากห้องแชท", async () => {
    graph.setProfiles({ PSID1: { id: "PSID1" } });
    graph.setConversations([{ userId: "PSID1", name: "Nok Jaidee" }]);
    await deliver(fbDm({ text: "ราคา" }));

    expect(conversationLookups()).toHaveLength(1);
    expect((await db.select().from(contacts))[0].name).toBe("Nok Jaidee");
  });

  it("ดึงโปรไฟล์ได้ชื่อ → ไม่ต้องถามห้องแชท", async () => {
    graph.setConversations([{ userId: "PSID1", name: "Nok Jaidee" }]);
    await deliver(fbDm({ text: "ราคา" }));

    expect(conversationLookups()).toHaveLength(0);
    expect((await db.select().from(contacts))[0].name).toBe("Mint Chan");
  });

  it("contact ที่รู้ชื่ออยู่แล้ว → ไม่ดึงโปรไฟล์และไม่ถามห้องแชท", async () => {
    await deliver(fbDm({ text: "ราคา", mid: "mid.1" }));
    graph.reset();
    await deliver(fbDm({ text: "ราคา", mid: "mid.2" }));

    expect(graph.calls.filter((c) => c.method === "GET")).toHaveLength(0);
    expect(sends()).toHaveLength(1);
  });

  it("ห้องแชทก็หาไม่เจอ / Meta ตอบ error → ไม่มีชื่อ แต่ยังส่งข้อความตามปกติ", async () => {
    graph.failWhen((c) => c.method === "GET" && c.path === "/PSID1");
    await deliver(fbDm({ text: "ราคา", mid: "mid.1" }));
    expect(conversationLookups()).toHaveLength(1);
    expect(sends()[0].body).toMatchObject({ message: { text: "สวัสดี คุณลูกค้า" } });

    graph.reset();
    graph.failWhen((c) => c.method === "GET" && (c.path === "/PSID2" || c.path.endsWith("/conversations")));
    await deliver(fbDm({ text: "ราคา", mid: "mid.2", senderId: "PSID2" }));
    expect(conversationLookups()).toHaveLength(1);
    expect(sends()).toHaveLength(1);

    const rows = await db.select().from(contacts).orderBy(asc(contacts.id));
    expect(rows.map((r) => [r.platformUserId, r.name])).toEqual([
      ["PSID1", null],
      ["PSID2", null],
    ]);
    expect((await eventsOf("dm_sent")).length).toBe(2);
  });

  it("Instagram ดึงโปรไฟล์ไม่ได้ → ไม่ถามห้องแชท Messenger", async () => {
    graph.failWhen((c) => c.method === "GET" && c.path === "/IGSID1");
    graph.setConversations([{ userId: "IGSID1", name: "ไม่ควรถูกใช้" }]);
    await deliver(igDm({ text: "ราคา" }));

    expect(conversationLookups()).toHaveLength(0);
    expect(sends()).toHaveLength(1);
    const [contact] = await db.select().from(contacts);
    expect(contact).toMatchObject({ platform: "instagram", name: null, username: null });

    // Instagram Login ก็เช่นกัน
    graph.reset();
    await seedInstagramAccount(db);
    graph.failWhen((c) => c.method === "GET" && c.path === "/IGSID2");
    await deliver(igDm({ text: "ราคา", mid: "igmid.2", senderId: "IGSID2" }), "instagram_login");
    expect(conversationLookups()).toHaveLength(0);
    expect(sends().map((c) => c.api)).toEqual(["instagram"]);
  });
});

describe("หน้ารายชื่อลูกค้า: ข้อความล่าสุดแทนชื่อ (ลูกค้าที่ Meta ไม่ให้ชื่อ)", () => {
  it("DM ที่ตรง keyword → ข้อความแชท, คอมเมนต์ที่ได้ Private Reply → คอมเมนต์ (ข้อความที่ไม่ตรงกฎไม่มีให้แสดง)", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    await createRule({ publicReplies: [] });
    await deliver(fbDm({ text: "ขอราคา\n  หน่อยค่ะ", mid: "mid.1" }));
    await deliver(fbDm({ text: "ส่งของวันไหน", mid: "mid.2" })); // ไม่ตรง keyword → ไม่ถูกเก็บ จึงไม่ใช่ข้อความล่าสุด
    await deliver(fbDm({ text: "   ", mid: "mid.3", senderId: "PSID9" })); // ไม่ตรงกฎ ไม่มี contact
    await deliver(fbComment({ text: "สนใจค่ะ", commentId: "C1", fromId: "USER1" }));

    const rows = await db.select().from(contacts).orderBy(asc(contacts.id));
    expect(rows.map((r) => r.platformUserId)).toEqual(["PSID1", "PSID_FROM_C1"]);
    const previews = await loadPreviews(db, [rows[0].id, rows[1].id, 999]);
    expect(Object.fromEntries(previews)).toEqual({
      [rows[0].id]: { text: "ขอราคา หน่อยค่ะ", via: "dm" },
      [rows[1].id]: { text: "สนใจค่ะ", via: "comment" },
    });
    expect(await loadPreviews(db, [])).toEqual(new Map());
  });

  it("ใช้ index ของ contact_id — ไม่ไล่ทั้งตาราง events ที่โตตามจำนวนข้อความเข้า", async () => {
    // ข้อความเข้าที่ไม่ตรงกฎ (ส่วนใหญ่ของตาราง) ไม่มี contact_id
    await db.execute(sql`
      INSERT INTO events (type, platform, page_id, meta)
      SELECT 'dm_received', 'facebook', 'PAGE1', '{"via":"facebook_login","matched":false}'::jsonb FROM generate_series(1, 20000)
    `);
    const [c] = await db.insert(contacts).values({ platform: "facebook", platformUserId: "PSID1", pageId: "PAGE1" }).returning();
    await db.insert(events).values({ type: "dm_received", platform: "facebook", pageId: "PAGE1", contactId: c.id, text: "ขอราคา" });
    await db.execute(sql`ANALYZE events`);

    const query = previewQuery(db, [c.id, c.id + 1, c.id + 2]).toSQL();
    const plan = (await getPool().query<{ "QUERY PLAN": string }>(`EXPLAIN ${query.sql}`, query.params)).rows
      .map((r) => r["QUERY PLAN"])
      .join("\n");
    expect(plan).toContain("events_contact_created_idx");
    expect(plan).not.toMatch(/Seq Scan on events/);
    expect((await loadPreviews(db, [c.id])).get(c.id)).toEqual({ text: "ขอราคา", via: "dm" });
  });
});

// ---------------------------------------------------------------------------
// migration 0007_keyword_only_contacts: ล้างข้อมูลเก่าในฐานข้อมูลที่ใช้งานอยู่
// ---------------------------------------------------------------------------

const MIGRATION_TAG = "0007_keyword_only_contacts";
const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

describe(`migration ${MIGRATION_TAG}`, () => {
  const scratchSchema = `kc_migration_${process.pid}`;
  let pool: Pool;
  let scratch: Db;
  let beforeDir: string;

  beforeAll(async () => {
    const admin = new Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query(`DROP SCHEMA IF EXISTS "${scratchSchema}" CASCADE; CREATE SCHEMA "${scratchSchema}"`);
    await admin.end();
    // ฐานข้อมูลแยก (schema ของตัวเอง) — ตารางทุกตัวของ migration ถูกสร้างใน schema นี้ผ่าน search_path
    pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${scratchSchema}`, max: 2 });
    scratch = drizzle(pool, { schema });

    // migration ก่อนหน้า 0007 เท่านั้น (เหมือนฐานข้อมูลจริงก่อนอัปเดต)
    beforeDir = mkdtempSync(path.join(tmpdir(), "dm-migrations-"));
    cpSync(MIGRATIONS_DIR, beforeDir, { recursive: true });
    const journalPath = path.join(beforeDir, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { idx: number; tag: string }[] };
    const cut = journal.entries.findIndex((e) => e.tag === MIGRATION_TAG);
    expect(cut).toBeGreaterThan(0);
    journal.entries = journal.entries.slice(0, cut);
    writeFileSync(journalPath, JSON.stringify(journal));
    await migrate(scratch, { migrationsFolder: beforeDir, migrationsSchema: scratchSchema });
  });

  afterAll(async () => {
    await pool?.query(`DROP SCHEMA IF EXISTS "${scratchSchema}" CASCADE`);
    await pool?.end();
    if (beforeDir) rmSync(beforeDir, { recursive: true, force: true });
  });

  async function snapshot() {
    return {
      contacts: await scratch.select().from(contacts).orderBy(contacts.id),
      events: await scratch.select().from(events).orderBy(events.id),
      messages: await scratch.select().from(messages).orderBy(messages.id),
      links: await scratch.select().from(links).orderBy(links.id),
    };
  }

  it("ลบ contact ที่ไม่ได้มาจาก keyword และล้างข้อมูลคนส่งในข้อความเข้าที่ไม่ตรงกฎ — รันซ้ำได้ผลเท่าเดิม", async () => {
    // ---- contact ----
    const [chatter, kwDm, kwComment, tapper, linkOnly, igChatter, sentOnly] = await scratch
      .insert(contacts)
      .values([
        { platform: "facebook", platformUserId: "PSID_CHAT", pageId: "PAGE1" }, // ทักมาเฉยๆ (ไม่มีชื่อ)
        { platform: "facebook", platformUserId: "PSID_KW", pageId: "PAGE1", name: "Mint Chan" }, // พิมพ์ keyword ทาง DM
        { platform: "facebook", platformUserId: "PSID_FROM_C1", pageId: "PAGE1", name: "Somchai" }, // คอมเมนต์ keyword
        { platform: "instagram", platformUserId: "IGSID_TAP", pageId: "IG1", username: "tap.ig" }, // มีแค่การกดปุ่ม
        { platform: "instagram", platformUserId: "IGSID_LINK", pageId: "IG1" }, // มีแค่ลิงก์ติดตาม
        { platform: "instagram", platformUserId: "IGSID_CHAT", pageId: "IG1", username: "chatter.ig" }, // ทักมาเฉยๆ
        { platform: "facebook", platformUserId: "PSID_SENT", pageId: "PAGE1" }, // ได้ DM จากกฎ (มีแค่ messages)
      ])
      .returning();

    await scratch.insert(messages).values([
      { platform: "facebook", pageId: "PAGE1", contactId: kwDm.id, ruleId: 1, source: "dm", stepId: "s1", mid: "out.1", status: "sent" },
      { platform: "facebook", pageId: "PAGE1", contactId: kwComment.id, ruleId: 2, source: "comment", stepId: "s1", mid: "out.2", status: "sent" },
      { platform: "facebook", pageId: "PAGE1", contactId: sentOnly.id, ruleId: 1, source: "dm", stepId: "s1", mid: "out.3", status: "sent" },
      { platform: "facebook", pageId: "PAGE1", ruleId: 1, source: "dm", stepId: "s1", status: "failed", error: "x" },
    ]);
    await scratch.insert(links).values([
      { code: "code0001", targetUrl: "https://shop.example.com", ruleId: 2, contactId: kwComment.id, platform: "facebook" },
      { code: "code0002", targetUrl: "https://shop.example.com", ruleId: 3, contactId: linkOnly.id, platform: "instagram", clicks: 1 },
    ]);

    const fb = { platform: "facebook" as const, pageId: "PAGE1" };
    const ig = { platform: "instagram" as const, pageId: "IG1" };
    const via = "facebook_login";
    const seeded = await scratch
      .insert(events)
      .values([
        // 0: ทักมาเฉยๆ (สร้าง contact เพราะระบบเก่าเก็บทุกคน)
        { ...fb, type: "dm_received", contactId: chatter.id, actorId: "PSID_CHAT", text: "เปิดกี่โมง", meta: { mid: "m.chat", payload: null, via } },
        // 1-3: พิมพ์ keyword ทาง DM → ได้ DM
        { ...fb, type: "dm_received", contactId: kwDm.id, actorId: "PSID_KW", text: "ขอราคา", meta: { mid: "m.kw", payload: null, via } },
        { ...fb, type: "rule_triggered", ruleId: 1, contactId: kwDm.id, actorId: "PSID_KW", text: "ขอราคา", meta: { mid: "m.kw", trigger: "dm", via } },
        { ...fb, type: "dm_sent", ruleId: 1, contactId: kwDm.id, actorId: "PSID_KW", text: "ราคา 990", meta: { mid: "out.1", source: "dm", stepId: "s1" } },
        // 4: คนเดิมทักมาเรื่องอื่นทีหลัง (ไม่ตรง keyword)
        { ...fb, type: "dm_received", contactId: kwDm.id, actorId: "PSID_KW", text: "ส่งของวันไหน", meta: { mid: "m.kw2", payload: null, via } },
        // 5-8: คอมเมนต์ keyword → ตอบคอมเมนต์ + Private Reply
        { ...fb, type: "comment_received", actorId: "USER1", postId: "POST1", text: "สนใจ", meta: { commentId: "C1", fromName: "Somchai Jaidee", via } },
        { ...fb, type: "rule_triggered", ruleId: 2, actorId: "USER1", postId: "POST1", text: "สนใจ", meta: { commentId: "C1", trigger: "comment", via } },
        { ...fb, type: "public_reply_sent", ruleId: 2, actorId: "USER1", postId: "POST1", text: "ส่งให้แล้วค่ะ", meta: { commentId: "C1", replyId: "r1" } },
        { ...fb, type: "dm_sent", ruleId: 2, contactId: kwComment.id, actorId: "USER1", postId: "POST1", text: "สวัสดี", meta: { mid: "out.2", source: "comment", stepId: "s1" } },
        // 9: คอมเมนต์ไม่ตรง keyword
        { ...fb, type: "comment_received", actorId: "USER2", postId: "POST1", text: "สวยมาก", meta: { commentId: "C2", fromName: "Nok", via } },
        // 10: คอมเมนต์เก่าก่อนมี via
        { ...fb, type: "comment_received", actorId: "USER3", postId: "POST1", text: "ราคาเท่าไหร่", meta: { commentId: "C3", fromName: "Old" } },
        // 11-12: ตรง keyword แต่ข้ามเพราะเคยส่งให้คนนี้แล้ว → ยังเป็นคน keyword
        { ...fb, type: "comment_received", actorId: "USER1", postId: "POST1", text: "สนใจอีกรอบ", meta: { commentId: "C4", fromName: "Somchai Jaidee", via } },
        { ...fb, type: "skipped", ruleId: 2, actorId: "USER1", postId: "POST1", text: "สนใจอีกรอบ", meta: { reason: "once_per_user", commentId: "C4" } },
        // 13-14: ตรง keyword ของกฎโพสต์ถัดไป แต่ถาม Meta ไม่สำเร็จ → ยังเป็นคนที่พิมพ์ keyword (เก็บไว้ทั้งคู่ ไม่ขัดกัน)
        { ...fb, type: "comment_received", actorId: "USER5", postId: "POST9", text: "สนใจ", meta: { commentId: "C5", fromName: "Five", via } },
        { ...fb, type: "skipped", ruleId: 4, actorId: "USER5", postId: "POST9", text: "สนใจ", meta: { reason: "next_post_lookup_failed", commentId: "C5" } },
        // 15: Instagram ทักมาเฉยๆ
        { ...ig, type: "dm_received", contactId: igChatter.id, actorId: "IGSID_CHAT", text: "hi", meta: { mid: "m.ig", payload: "QR", via: "instagram_login" } },
        // 16: กิจกรรมอื่นที่ยังชี้ไปที่ contact ที่จะถูกลบ (กันไว้เผื่อ)
        { ...ig, type: "skipped", ruleId: 3, contactId: igChatter.id, actorId: "IGSID_CHAT", text: "hi", meta: { reason: "rule_inactive", mid: "m.ig9" } },
        // 17-18: กดปุ่ม / คลิกลิงก์
        { ...ig, type: "button_clicked", ruleId: 3, contactId: tapper.id, actorId: "IGSID_TAP", text: "ใช่", meta: { mid: "pb.1", stepId: "s1", buttonId: "b1" } },
        { ...ig, type: "link_clicked", ruleId: 3, contactId: linkOnly.id, meta: { code: "code0002", firstClick: true } },
        // 19: ข้อความเข้าที่ไม่ระบุตัวตนอยู่แล้ว (ระบบใหม่) → ไม่แตะ
        { ...fb, type: "dm_received", meta: { via, matched: false } },
        // 20: DM เก่ามากที่ไม่มี meta
        { ...fb, type: "dm_received", actorId: "PSID_OLD", text: "เก่า", meta: null },
        // 21-22: กิจกรรมระดับระบบ
        { ...fb, type: "post_bound", ruleId: 4, postId: "POST2", text: "โพสต์ใหม่", meta: { via: "publish" } },
        { ...fb, type: "dm_failed", ruleId: 1, actorId: "PSID_X", meta: { api: "facebook", error: { message: "token" } } },
        // 23-25: คอมเมนต์ที่ทำให้กฎผูกโพสต์อื่น (ไม่ได้ตรงกฎเอง) / ถูกข้ามด้วยเหตุผลอื่น → ไม่นับเป็นคน keyword
        { ...fb, type: "comment_received", actorId: "USER6", postId: "POST3", text: "สนใจ", meta: { commentId: "C6", fromName: "Six", via } },
        { ...fb, type: "post_bound", ruleId: 4, postId: "POST2", text: "โพสต์ใหม่", meta: { via: "comment", commentId: "C6" } },
        { ...fb, type: "skipped", ruleId: 3, postId: "POST3", meta: { reason: "rule_inactive", commentId: "C6" } },
      ])
      .returning();

    // ---- รัน migration ทั้งหมด (เหมือนเปิดเซิร์ฟเวอร์เวอร์ชันใหม่) ----
    await migrate(scratch, { migrationsFolder: MIGRATIONS_DIR, migrationsSchema: scratchSchema });
    const after = await snapshot();

    // contact: เหลือเฉพาะคนที่มี DM จากกฎ / กดปุ่ม / ลิงก์ / ทำให้กฎทำงาน
    expect(after.contacts.map((c) => c.platformUserId)).toEqual(["PSID_KW", "PSID_FROM_C1", "IGSID_TAP", "IGSID_LINK", "PSID_SENT"]);
    expect(after.contacts.find((c) => c.id === kwDm.id)).toMatchObject({ name: "Mint Chan" });
    // messages / links ไม่ถูกแตะ และไม่มีแถวไหนชี้ไปที่ contact ที่ถูกลบ
    expect(after.messages).toHaveLength(4);
    expect(after.links.map((l) => l.contactId)).toEqual([kwComment.id, linkOnly.id]);
    // ไม่มีกิจกรรมถูกลบ (สถิติ "ข้อความเข้า" นับเท่าเดิม)
    expect(after.events).toHaveLength(seeded.length);
    const removedIds = new Set([chatter.id, igChatter.id]);
    expect(after.events.filter((e) => e.contactId !== null && removedIds.has(e.contactId))).toHaveLength(0);

    const ev = (i: number) => after.events.find((e) => e.id === seeded[i].id)!;
    const anon = (i: number, meta: Record<string, unknown>) => {
      expect(ev(i)).toMatchObject({ type: seeded[i].type, platform: seeded[i].platform, pageId: seeded[i].pageId, postId: seeded[i].postId });
      expect(ev(i)).toMatchObject({ contactId: null, actorId: null, text: null });
      expect(ev(i).meta).toEqual(meta);
    };
    // ข้อความเข้าที่ไม่ตรงกฎ → เหลือแค่ via
    anon(0, { via, matched: false });
    anon(4, { via, matched: false });
    anon(9, { via, matched: false });
    anon(10, { matched: false });
    anon(15, { via: "instagram_login", matched: false });
    anon(20, { matched: false });
    anon(23, { via, matched: false });
    expect(ev(9).postId).toBe("POST1");
    // กิจกรรมอื่นของ contact ที่ถูกลบ → ตัดข้อมูลคนออก เก็บเหตุผลไว้
    anon(16, { reason: "rule_inactive" });
    // ของคนที่พิมพ์ keyword และกิจกรรมอื่น → เหมือนเดิมทุกอย่าง
    for (const i of [1, 2, 3, 5, 6, 7, 8, 11, 12, 13, 14, 17, 18, 19, 21, 22, 24, 25]) {
      expect(ev(i)).toEqual(seeded[i]);
    }

    // ---- รันซ้ำ (เช่น มีคนรันไฟล์ SQL เองอีกรอบ) → ผลเท่าเดิม ----
    const file = readFileSync(path.join(MIGRATIONS_DIR, `${MIGRATION_TAG}.sql`), "utf8");
    for (const statement of file.split("--> statement-breakpoint")) {
      await scratch.execute(sql.raw(statement));
    }
    expect(await snapshot()).toEqual(after);
  });
});
