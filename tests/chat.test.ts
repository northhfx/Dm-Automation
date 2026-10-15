import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { asc, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { chatReplies, contacts, inboxItems } from "@/db/schema";
import { ingestWebhook } from "@/lib/automation/ingest";
import { classifySendError, sendChatReply, CHAT_TEXT_MAX } from "@/lib/chat/send";
import { chatHref, lastInboundAt, loadChatThread, parseChatKey, replyWindowEndsAt, type ChatKey } from "@/lib/chat/thread";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";
import { inboxReplyLink } from "@/lib/inbox/links";
import { GraphApiError } from "@/lib/meta/graph";
import { cleanup, drainQueue } from "@/lib/queue/worker";
import { createRule, resetDatabase, seedInstagramAccount, singleStep, startMockGraph, type GraphCall } from "./helpers";
import { fbDm, igDm, postback } from "./fixtures";
import { flowPayload } from "@/lib/flows/types";

/*
 * หน้าแชท (/inbox/<platform>/<account>/<user>): ดูข้อความกับลูกค้าหนึ่งคน + พิมพ์ตอบในนามเพจ / บัญชี Instagram
 * ส่งผ่าน Send API ได้ภายใน 24 ชั่วโมงหลังลูกค้าทักล่าสุด · ไม่สร้าง contact ให้คนที่ไม่ได้พิมพ์ keyword
 */

const auth = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@/lib/auth", () => ({
  requireAuth: async () => {
    auth.calls++;
  },
}));
const refreshed = vi.hoisted(() => ({ count: 0 }));
vi.mock("next/cache", () => ({
  refresh: () => {
    refreshed.count++;
  },
  revalidatePath: () => {},
}));
const lang = vi.hoisted(() => ({ value: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "lang" && lang.value ? { name, value: lang.value } : undefined),
  }),
}));

const { sendChatReplyAction } = await import("@/app/(dashboard)/inbox/[platform]/[account]/[user]/actions");
const { ChatView } = await import("@/app/(dashboard)/inbox/[platform]/[account]/[user]/chat-view");

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
  auth.calls = 0;
  refreshed.count = 0;
  lang.value = "";
});

const HOUR = 60 * 60_000;
const FB: ChatKey = { platform: "facebook", account: "PAGE1", user: "PSID1" };

async function deliver(payload: unknown, via?: "facebook_login" | "instagram_login") {
  await ingestWebhook(db, payload, { via });
  await drainQueue(db);
}

function sends(): GraphCall[] {
  return graph.calls.filter((c) => c.method === "POST" && c.path.endsWith("/messages"));
}

async function replies() {
  return db.select().from(chatReplies).orderBy(asc(chatReplies.id));
}

describe("URL ของห้องแชท", () => {
  it("อ่านค่าจาก URL ได้เฉพาะแพลตฟอร์มที่รู้จักและ id ที่ปลอดภัย", () => {
    expect(parseChatKey("facebook", "PAGE1", "PSID1")).toEqual(FB);
    expect(parseChatKey("instagram", "17841400000000000", "IGSID_1-x")).toEqual({
      platform: "instagram",
      account: "17841400000000000",
      user: "IGSID_1-x",
    });
    expect(parseChatKey("tiktok", "A", "B")).toBeNull();
    expect(parseChatKey("facebook", "PAGE1", "a/b")).toBeNull();
    expect(parseChatKey("facebook", "PAGE1", "a%2Fb")).toBeNull();
    expect(parseChatKey("facebook", "", "x")).toBeNull();
    expect(parseChatKey("facebook", "PAGE1", undefined)).toBeNull();
  });

  it("ลิงก์ห้องแชท (+ ปุ่มย้อนกลับไปหน้ารายชื่อลูกค้า)", () => {
    expect(chatHref(FB)).toBe("/inbox/facebook/PAGE1/PSID1");
    expect(chatHref(FB, "contacts")).toBe("/inbox/facebook/PAGE1/PSID1?from=contacts");
  });

  it("ส่งได้ภายใน 24 ชั่วโมงหลังลูกค้าทักล่าสุด", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(replyWindowEndsAt(null, now)).toBeNull();
    expect(replyWindowEndsAt(new Date(now.getTime() - 23 * HOUR), now)?.toISOString()).toBe("2026-10-14T13:00:00.000Z");
    expect(replyWindowEndsAt(new Date(now.getTime() - 24 * HOUR), now)).toBeNull();
  });
});

describe("ห้องแชท + ตอบจากในเว็บ", () => {
  it("แชทที่ไม่ตรง keyword → ตอบได้ ส่งในนามเพจ ย้ายรายการไปที่เสร็จแล้ว และไม่สร้าง contact", async () => {
    await createRule({ trigger: "dm", keywords: ["ราคา"], steps: singleStep("ราคา 990") });
    await deliver(fbDm({ text: "เปิดกี่โมงคะ", mid: "m.a" }));
    await deliver(fbDm({ text: "ยังอยู่ไหม", mid: "m.b" }));
    graph.reset();

    let thread = await loadChatThread(db, FB);
    expect(thread.entries.map((e) => [e.dir, e.kind, e.text])).toEqual([
      ["in", "text", "เปิดกี่โมงคะ"],
      ["in", "text", "ยังอยู่ไหม"],
    ]);
    expect(thread.openInboxIds).toHaveLength(2);
    expect(thread.lastInboundAt).not.toBeNull();

    expect(await sendChatReply(db, FB, "  เปิด 10 โมงค่ะ\r\nยินดีให้บริการ  ")).toEqual({ ok: true });
    expect(sends()).toHaveLength(1);
    expect(sends()[0]).toMatchObject({
      path: "/PAGE1/messages",
      api: "facebook",
      body: { recipient: { id: "PSID1" }, messaging_type: "RESPONSE", message: { text: "เปิด 10 โมงค่ะ\nยินดีให้บริการ" } },
    });
    const [reply] = await replies();
    expect(reply).toMatchObject({ platform: "facebook", pageId: "PAGE1", recipientId: "PSID1", status: "sent", mid: "m_1" });

    thread = await loadChatThread(db, FB);
    expect(thread.entries.at(-1)).toMatchObject({ dir: "out", kind: "manual", text: "เปิด 10 โมงค่ะ\nยินดีให้บริการ", status: "sent" });
    expect(thread.openInboxIds).toEqual([]);
    const rows = await db.select().from(inboxItems);
    expect(rows.every((r) => r.handledAt !== null)).toBe(true);
    // ไม่ได้พิมพ์ keyword → ยังไม่อยู่ในรายชื่อลูกค้า
    expect(await db.select().from(contacts)).toEqual([]);
  });

  it("ลูกค้าที่พิมพ์ keyword: เห็นข้อความที่ลูกค้าทัก ข้อความอัตโนมัติ (+ ชื่อกฎ) และการกดปุ่ม", async () => {
    const rule = await createRule({
      name: "ถามราคา",
      trigger: "dm",
      keywords: ["ราคา"],
      steps: [
        { id: "s1", text: "ราคา 990 บาท", buttons: [{ id: "b1", type: "next", title: "สนใจ", nextStepId: "s2" }] },
        { id: "s2", text: "ทักแอดมินได้เลย", buttons: [] },
      ],
    });
    await deliver(fbDm({ text: "ราคาเท่าไหร่", mid: "m.k" }));
    await deliver(postback("facebook", flowPayload(rule.id, "s1", "b1"), { title: "สนใจ", mid: "m.p" }));

    const thread = await loadChatThread(db, FB);
    expect(thread.entries.map((e) => [e.dir, e.kind, e.text, "ruleName" in e ? e.ruleName : null])).toEqual([
      ["in", "text", "ราคาเท่าไหร่", null],
      // ข้อความที่ส่งจริง (ปุ่มแสดงเป็น [ชื่อปุ่ม] เหมือนในหน้ากิจกรรม)
      ["out", "auto", "ราคา 990 บาท\n\n[สนใจ]", "ถามราคา"],
      ["in", "button", "สนใจ", null],
      ["out", "auto", "ทักแอดมินได้เลย", "ถามราคา"],
    ]);
    expect(thread.openInboxIds).toEqual([]);
    expect(replyWindowEndsAt(thread.lastInboundAt)).not.toBeNull();
    expect(await sendChatReply(db, FB, "ขอบคุณค่ะ")).toEqual({ ok: true });
  });

  it("เกิน 24 ชั่วโมงหลังลูกค้าทักล่าสุด → ไม่ยิง Meta (บอกเหตุผล) · ยังไม่เคยทักแชทเลยก็ส่งไม่ได้", async () => {
    await db.insert(inboxItems).values({
      platform: "facebook",
      pageId: "PAGE1",
      kind: "dm",
      senderId: "PSID1",
      text: "เมื่อวานซืน",
      mid: "m.old",
      createdAt: new Date(Date.now() - 25 * HOUR),
    });
    expect(await sendChatReply(db, FB, "สวัสดีค่ะ")).toEqual({ ok: false, reason: "windowClosed" });
    expect(await sendChatReply(db, { ...FB, user: "PSID_NEVER" }, "สวัสดีค่ะ")).toEqual({ ok: false, reason: "windowClosed" });
    expect(await lastInboundAt(db, { ...FB, user: "PSID_NEVER" })).toBeNull();
    expect(sends()).toEqual([]);
    expect(await replies()).toEqual([]);
  });

  it("ข้อความว่าง / ยาวเกิน / ไม่พบบัญชีที่เชื่อมไว้ → ไม่ยิง Meta", async () => {
    await deliver(fbDm({ text: "สวัสดี" }));
    graph.reset();
    expect(await sendChatReply(db, FB, "   ")).toEqual({ ok: false, reason: "empty" });
    expect(await sendChatReply(db, FB, "ก".repeat(CHAT_TEXT_MAX + 1))).toEqual({ ok: false, reason: "tooLong" });
    expect(await sendChatReply(db, { ...FB, account: "OTHER_PAGE" }, "สวัสดี")).toEqual({ ok: false, reason: "noConnection" });
    expect(sends()).toEqual([]);
    expect(await sendChatReply(db, FB, "ก".repeat(CHAT_TEXT_MAX))).toEqual({ ok: true });
  });

  it("Meta ไม่ยอมส่ง → บอกเหตุผลที่เข้าใจได้ บันทึกข้อความที่ส่งไม่ได้ไว้ในห้องแชท และรายการยังรอตอบอยู่", async () => {
    await deliver(fbDm({ text: "สวัสดี" }));
    expect(await sendChatReply(db, FB, "FAIL_WINDOW")).toEqual({ ok: false, reason: "windowClosed" });
    expect(await sendChatReply(db, FB, "FAIL_PERMANENT")).toEqual({ ok: false, reason: "unavailable" });
    expect(await sendChatReply(db, FB, "FAIL_TOKEN")).toEqual({ ok: false, reason: "tokenInvalid" });
    expect(await sendChatReply(db, FB, "FAIL_TRANSIENT")).toEqual({
      ok: false,
      reason: "failed",
      detail: "An unexpected error has occurred.",
    });
    const rows = await replies();
    expect(rows.map((r) => r.status)).toEqual(["failed", "failed", "failed", "failed"]);
    expect(rows[1].error).toContain("isn't available");
    const thread = await loadChatThread(db, FB);
    expect(thread.entries.at(-1)).toMatchObject({ kind: "manual", status: "failed" });
    expect(thread.openInboxIds).toHaveLength(1);
  });

  it("error ที่ไม่ได้มาจาก Meta (เช่น ต่อเน็ตไม่ได้) → ไม่แสดงข้อความภายในของระบบ", () => {
    expect(classifySendError(new GraphApiError("connect failed", 0, undefined, undefined, true))).toEqual({ reason: "failed" });
    expect(classifySendError(new Error("boom"))).toEqual({ reason: "failed" });
    expect(classifySendError(new GraphApiError("(#10) outside of allowed window", 400, 10))).toEqual({ reason: "windowClosed" });
    expect(classifySendError(new GraphApiError("x", 400, 10, 2534022))).toEqual({ reason: "windowClosed" });
  });

  it("Instagram Login → ส่งผ่าน graph.instagram.com ในนามบัญชี Instagram", async () => {
    await seedInstagramAccount(db);
    await deliver(igDm({ text: "สนใจค่ะ", mid: "igmid.x" }), "instagram_login");
    const [item] = await db.select().from(inboxItems);
    const key: ChatKey = { platform: "instagram", account: item.pageId, user: "IGSID1" };
    graph.reset();
    expect(await sendChatReply(db, key, "ได้เลยค่ะ")).toEqual({ ok: true });
    expect(sends()).toHaveLength(1);
    expect(sends()[0]).toMatchObject({
      api: "instagram",
      path: `/${item.pageId}/messages`,
      body: { recipient: { id: "IGSID1" }, message: { text: "ได้เลยค่ะ" } },
    });
    expect(sends()[0].query.access_token).toBeTruthy();
  });

  it("ลบข้อความที่พิมพ์ตอบเองเมื่อครบ 30 วันเหมือนข้อความรอตอบ", async () => {
    const old = new Date(Date.now() - 31 * 24 * HOUR);
    await db.insert(chatReplies).values([
      { platform: "facebook", pageId: "PAGE1", recipientId: "PSID1", text: "เก่า", status: "sent", sentAt: old },
      { platform: "facebook", pageId: "PAGE1", recipientId: "PSID1", text: "ใหม่", status: "sent" },
    ]);
    await cleanup(db);
    expect((await replies()).map((r) => r.text)).toEqual(["ใหม่"]);
  });
});

describe("ปุ่มส่ง (Server Action)", () => {
  it("ต้องล็อกอิน · สำเร็จ = null และโหลดหน้าใหม่ · ไม่สำเร็จ = ข้อความตามภาษาที่เลือก", async () => {
    await deliver(fbDm({ text: "สวัสดี" }));
    const input = { platform: "facebook", account: "PAGE1", user: "PSID1" };
    expect(await sendChatReplyAction({ ...input, text: "สวัสดีค่ะ" })).toBeNull();
    expect(auth.calls).toBe(1);
    expect(refreshed.count).toBe(1);

    expect(await sendChatReplyAction({ ...input, text: " " })).toBe("พิมพ์ข้อความก่อนส่ง");
    expect(await sendChatReplyAction({ ...input, text: "FAIL_WINDOW" })).toContain("24 ชั่วโมง");
    lang.value = "en";
    expect(await sendChatReplyAction({ ...input, text: "" })).toBe("Type a message first");
    expect(await sendChatReplyAction({ ...input, text: "FAIL_PERMANENT" })).toBe(
      "Couldn't send: this customer may have turned off messages, blocked you, or deleted their account.",
    );
    expect(await sendChatReplyAction({ ...input, text: "FAIL_TRANSIENT" })).toBe("Couldn't send: An unexpected error has occurred.");
    expect(await sendChatReplyAction({ ...input, user: "../x", text: "hi" })).toBe("The connected account was not found. Check Settings.");
  });
});

// ---------- หน้าเว็บ ----------

const ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };

function render(el: ReactElement, locale?: Locale): string {
  const inner = locale ? createElement(I18nProvider, { locale, timeZone: "Asia/Bangkok" } as ComponentProps<typeof I18nProvider>, el) : el;
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, inner));
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

describe("หน้าแชท (ไทย / อังกฤษ)", () => {
  const now = "2026-10-14T10:00:00.000Z";
  const props: ComponentProps<typeof ChatView> = {
    platform: "facebook",
    account: "PAGE1",
    user: "PSID1",
    person: "Mali Shop Fan",
    name: "Mali Shop Fan",
    username: null,
    accountName: "northh.fx",
    entries: [
      { id: "e1", at: "2026-10-13T09:00:00.000Z", dir: "in", kind: "text", text: "ราคาเท่าไหร่" },
      { id: "e2", at: "2026-10-13T09:00:05.000Z", dir: "out", kind: "auto", text: "ราคา 990 บาท", ruleName: "Price" },
      { id: "e3", at: "2026-10-14T09:00:00.000Z", dir: "in", kind: "button", text: "Interested" },
      { id: "r1", at: "2026-10-14T09:30:00.000Z", dir: "out", kind: "manual", text: "Thanks!", status: "sent", error: null },
      { id: "r2", at: "2026-10-14T09:31:00.000Z", dir: "out", kind: "manual", text: "Hello?", status: "failed", error: "(#551) This person isn't available right now." },
    ],
    windowEndsAt: "2026-10-15T09:00:00.000Z",
    hasInbound: true,
    openInboxIds: [3],
    external: inboxReplyLink({
      platform: "facebook",
      kind: "dm",
      pageId: "PAGE1",
      senderId: "PSID1",
      senderUsername: null,
      postId: null,
      commentId: null,
      permalink: null,
    }),
    back: { href: "/inbox", label: "Inbox" },
    now,
    textMax: 1000,
    historyDays: 30,
  };

  it("ไทย: ข้อความทุกแบบ วันที่คั่น ช่องพิมพ์ + เวลาที่ยังตอบได้", () => {
    const html = render(createElement(ChatView, props), "th");
    const text = textOf(html);
    for (const s of [
      "Mali Shop Fan",
      "ตอบในนาม northh.fx",
      "เมื่อวาน",
      "วันนี้",
      "ข้อความอัตโนมัติ · Price",
      "กดปุ่ม “Interested”",
      "คุณตอบ",
      "ส่งไม่สำเร็จ",
      "(#551) This person isn't available right now.",
      "ตอบจากที่นี่ได้ถึง",
      "เสร็จแล้ว",
      "เปิดใน Messenger",
      "เปิดใน Business Suite",
    ]) {
      expect(text, s).toContain(s);
    }
    expect(html).toContain('placeholder="พิมพ์ข้อความ…"');
    expect(html).toContain('role="log"');
    // มือถือเปิดแอป Messenger · คอมพิวเตอร์เปิดห้องแชทใน Business Suite
    expect(html).toContain('href="fb-messenger://"');
    expect(html).toContain("https://business.facebook.com/latest/inbox/all?asset_id=PAGE1");
  });

  it("อังกฤษ: ไม่มีภาษาไทยหลงเหลือ (ยกเว้นข้อความของลูกค้า)", () => {
    const html = render(createElement(ChatView, props), "en");
    const text = textOf(html).replace("ราคาเท่าไหร่", "").replace("ราคา 990 บาท", "");
    expect(text).not.toMatch(/[฀-๿]/);
    for (const s of ["Replying as northh.fx", "Yesterday", "Today", "Automatic message · Price", "Tapped “Interested”", "You replied", "Not sent", "You can reply from here until", "Send"]) {
      expect(text, s).toContain(s);
    }
    expect(html).toContain('placeholder="Type a message…"');
  });

  it("เกิน 24 ชั่วโมง → ไม่มีช่องพิมพ์ บอกเหตุผล + ทางไปตอบในแอป", () => {
    const text = textOf(render(createElement(ChatView, { ...props, windowEndsAt: null, openInboxIds: [] }), "th"));
    expect(text).toContain("ส่งข้อความจากที่นี่ไม่ได้แล้ว");
    expect(text).toContain("Facebook ให้ระบบตอบได้ภายใน 24 ชั่วโมง");
    expect(text).not.toContain("ตอบจากที่นี่ได้ถึง");
    expect(text).not.toContain("เสร็จแล้ว");
    const never = textOf(render(createElement(ChatView, { ...props, windowEndsAt: null, hasInbound: false, entries: [] }), "en"));
    expect(never).toContain("This customer hasn't messaged you yet");
    expect(never).toContain("No messages in this period");
  });

  it("ไม่พบบัญชีที่เชื่อมไว้ → บอกให้ตรวจหน้าตั้งค่า", () => {
    const text = textOf(render(createElement(ChatView, { ...props, accountName: null }), "th"));
    expect(text).toContain("ไม่พบบัญชีที่เชื่อมไว้แล้ว");
  });

  it("ห้องแชทของคนที่ไม่ตรง keyword ไม่ถูกเพิ่มเป็น contact แม้หลังตอบ (ตรวจด้วย SQL ตรง)", async () => {
    await deliver(fbDm({ text: "สวัสดี", senderId: "PSID_X", mid: "m.x" }));
    await sendChatReply(db, { ...FB, user: "PSID_X" }, "สวัสดีค่ะ");
    const res = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM contacts`);
    expect(res.rows[0].n).toBe(0);
  });
});
