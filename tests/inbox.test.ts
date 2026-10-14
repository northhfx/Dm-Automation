import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { NextRequest } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contacts, events, inboxItems } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import { env } from "@/lib/env";
import { flowPayload } from "@/lib/flows/types";
import { activeToasts, dismissToast, toast } from "@/components/toast";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";
import { inboxMessages } from "@/lib/i18n/messages/inbox";
import { captureInboxItem } from "@/lib/inbox/capture";
import { countOpenInboxItems } from "@/lib/inbox/count";
import { clearInboxDetailsCache, fillInboxDetails } from "@/lib/inbox/details";
import { facebookCommentUrl, inboxPostUrl, inboxReplyLink, type InboxLinkInput } from "@/lib/inbox/links";
import { countInboxRows, INBOX_MAX_PAGE, loadInboxRows, parseInboxPage, sumCounts } from "@/lib/inbox/list";
import { INBOX_RETENTION_DAYS } from "@/lib/inbox/retention";
import { parseInboxIds } from "@/lib/inbox/status";
import { cleanup, drainQueue } from "@/lib/queue/worker";
import { createSessionValue, SESSION_COOKIE } from "@/lib/session";
import { clearNextPostCache } from "@/lib/rules/next-post";
import { createRule, resetDatabase, seedInstagramAccount, singleStep, startMockGraph, type GraphCall } from "./helpers";
import { fbComment, fbDm, fbRead, igComment, igDm, postback } from "./fixtures";

/*
 * ข้อความรอตอบ (/inbox): DM / คอมเมนต์ที่ไม่ตรงกฎไหน → เก็บแยกจาก contacts ให้เจ้าของร้านกดไปตอบเอง
 * กิจกรรม (events) ของข้อความเหล่านี้ยังไม่ระบุตัวตนเหมือนเดิม และรายการหมดอายุใน 30 วัน
 */

// Server Action เรียก requireAuth / refresh ซึ่งต้องมี request ของ Next → แทนด้วยของปลอม (นับว่าถูกเรียก)
const auth = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@/lib/auth", () => ({
  requireAuth: async () => {
    auth.calls++;
  },
}));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));

const { markInboxDone, markInboxWaiting } = await import("@/app/(dashboard)/inbox/actions");
const { InboxList } = await import("@/app/(dashboard)/inbox/inbox-list");

let graph: Awaited<ReturnType<typeof startMockGraph>>;
let db: Db;

beforeAll(async () => {
  graph = await startMockGraph();
});
afterAll(async () => {
  await graph.close();
});
beforeEach(async () => {
  db = await resetDatabase();
  graph.resetAll();
  clearNextPostCache();
  clearInboxDetailsCache();
  auth.calls = 0;
});

async function deliver(payload: unknown, via?: "facebook_login" | "instagram_login") {
  await ingestWebhook(db, payload, { via });
  await drainQueue(db);
}

async function items() {
  return db.select().from(inboxItems).orderBy(asc(inboxItems.id));
}

function sends(): GraphCall[] {
  return graph.calls.filter((c) => c.method === "POST" && c.path.endsWith("/messages"));
}

const DAY = 24 * 60 * 60_000;

describe("เก็บเข้าข้อความรอตอบ", () => {
  it("DM Facebook ที่ไม่ตรง keyword → เก็บคนทัก + ข้อความ (ไม่ถาม Meta ตอนข้อความเข้า) แต่ events ยังไม่ระบุตัวตน", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    await deliver(fbDm({ text: "สวัสดีค่ะ เปิดกี่โมง", mid: "mid.9" }));

    expect(graph.calls).toHaveLength(0);
    expect(await db.select().from(contacts)).toHaveLength(0);
    const [item] = await items();
    expect(item).toMatchObject({
      platform: "facebook",
      pageId: "PAGE1",
      kind: "dm",
      senderId: "PSID1",
      senderName: null,
      text: "สวัสดีค่ะ เปิดกี่โมง",
      mid: "mid.9",
      commentId: null,
      handledAt: null,
    });
    const [received] = await db.select().from(events).where(eq(events.type, "dm_received"));
    expect(received).toMatchObject({ actorId: null, contactId: null, text: null });
    expect(received.meta).toEqual({ via: "facebook_login", matched: false });
  });

  it("DM Instagram (Instagram Login) ไม่มีกฎ DM เลย → เก็บ โดย page_id = บัญชี IG", async () => {
    await seedInstagramAccount(db);
    await deliver(igDm({ text: "มีไซซ์ L ไหม", mid: "igmid.5", senderId: "IGSID7" }), "instagram_login");

    const [item] = await items();
    expect(item).toMatchObject({ platform: "instagram", pageId: "IG1", kind: "dm", senderId: "IGSID7", text: "มีไซซ์ L ไหม" });
  });

  it("คอมเมนต์ที่ไม่ตรง keyword → เก็บชื่อจาก webhook (Facebook = ชื่อ, Instagram = username) + โพสต์ + comment id", async () => {
    await createRule({ keywords: ["สนใจ"] });
    await seedInstagramAccount(db);
    await deliver(fbComment({ text: "สวยมากค่ะ", commentId: "POST1_C9", fromId: "USER9" }));
    await deliver(igComment({ text: "ส่งต่างประเทศไหม", commentId: "IGC9", fromId: "IGUSER9", fromUsername: "nok.ig" }), "instagram_login");

    expect(graph.calls).toHaveLength(0);
    const [fb, ig] = await items();
    expect(fb).toMatchObject({
      platform: "facebook",
      pageId: "PAGE1",
      kind: "comment",
      senderId: "USER9",
      senderName: "Somchai Jaidee",
      senderUsername: null,
      text: "สวยมากค่ะ",
      postId: "PAGE1_POST1",
      commentId: "POST1_C9",
      mid: null,
    });
    expect(ig).toMatchObject({
      platform: "instagram",
      pageId: "IG1",
      kind: "comment",
      senderId: "IGUSER9",
      senderName: null,
      senderUsername: "nok.ig",
      postId: "MEDIA1",
      commentId: "IGC9",
    });
    // กิจกรรมยังไม่มีข้อมูลคนคอมเมนต์
    const received = await db.select().from(events).where(eq(events.type, "comment_received"));
    expect(received.map((e) => [e.actorId, e.text])).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it("ข้อความยาว → เก็บไม่เกิน 1000 ตัวอักษร / ส่งแต่รูป → ข้อความว่าง", async () => {
    await deliver(fbDm({ text: "ก".repeat(1500), mid: "mid.long" }));
    await deliver(fbDm({ text: "", mid: "mid.photo", senderId: "PSID2" }));

    const [long, photo] = await items();
    expect(long.text.length).toBe(1000);
    expect(long.text.endsWith("…")).toBe(true);
    expect(photo.text).toBe("");
  });

  it("ลูกค้าที่เคยพิมพ์ keyword (มีชื่อแล้ว) ทักเรื่องอื่น → ใช้ชื่อเดิม ไม่ถาม Meta", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    await deliver(fbDm({ text: "ขอราคา", mid: "mid.1" }));
    graph.reset();
    await deliver(fbDm({ text: "ส่งของวันไหนคะ", mid: "mid.2" }));

    expect(graph.calls).toHaveLength(0);
    const rows = await items();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ senderId: "PSID1", senderName: "Mint Chan", text: "ส่งของวันไหนคะ" });
  });

  it("กดปุ่มที่ไม่ใช่ปุ่มของกฎ (เช่น Get Started) และไม่ตรง keyword → เก็บ (ชื่อปุ่มเป็นข้อความ)", async () => {
    await deliver(postback("facebook", "GET_STARTED", { title: "เริ่มต้นใช้งาน", mid: "pb.9" }));
    const [item] = await items();
    expect(item).toMatchObject({ kind: "dm", text: "เริ่มต้นใช้งาน", mid: "pb.9" });
  });

  it("ตรง keyword ของกฎโพสต์ถัดไปแต่เช็คกับ Meta ไม่สำเร็จ (ไม่มีใครตอบ) → เก็บไว้ให้ตามตอบ", async () => {
    graph.failWhen((c) => c.method === "GET");
    await createRule({ postScope: "next", nextPostSince: new Date(Date.now() - 60_000), publicReplies: [] });
    await deliver(fbComment({ postId: "PAGE1_NEW", text: "สนใจค่ะ", commentId: "NEW_C1", fromId: "USER77" }));

    expect(sends()).toHaveLength(0);
    const [item] = await items();
    expect(item).toMatchObject({ kind: "comment", senderId: "USER77", text: "สนใจค่ะ", commentId: "NEW_C1" });
  });
});

describe("ไม่เก็บเข้าข้อความรอตอบ", () => {
  it("DM / คอมเมนต์ที่ตรงกฎ (ระบบตอบแล้ว)", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    await createRule({ keywords: ["สนใจ"] });
    await deliver(fbDm({ text: "ขอราคา" }));
    await deliver(fbComment({ text: "สนใจค่ะ", commentId: "POST1_C1" }));
    await deliver(igComment({ text: "สนใจ", commentId: "IGC1" }));

    expect(sends()).toHaveLength(3);
    expect(await items()).toHaveLength(0);
  });

  it("กดปุ่มในข้อความของเรา (flow) — แม้ข้อความบนปุ่มไม่ตรง keyword", async () => {
    const rule = await createRule();
    await deliver(fbComment({ commentId: "POST1_C1" }));
    const [contact] = await db.select().from(contacts);
    await deliver(postback("facebook", flowPayload(rule.id, "s1", "b1"), { senderId: contact.platformUserId, title: "ใช่ ฉันสนใจ" }));
    // ปุ่มจากกฎที่ถูกลบไปแล้วก็ไม่เก็บ
    await deliver(postback("facebook", flowPayload(999, "s1", "b1"), { senderId: "PSID5", title: "ดูรายละเอียด", mid: "pb.old" }));

    expect(await items()).toHaveLength(0);
  });

  it("คอมเมนต์ของร้านเอง (เพจ / บัญชี Instagram ของร้าน) และ echo / อ่านแล้ว", async () => {
    await deliver(fbComment({ text: "ขอบคุณค่ะ", fromId: "PAGE1", commentId: "POST1_OWN" }));
    await deliver(igComment({ text: "ส่งให้แล้วนะคะ", fromId: "IG_OTHER_ID", fromUsername: "test.shop", commentId: "IGC_OWN" }));
    await deliver(fbDm({ echo: true, text: "ร้านตอบเอง", mid: "mid.echo" }));
    await deliver(fbRead(Date.now()));

    expect(await items()).toHaveLength(0);
  });

  it("ข้อความซ้ำ (Meta ส่งซ้ำ) → แถวเดียว และ unique index กันซ้ำอีกชั้น", async () => {
    await deliver(fbDm({ text: "สวัสดี", mid: "mid.dup" }));
    await deliver(fbDm({ text: "สวัสดี", mid: "mid.dup" }));
    await deliver(fbComment({ text: "สวย", commentId: "POST1_DUP", fromId: "USER3" }));
    await deliver(fbComment({ text: "สวย", commentId: "POST1_DUP", fromId: "USER3" }));
    expect(await items()).toHaveLength(2);

    const again = { platform: "facebook" as const, pageId: "PAGE1", senderId: "PSID1", text: "สวัสดี" };
    expect(await captureInboxItem(db, { ...again, kind: "dm", mid: "mid.dup" })).toBe(false);
    expect(await captureInboxItem(db, { ...again, kind: "comment", commentId: "POST1_DUP" })).toBe(false);
    expect(await captureInboxItem(db, { ...again, kind: "dm", mid: "mid.new" })).toBe(true);
    expect(await items()).toHaveLength(3);
  });

  it("คอมเมนต์ที่ตรงกฎแต่ข้ามเพราะเคยส่งให้คนนี้แล้ว (ส่งครั้งเดียวต่อคน)", async () => {
    await createRule();
    await deliver(fbComment({ commentId: "POST1_C1" }));
    await deliver(fbComment({ commentId: "POST1_C2" }));

    const skipped = await db.select().from(events).where(eq(events.type, "skipped"));
    expect(skipped[0].meta).toMatchObject({ reason: "once_per_user" });
    expect(await items()).toHaveLength(0);
  });

  it("บันทึกไม่สำเร็จ → ไม่ทำให้งานพัง (ข้อความยังถูกนับ)", async () => {
    await db.execute(sql`ALTER TABLE inbox_items RENAME TO inbox_items_off`);
    try {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      await deliver(fbDm({ text: "สวัสดี", mid: "mid.err" }));
      errors.mockRestore();
      const [job] = await db.execute<{ status: string }>(sql`SELECT status FROM jobs`).then((r) => r.rows);
      expect(job.status).toBe("done");
      expect(await db.select().from(events).where(eq(events.type, "dm_received"))).toHaveLength(1);
    } finally {
      await db.execute(sql`ALTER TABLE inbox_items_off RENAME TO inbox_items`);
    }
  });
});

describe("แถวในหน้า / ตัวเลขบนเมนู", () => {
  async function seed() {
    await deliver(fbDm({ text: "ข้อความแรก", mid: "m.1" }));
    await deliver(fbDm({ text: "ข้อความที่สอง", mid: "m.2" }));
    await deliver(fbDm({ text: "คนอื่น", mid: "m.3", senderId: "PSID2" }));
    await deliver(fbComment({ text: "คอมเมนต์ 1", commentId: "POST1_A", fromId: "USER1" }));
    await deliver(fbComment({ text: "คอมเมนต์ 2", commentId: "POST1_B", fromId: "USER1" }));
    await deliver(igComment({ text: "ig", commentId: "IGC_A" }));
  }

  it("แชทของคนเดียวกันรวมเป็นแถวเดียว คอมเมนต์แถวละอัน — ตัวเลขบนเมนูนับแบบเดียวกัน", async () => {
    await seed();
    expect(await countOpenInboxItems(db)).toBe(5);

    const rows = await loadInboxRows(db, { kind: null, platform: null, showDone: false, page: 1, pageSize: 30 });
    expect(rows.map((r) => r.text)).toEqual(["ig", "คอมเมนต์ 2", "คอมเมนต์ 1", "คนอื่น", "ข้อความที่สอง"]);
    const thread = rows.find((r) => r.senderId === "PSID1")!;
    expect(thread).toMatchObject({ kind: "dm", messageCount: 2 });
    expect(thread.ids).toHaveLength(2);

    const counts = await countInboxRows(db, false);
    expect(counts.open).toBe(5);
    expect(sumCounts(counts, "dm", null)).toBe(2);
    expect(sumCounts(counts, "comment", "facebook")).toBe(2);
    expect(sumCounts(counts, null, "instagram")).toBe(1);

    const chats = await loadInboxRows(db, { kind: "dm", platform: "facebook", showDone: false, page: 1, pageSize: 30 });
    expect(chats.map((r) => r.senderId)).toEqual(["PSID2", "PSID1"]);
    const second = await loadInboxRows(db, { kind: null, platform: null, showDone: false, page: 2, pageSize: 3 });
    expect(second.map((r) => r.text)).toEqual(["คนอื่น", "ข้อความที่สอง"]);
  });

  it("เสร็จแล้ว / เลิกทำ (Server Action ต้องล็อกอิน) — ข้อความใหม่ที่เข้ามาทีหลังยังรอตอบ", async () => {
    await seed();
    const rows = await loadInboxRows(db, { kind: "dm", platform: null, showDone: false, page: 1, pageSize: 30 });
    const thread = rows.find((r) => r.senderId === "PSID1")!;
    const form = (ids: number[]) => {
      const data = new FormData();
      data.set("ids", ids.join(","));
      return data;
    };

    expect(await markInboxDone(form(thread.ids))).toBe(2);
    expect(auth.calls).toBe(1);
    expect(await countOpenInboxItems(db)).toBe(4);
    const done = (await items()).filter((i) => i.handledAt);
    expect(done.map((i) => i.mid)).toEqual(["m.1", "m.2"]);
    // กดซ้ำ → ไม่ทับเวลาเดิม
    expect(await markInboxDone(form(thread.ids))).toBe(0);

    // คนเดิมทักมาใหม่ → แถวใหม่ที่รอตอบ แยกจากแถวที่เสร็จแล้ว
    await deliver(fbDm({ text: "ยังอยู่ไหมคะ", mid: "m.4" }));
    expect(await countOpenInboxItems(db)).toBe(5);
    const all = await loadInboxRows(db, { kind: "dm", platform: null, showDone: true, page: 1, pageSize: 30 });
    expect(all.map((r) => [r.text, r.handledAt === null])).toEqual([
      ["ยังอยู่ไหมคะ", true],
      ["คนอื่น", true],
      ["ข้อความที่สอง", false],
    ]);
    const doneCounts = await countInboxRows(db, true);
    expect([doneCounts.open, doneCounts.done]).toEqual([5, 1]);

    // เลิกทำ → กลับมารอตอบ (แชทของคนนี้รวมเป็นแถวเดียวอีกครั้ง)
    expect(await markInboxWaiting(form(thread.ids))).toBe(2);
    expect(auth.calls).toBe(3);
    expect(await countOpenInboxItems(db)).toBe(5);
    expect((await items()).every((i) => i.handledAt === null)).toBe(true);
    const open = await loadInboxRows(db, { kind: "dm", platform: null, showDone: false, page: 1, pageSize: 30 });
    expect(open.find((r) => r.senderId === "PSID1")?.messageCount).toBe(3);
  });

  it("?page= แปลกๆ ในลิงก์ (เช่น 1e300) → ไม่ทำให้หน้าพัง", async () => {
    expect(parseInboxPage("2")).toBe(2);
    expect(parseInboxPage("2.7")).toBe(2);
    for (const bad of [undefined, "", "abc", "0", "-3", "Infinity", ["2", "3"]]) expect(parseInboxPage(bad)).toBe(1);
    expect(parseInboxPage("1e300")).toBe(INBOX_MAX_PAGE);
    await deliver(fbDm({ text: "สวัสดี", mid: "m.1" }));
    const filters = { kind: null, platform: null, showDone: false, pageSize: 30 };
    // OFFSET เกินช่วง bigint ของ Postgres เคยทำให้ query พัง (หน้าเว็บ error 500)
    expect(await loadInboxRows(db, { ...filters, page: 1e300 })).toEqual([]);
    expect(await loadInboxRows(db, { ...filters, page: Number.NaN })).toHaveLength(1);
  });

  it("ids จากฟอร์ม: ตัดค่าที่ไม่ใช่เลขรายการทิ้ง", () => {
    expect(parseInboxIds("3, 1,abc,-2,1.5,3,,7")).toEqual([3, 1, 7]);
    expect(parseInboxIds(null)).toEqual([]);
  });
});

describe(`ลบเองเมื่อครบ ${INBOX_RETENTION_DAYS} วัน`, () => {
  it("รอบดูแลระบบลบรายการที่เก่ากว่า 30 วัน (ทั้งที่รอตอบและเสร็จแล้ว) — ก่อนลบก็ไม่นับ/ไม่แสดงแล้ว", async () => {
    const base = { platform: "facebook" as const, pageId: "PAGE1", kind: "comment" as const, text: "x" };
    await db.insert(inboxItems).values([
      { ...base, senderId: "OLD1", commentId: "c.old1", createdAt: new Date(Date.now() - 31 * DAY) },
      { ...base, senderId: "OLD2", commentId: "c.old2", createdAt: new Date(Date.now() - 40 * DAY), handledAt: new Date() },
      { ...base, senderId: "NEW1", commentId: "c.new1", createdAt: new Date(Date.now() - 29 * DAY) },
      { ...base, senderId: "NEW2", commentId: "c.new2", createdAt: new Date(), handledAt: new Date() },
    ]);

    expect(await countOpenInboxItems(db)).toBe(1);
    const rows = await loadInboxRows(db, { kind: null, platform: null, showDone: true, page: 1, pageSize: 30 });
    expect(rows.map((r) => r.senderId)).toEqual(["NEW2", "NEW1"]);

    await cleanup(db);
    expect((await items()).map((i) => i.senderId)).toEqual(["NEW1", "NEW2"]);
  });
});

describe("เติมชื่อ / ลิงก์ที่ขาด (ถาม Meta ตอนเปิดหน้า)", () => {
  it("แชท Facebook: ชื่อจากโปรไฟล์ — เติมให้ทุกข้อความของคนนั้น และถามครั้งเดียว", async () => {
    await deliver(fbDm({ text: "a", mid: "m.1" }));
    await deliver(fbDm({ text: "b", mid: "m.2" }));
    const [first] = await items();

    expect(await fillInboxDetails(db, [first.id])).toBe(2);
    expect((await items()).map((i) => i.senderName)).toEqual(["Mint Chan", "Mint Chan"]);
    expect(graph.calls.map((c) => c.path)).toEqual(["/PSID1"]);

    graph.reset();
    expect(await fillInboxDetails(db, [first.id])).toBe(0);
    expect(graph.calls).toHaveLength(0);
  });

  it("แชท Facebook: ดึงโปรไฟล์ไม่ได้ → ชื่อจากห้องแชทของเพจ, หาไม่เจอก็ไม่ error และไม่ถามซ้ำ", async () => {
    graph.failWhen((c) => c.method === "GET" && (c.path === "/PSID1" || c.path === "/PSID2"));
    graph.setConversations([{ userId: "PSID1", name: "Nok Jaidee" }]);
    await deliver(fbDm({ text: "a", mid: "m.1" }));
    await deliver(fbDm({ text: "b", mid: "m.2", senderId: "PSID2" }));
    const ids = (await items()).map((i) => i.id);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await fillInboxDetails(db, ids)).toBe(1);
    warn.mockRestore();
    const rows = await items();
    expect(rows.map((i) => [i.senderId, i.senderName])).toEqual([
      ["PSID1", "Nok Jaidee"],
      ["PSID2", null],
    ]);
    expect(rows.every((i) => i.detailsCheckedAt !== null)).toBe(true);
    graph.reset();
    expect(await fillInboxDetails(db, ids)).toBe(0);
    expect(graph.calls).toHaveLength(0);
    // หน้าเว็บไม่ขอให้ถามซ้ำแล้ว
    const list = await loadInboxRows(db, { kind: null, platform: null, showDone: false, page: 1, pageSize: 30 });
    expect(list.map((r) => r.detailsId)).toEqual([null, null]);
  });

  it("แชทหลายข้อความที่ยังไม่รู้ชื่อ: หน้าเว็บขอถามครั้งเดียวต่อคน — ถามแล้วไม่ได้ ข้อความเก่าไม่ถูกส่งมาถามซ้ำ", async () => {
    graph.failWhen((c) => c.method === "GET");
    await deliver(fbDm({ text: "a", mid: "m.1" }));
    await deliver(fbDm({ text: "b", mid: "m.2" }));
    const load = () => loadInboxRows(db, { kind: null, platform: null, showDone: false, page: 1, pageSize: 30 });
    const [row] = await load();
    expect(row.detailsId).toBe(row.ids[1]);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await fillInboxDetails(db, [row.detailsId!])).toBe(0);
    expect((await load())[0].detailsId).toBeNull();

    // ข้อความใหม่ของคนเดิม → ลองถามอีกครั้ง
    graph.failWhen(null);
    await deliver(fbDm({ text: "c", mid: "m.3" }));
    const [again] = await load();
    expect(again.detailsId).toBe(again.ids[2]);
    expect(await fillInboxDetails(db, [again.detailsId!])).toBe(3);
    warn.mockRestore();
    expect((await load())[0]).toMatchObject({ senderName: "Mint Chan", detailsId: null });
  });

  it("แชท Instagram: ได้ username → ปุ่มตอบเปิดห้องแชทด้วย ig.me / คอมเมนต์ Instagram: ได้ลิงก์โพสต์", async () => {
    await seedInstagramAccount(db);
    graph.setPosts([{ id: "MEDIA1", platform: "instagram", createdAt: new Date().toISOString() }]);
    await deliver(igDm({ text: "hi", mid: "igmid.1" }), "instagram_login");
    await deliver(igComment({ text: "a", commentId: "IGC1" }), "instagram_login");
    await deliver(igComment({ text: "b", commentId: "IGC2", fromId: "IGUSER2", fromUsername: "b.ig" }), "instagram_login");
    const before = await items();
    expect(inboxReplyLink(before[0]).href).toBe("https://www.instagram.com/direct/inbox/");

    expect(await fillInboxDetails(db, before.map((i) => i.id))).toBe(3);
    const [dm, c1, c2] = await items();
    expect(dm).toMatchObject({ senderName: "Mint Chan", senderUsername: "mint.ig" });
    expect(inboxReplyLink(dm)).toMatchObject({ href: "https://ig.me/m/mint.ig", desktopHref: "https://www.instagram.com/mint.ig/" });
    expect([c1.permalink, c2.permalink]).toEqual(["https://ig/MEDIA1", "https://ig/MEDIA1"]);
    // โพสต์เดียวกันถาม Meta ครั้งเดียว ผ่าน Instagram Login
    const lookups = graph.calls.filter((c) => c.path === "/MEDIA1");
    expect(lookups).toHaveLength(1);
    expect(lookups[0].api).toBe("instagram");
    expect(inboxReplyLink(c1).href).toBe("https://ig/MEDIA1");
  });

  it("POST /api/inbox/details: ต้องล็อกอิน", async () => {
    const { POST } = await import("@/app/api/inbox/details/route");
    await deliver(fbDm({ text: "a", mid: "m.1" }));
    const [item] = await items();
    const request = (cookie?: string) =>
      new NextRequest("https://dm.example.com/api/inbox/details", {
        method: "POST",
        body: JSON.stringify({ ids: [item.id] }),
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      });

    const denied = await POST(request(`${SESSION_COOKIE}=forged`));
    expect(denied.status).toBe(401);
    expect(graph.calls).toHaveLength(0);
    expect((await items())[0].detailsCheckedAt).toBeNull();

    const ok = await POST(request(`${SESSION_COOKIE}=${createSessionValue(env.authSecret)}`));
    expect(await ok.json()).toEqual({ updated: 1 });
    expect((await items())[0].senderName).toBe("Mint Chan");
  });

  it("ไม่ถามรายการที่มีข้อมูลครบแล้ว / หมดอายุ / ไม่มีอยู่", async () => {
    await deliver(fbComment({ text: "x", commentId: "POST1_C1" })); // คอมเมนต์ Facebook มีชื่อ + ลิงก์ครบจาก webhook
    const [c] = await items();
    expect(await fillInboxDetails(db, [c.id, 999, -1])).toBe(0);
    expect(graph.calls).toHaveLength(0);
  });
});

describe("ลิงก์ปุ่ม “ตอบ”", () => {
  const base: InboxLinkInput = {
    platform: "facebook",
    kind: "dm",
    pageId: "111",
    senderId: "PSID9",
    senderUsername: null,
    postId: null,
    commentId: null,
    permalink: null,
  };

  it("แชท Facebook → ห้องแชทใน Meta Business Suite", () => {
    const link = inboxReplyLink(base);
    const url = new URL(link.href);
    expect(url.origin + url.pathname).toBe("https://business.facebook.com/latest/inbox/all");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      asset_id: "111",
      mailbox_id: "111",
      selected_item_id: "PSID9",
      thread_type: "FB_MESSAGE",
    });
    expect(link.desktopHref).toBeUndefined();
  });

  it("คอมเมนต์ Facebook → โพสต์ + comment_id (ส่วนท้ายของ id ใน webhook)", () => {
    const item = { ...base, kind: "comment" as const, postId: "111_222", commentId: "222_333" };
    expect(inboxReplyLink(item)).toMatchObject({ href: "https://www.facebook.com/111/posts/222?comment_id=333", where: "Facebook" });
    expect(inboxPostUrl(item)).toBe("https://www.facebook.com/111/posts/222");
    expect(facebookCommentUrl("weird", "444")).toBe("https://www.facebook.com/weird?comment_id=444");
    expect(inboxPostUrl(base)).toBeNull();
  });

  it("คอมเมนต์ Instagram ที่ยังไม่รู้ลิงก์โพสต์ → Meta Business Suite (เลือกเพจให้ถ้าเป็นเพจที่เชื่อมไว้)", () => {
    const item = { ...base, platform: "instagram" as const, kind: "comment" as const, postId: "M1", commentId: "C1" };
    expect(inboxReplyLink(item, new Set(["111"])).href).toBe("https://business.facebook.com/latest/inbox/all?asset_id=111");
    expect(inboxReplyLink({ ...item, pageId: "IG1" }, new Set(["111"])).href).toBe("https://business.facebook.com/latest/inbox/all");
    expect(inboxPostUrl(item)).toBeNull();
  });
});

// ---------- หน้าเว็บ: สองภาษา ----------

const ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };

function render(el: ReactElement, locale?: Locale, timeZone?: string): string {
  const inner = locale ? createElement(I18nProvider, { locale, timeZone } as ComponentProps<typeof I18nProvider>, el) : el;
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, inner));
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("toast “เลิกทำ”", () => {
  it("กดเสร็จแล้วสองแถวติดกัน → มีปุ่มเลิกทำของแต่ละแถว (ไม่รวมเป็นอันเดียวเพราะข้อความเหมือนกัน)", () => {
    for (const t of activeToasts()) dismissToast(t.id);
    const undone: string[] = [];
    toast("ย้ายไปที่เสร็จแล้ว", { tone: "good", action: { label: "เลิกทำ", onClick: () => undone.push("A") } });
    toast("ย้ายไปที่เสร็จแล้ว", { tone: "good", action: { label: "เลิกทำ", onClick: () => undone.push("B") } });
    const shown = activeToasts();
    expect(shown).toHaveLength(2);
    for (const t of shown) t.action?.onClick();
    expect(undone).toEqual(["A", "B"]);
    // toast ธรรมดาที่ข้อความซ้ำยังรวมเป็นอันเดียวเหมือนเดิม
    for (const t of activeToasts()) dismissToast(t.id);
    toast("คัดลอกแล้ว");
    toast("คัดลอกแล้ว");
    expect(activeToasts()).toHaveLength(1);
    for (const t of activeToasts()) dismissToast(t.id);
  });
});

describe("ข้อความอธิบายหน้า", () => {
  it("ไม่บอกว่าเป็นเพราะคำไม่ตรงอย่างเดียว (คอมเมนต์อาจไม่ตรงเพราะโพสต์/แพลตฟอร์มที่เลือกไว้ หรือกฎปิดอยู่)", () => {
    for (const text of [inboxMessages.th.description, inboxMessages.th.emptyBody]) {
      expect(text).toContain("ไม่ตรงกับกฎไหนเลย");
      expect(text).not.toMatch(/ไม่ตรงคำ|keyword|คีย์เวิร์ด/);
    }
    for (const text of [inboxMessages.en.description, inboxMessages.en.emptyBody]) {
      expect(text).toContain("without matching any of your automations");
    }
  });
});

describe("รายการในหน้า (ไทย / อังกฤษ)", () => {
  const now = "2026-10-14T10:00:00.000Z";
  const props = {
    now,
    showDone: true,
    detailsIds: [],
    rows: [
      {
        key: "dm:facebook:P1:PSID1:true",
        ids: [1, 2],
        kind: "dm" as const,
        platform: "facebook" as const,
        senderName: null,
        senderUsername: null,
        text: "เปิดกี่โมงคะ",
        createdAt: "2026-10-14T09:55:00.000Z",
        handledAt: null,
        messageCount: 2,
        reply: inboxReplyLink({
          platform: "facebook",
          kind: "dm",
          pageId: "P1",
          senderId: "PSID1",
          senderUsername: null,
          postId: null,
          commentId: null,
          permalink: null,
        }),
        postUrl: null,
      },
      {
        key: "c:3",
        ids: [3],
        kind: "comment" as const,
        platform: "instagram" as const,
        senderName: null,
        senderUsername: "nok.ig",
        text: "",
        createdAt: "2026-10-14T08:00:00.000Z",
        handledAt: "2026-10-14T09:00:00.000Z",
        messageCount: 1,
        reply: { href: "https://ig/M1", where: "Instagram" as const, hint: "replyHintInstagramComment" as const },
        postUrl: "https://ig/M1",
      },
    ],
  };

  it("ค่าเริ่มต้นเป็นภาษาไทย", () => {
    const text = textOf(render(createElement(InboxList, props)));
    for (const s of ["ผู้ใช้ Facebook", "แชท", "2 ข้อความ · แสดงข้อความล่าสุด", "ตอบ", "เสร็จแล้ว", "@nok.ig", "บนโพสต์", "ส่งรูป สติกเกอร์ หรือไฟล์แนบ", "ยังไม่เสร็จ"]) {
      expect(text).toContain(s);
    }
    expect(text).toContain("5 นาทีที่ผ่านมา");
  });

  it("อังกฤษ", () => {
    const html = render(createElement(InboxList, props), "en");
    const text = textOf(html);
    for (const s of ["Facebook user", "Chat", "Comment", "2 messages · showing the latest", "Reply", "Done", "on post", "Mark as waiting", "5 minutes ago", "Done · 1 hour ago"]) {
      expect(text).toContain(s);
    }
    for (const thai of ["ผู้ใช้", "ตอบ", "เสร็จ", "แชท", "บนโพสต์"]) expect(text).not.toContain(thai);
    expect(html).toContain('aria-label="Reply to Facebook user in Meta Business Suite (opens in a new tab)"');
    expect(html).toContain('target="_blank"');
  });

  it("เวลาของรายการใช้เขตเวลาของระบบที่เซิร์ฟเวอร์ส่งมา (ตรงกันทั้งตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์และในเบราว์เซอร์)", () => {
    // เกิน 7 วัน → แสดงเป็นวันที่+เวลา (ขึ้นกับเขตเวลา)
    const old = { ...props.rows[0], createdAt: "2026-10-01T07:05:00.000Z" };
    const html = (timeZone?: string) => textOf(render(createElement(InboxList, { ...props, rows: [old] }), "en", timeZone));
    expect(html("UTC")).toContain("Oct 1, 7:05 AM");
    expect(html()).toContain("Oct 1, 2:05 PM");
  });

  it("ไม่แสดงที่เสร็จแล้ว → ซ่อนแถวที่เสร็จแล้ว", () => {
    const text = textOf(render(createElement(InboxList, { ...props, showDone: false }), "en"));
    expect(text).toContain("Facebook user");
    expect(text).not.toContain("@nok.ig");
  });
});
