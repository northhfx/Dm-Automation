import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { Db } from "@/db/client";
import { contacts, events, jobs, links, messages, webhookLogs } from "@/db/schema";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";
import { activityMessages } from "@/lib/i18n/messages/activity";
import { systemMessage } from "@/lib/i18n/system";
import { INSTAGRAM_MESSAGE_ACCESS_MENU } from "@/lib/meta/setup-info";
import { createRule, resetDatabase, singleStep } from "./helpers";

/*
 * หน้าภาพรวม / รายชื่อลูกค้า / กิจกรรม เป็นภาษาอังกฤษเมื่อเลือก English (คุกกี้ lang=en)
 * - เรนเดอร์ทั้งหน้าจริงจากฐานข้อมูลเทส แล้วตรวจว่าไม่มีตัวอักษรไทยหลงอยู่เลย (รวม title / aria-label / placeholder)
 * - ไม่มีคุกกี้ = ภาษาไทยเหมือนเดิม
 * ข้อมูลที่ลูกค้าพิมพ์ / ชื่อกฎ / ชื่อลูกค้า ในเทสนี้เป็นภาษาอังกฤษ เพื่อให้ตรวจได้ว่าข้อความของระบบไม่มีภาษาไทยเหลือ
 */

// คุกกี้ภาษาของคำขอ (getLocale() อ่านผ่าน cookies() ของ Next)
const lang = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "lang" && lang.value ? { name, value: lang.value } : undefined),
  }),
}));

const { default: OverviewPage } = await import("@/app/(dashboard)/page");
const { default: ActivityPage } = await import("@/app/(dashboard)/activity/page");
const { default: ContactsPage } = await import("@/app/(dashboard)/contacts/page");
const { default: ActivityLoading } = await import("@/app/(dashboard)/activity/loading");
const { default: ContactsLoading } = await import("@/app/(dashboard)/contacts/loading");
const { failureSummary } = await import("@/app/(dashboard)/activity/failure-summary");
const { errorHint, TimelineItem, TimelineItemCompact, unmatchedNote } = await import("@/app/(dashboard)/activity/timeline");
type TimelineEvent = import("@/app/(dashboard)/activity/load-events").TimelineEvent;

const ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function render(el: ReactElement, locale?: Locale, pathname = "/"): string {
  const inner = createElement(PathnameContext.Provider, { value: pathname }, el);
  return renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      // root layout ห่อทั้งแอปด้วย I18nProvider ตามคุกกี้ — ไม่ส่ง locale = ไม่มี Provider (ไทย)
      locale ? createElement(I18nProvider, { locale } as ComponentProps<typeof I18nProvider>, inner) : inner,
    ),
  );
}

type PageFn = (props: never) => Promise<ReactElement>;

/** เรนเดอร์ทั้งหน้าเหมือนคำขอจริงที่มีคุกกี้ lang (ไม่ส่ง = ไม่มีคุกกี้) */
async function renderPage(page: PageFn, path: string, searchParams: Record<string, string> = {}, locale?: Locale) {
  lang.value = locale;
  const el = await page({ params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) } as never);
  return render(el, locale, path);
}

/** ข้อความล้วน (ตัดแท็ก HTML) */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}

/** คำภาษาไทยที่ยังเหลือใน HTML (รวม attribute เช่น title / aria-label / placeholder) */
function thaiIn(html: string): string[] {
  return html.match(/[฀-๿][฀-๿\s]*/g) ?? [];
}

// ---------------- ข้อมูลตัวอย่าง (ครบทุกส่วนของทั้งสามหน้า) ----------------

async function seed(db: Db) {
  const now = Date.now();
  const ago = (ms: number) => new Date(now - ms);
  const link = { id: "b1", title: "See details", type: "link" as const, url: "https://shop.example.com/p" };
  const rules = [];
  // 7 กฎ → การ์ดกฎซ่อนบางส่วนไว้หลังปุ่ม "แสดงอีก"
  for (let i = 1; i <= 7; i++) {
    rules.push(
      await createRule({
        name: `Promo ${i}`,
        trigger: i === 2 ? "dm" : "comment",
        platforms: i === 4 ? ["instagram"] : ["facebook", "instagram"],
        active: i !== 3,
        keywords: ["price"],
        publicReplies: ["Sent you a DM"],
        steps: singleStep("Here are the details", i === 1 ? [link] : []),
      }),
    );
  }
  const rule = rules[0];

  const [mali, ploy, anon, igAnon] = await db
    .insert(contacts)
    .values([
      { platform: "facebook", platformUserId: "PSID1", pageId: "PAGE1", name: "Mali Shop Fan", username: "mali.fan", lastInboundAt: ago(5 * MIN) },
      { platform: "instagram", platformUserId: "IGSID1", pageId: "IG1", name: null, username: "ploy.ig", firstSeenAt: ago(3 * DAY) },
      { platform: "facebook", platformUserId: "PSID2", pageId: "PAGE1", name: null, username: null, lastInboundAt: ago(2 * HOUR) },
      { platform: "instagram", platformUserId: "IGSID2", pageId: "IG1", name: null, username: null },
    ])
    .returning();

  await db.insert(messages).values([
    { platform: "facebook", pageId: "PAGE1", contactId: mali.id, ruleId: rule.id, source: "comment", status: "sent", readAt: ago(MIN) },
    { platform: "instagram", pageId: "IG1", contactId: ploy.id, ruleId: rule.id, source: "dm", status: "sent" },
    { platform: "facebook", pageId: "PAGE1", contactId: anon.id, ruleId: rule.id, source: "comment", status: "failed", error: "x" },
  ]);
  await db.insert(links).values([
    { code: "abc", targetUrl: "https://shop.example.com/p", ruleId: rule.id, contactId: mali.id, platform: "facebook", clicks: 2 },
    { code: "def", targetUrl: "https://shop.example.com/p", ruleId: rule.id, contactId: ploy.id, platform: "instagram" },
  ]);

  const fb = { platform: "facebook" as const, pageId: "PAGE1" };
  const ig = { platform: "instagram" as const, pageId: "IG1" };
  const error = (code: number, subcode?: number, message = "(#100) Something went wrong") => ({ error: { message, code, subcode } });
  await db.insert(events).values([
    // เก่าสุด → ใหม่สุด (หน้ากิจกรรมเรียงจาก id มาก → น้อย)
    { ...fb, type: "mystery_event", createdAt: ago(10 * DAY) },
    { ...fb, type: "comment_received", actorId: "X1", meta: { matched: false }, createdAt: ago(40 * DAY) },
    { ...fb, type: "comment_received", actorId: "PSID1", text: "price please", meta: { matched: true, fromName: "Mali Shop Fan" }, createdAt: ago(2 * DAY) },
    { ...fb, type: "comment_received", meta: { matched: false }, createdAt: ago(DAY + HOUR) },
    { ...ig, type: "dm_received", meta: { matched: false }, createdAt: ago(5 * HOUR) },
    { ...fb, type: "rule_triggered", ruleId: rule.id, contactId: mali.id, text: "price please", createdAt: ago(5 * HOUR) },
    { ...fb, type: "public_reply_sent", ruleId: rule.id, contactId: mali.id, text: "Sent you a DM", createdAt: ago(5 * HOUR) },
    { ...fb, type: "public_reply_failed", ruleId: rule.id, contactId: mali.id, meta: error(551), createdAt: ago(4 * HOUR) },
    { ...fb, type: "dm_sent", ruleId: rule.id, contactId: mali.id, text: "Here are the details\n\n[See details] [Call us]", createdAt: ago(4 * HOUR) },
    { ...fb, type: "dm_failed", ruleId: rule.id, contactId: anon.id, meta: error(10, 2018278), createdAt: ago(3 * HOUR) },
    { ...ig, type: "dm_failed", ruleId: rule.id, contactId: ploy.id, meta: error(100, 2534041), createdAt: ago(3 * HOUR) },
    { ...ig, type: "dm_failed", ruleId: rule.id, contactId: igAnon.id, meta: { error: { code: 190 } }, createdAt: ago(3 * HOUR) },
    { ...fb, type: "dm_failed", ruleId: rule.id, contactId: anon.id, meta: error(4), createdAt: ago(3 * HOUR) },
    { ...fb, type: "dm_failed", ruleId: rule.id, contactId: anon.id, meta: error(200), createdAt: ago(3 * HOUR) },
    { ...fb, type: "button_clicked", ruleId: rule.id, contactId: mali.id, text: "See details", createdAt: ago(2 * HOUR) },
    { ...fb, type: "link_clicked", ruleId: rule.id, contactId: mali.id, createdAt: ago(2 * HOUR) },
    { ...fb, type: "skipped", ruleId: rule.id, contactId: mali.id, meta: { reason: "once_per_user" }, createdAt: ago(HOUR) },
    { ...fb, type: "skipped", ruleId: rules[2].id, contactId: mali.id, meta: { reason: "rule_inactive" }, createdAt: ago(HOUR) },
    { ...fb, type: "skipped", ruleId: rule.id, actorId: "X2", meta: { reason: "next_post_lookup_failed" }, createdAt: ago(HOUR) },
    { ...fb, type: "post_bound", ruleId: rules[4].id, createdAt: ago(50 * MIN) },
    { ...ig, type: "token_refresh_failed", meta: { username: "mali.shop", error: { message: "Error validating access token", code: 190 } }, createdAt: ago(30 * MIN) },
    { ...ig, type: "dm_rate_limited", meta: { accountName: "@mali.shop" }, createdAt: ago(20 * MIN) },
    { ...ig, type: "dm_received", contactId: ploy.id, text: "how much?", meta: { matched: true }, createdAt: ago(10 * MIN) },
    { ...ig, type: "rule_triggered", ruleId: rule.id, contactId: ploy.id, text: "how much?", meta: { trigger: "dm" }, createdAt: ago(10 * MIN) },
    { ...fb, type: "rule_triggered", ruleId: rule.id, contactId: anon.id, text: "price?", meta: { trigger: "comment" }, createdAt: ago(5 * MIN) },
  ]);

  await db.insert(jobs).values([
    { type: "send_dm", payload: {}, status: "failed", attempts: 5, lastError: "Graph API error" },
    { type: "comment", payload: {}, status: "failed", attempts: 5 },
    { type: "something_new", payload: {}, status: "failed", attempts: 1 },
  ]);
  await db.insert(webhookLogs).values([
    {
      object: "page",
      source: "facebook_login",
      body: {
        entry: [
          {
            changes: [{ field: "feed" }, { field: "mention" }, {}],
            messaging: [{ message: { text: "hi" } }, { message: { is_echo: true } }, { postback: {} }, { postback: {} }, { read: {} }, {}],
          },
        ],
      },
    },
    { object: "instagram", source: "facebook_login", body: { entry: [] } },
    { object: "instagram", source: "instagram_login", body: { entry: [{ messaging: [{ message: { text: "hi" } }] }] } },
    { object: null, source: null, body: {} },
  ]);
}

// ---------------- เทสที่ไม่ใช้ฐานข้อมูล ----------------

const NOW = new Date("2026-10-13T10:00:00Z");

function event(o: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: 1,
    type: "dm_sent",
    platform: "facebook",
    createdAt: new Date(NOW.getTime() - 5 * MIN),
    ruleId: 7,
    ruleName: "Promo",
    person: "Somchai",
    text: null,
    buttons: [],
    error: null,
    skipReason: null,
    unmatched: false,
    ...o,
  };
}

describe("รายการกิจกรรม (timeline) ภาษาอังกฤษ", () => {
  const full = (e: TimelineEvent, locale?: Locale) => render(createElement(TimelineItem, { event: e, now: NOW, locale }));
  const compact = (e: TimelineEvent, locale?: Locale) => render(createElement(TimelineItemCompact, { event: e, now: NOW, locale }));

  it("ชื่อกิจกรรม / ชื่อคน / ชื่อกฎ / เวลา", () => {
    const html = full(event({ text: "Here you go", buttons: ["See details"] }), "en");
    const text = textOf(html);
    expect(text).toContain("DM sent");
    expect(text).toContain("to Somchai");
    expect(text).toContain("Automation: Promo");
    expect(text).toContain("5 minutes ago");
    expect(html).toContain('aria-label="Buttons in the message"');
    expect(text).toContain("Button: See details");
    expect(thaiIn(html)).toEqual([]);
    // ไม่ส่ง locale = ไทยเหมือนเดิม
    const th = textOf(full(event({ text: "Here you go", buttons: ["See details"] })));
    expect(th).toContain("ส่ง DM แล้ว");
    expect(th).toContain("ถึง Somchai");
    expect(th).toContain("กฎ: Promo");
    expect(th).toContain("5 นาทีที่ผ่านมา");
    expect(th).toContain("ปุ่ม: See details");
  });

  it("คำนำหน้าชื่อตามประเภท: from / to / by / for (บัญชีร้าน)", () => {
    expect(textOf(compact(event({ type: "comment_received" }), "en"))).toContain("New comment from Somchai");
    expect(textOf(compact(event({ type: "button_clicked", text: "Yes" }), "en"))).toContain("Button tapped by Somchai");
    expect(textOf(compact(event({ type: "token_refresh_failed", person: "@mali.shop" }), "en"))).toContain(
      "Couldn't renew Instagram token for @mali.shop",
    );
    // ประเภทที่ไม่รู้จัก → แสดงชื่อประเภทตามที่บันทึกไว้
    expect(textOf(compact(event({ type: "mystery_event" }), "en"))).toContain("mystery_event from Somchai");
  });

  it("ข้อความเข้าที่ไม่ตรงกฎ: ไม่บอกว่าเป็นเพราะคำอย่างเดียว และชี้ไป Inbox", () => {
    const comment = event({ type: "comment_received", unmatched: true, person: null, ruleId: null, ruleName: null });
    for (const html of [full(comment, "en"), compact(comment, "en")]) {
      expect(textOf(html)).toContain("New comment (no match)");
      expect(textOf(html)).toContain("Name and message not saved because it matched no automation (keywords, posts, or platforms you set)");
      expect(thaiIn(html)).toEqual([]);
    }
    expect(textOf(full(comment, "en"))).toContain("See in Inbox");
    expect(unmatchedNote("dm_received", "en")).toBe("Name and message not saved because it matched no automation (keywords or platforms you set)");
    expect(unmatchedNote("dm_received")).toBe("ไม่ได้เก็บชื่อและข้อความ เพราะไม่ตรงกับกฎไหนเลย (คำหรือแพลตฟอร์มที่ตั้งไว้)");
  });

  it("ข้อผิดพลาด: สาเหตุ / คำอธิบาย / รหัส / ลิงก์ไปตั้งค่า", () => {
    const html = full(event({ type: "token_refresh_failed", error: { message: "Token expired", code: "190" } }), "en");
    const text = textOf(html);
    expect(text).toContain("Reason: Token expired");
    expect(text).toContain("The token expired or stopped working.");
    expect(text).toContain("Meta error code: 190");
    expect(text).toContain("Go to Settings → Instagram accounts");
    expect(thaiIn(html)).toEqual([]);
    // Meta ไม่บอกสาเหตุ
    expect(textOf(full(event({ type: "dm_failed", error: { message: null, code: null } }), "en"))).toContain("Reason: Unknown reason");
    expect(textOf(full(event({ type: "dm_failed", error: { message: null, code: null } })))).toContain("สาเหตุ: ไม่ทราบสาเหตุ");
    expect(textOf(compact(event({ type: "dm_failed", error: { message: null, code: null } }), "en"))).toContain("Unknown reason");
  });

  it("ข้อความของระบบ (สาเหตุ / แจ้งชะลอการส่ง) แปลตามภาษา — ข้อความของลูกค้า/ร้านไม่แปล", () => {
    const stored = systemMessage("stepMissing");
    const failed = event({ type: "dm_failed", error: { message: stored, code: null } });
    expect(textOf(full(failed, "en"))).toContain("Reason: This message is no longer in the automation");
    expect(textOf(compact(failed, "en"))).toContain("This message is no longer in the automation");
    expect(thaiIn(full(failed, "en"))).toEqual([]);
    expect(textOf(full(failed))).toContain(`สาเหตุ: ${stored}`);

    const notice = systemMessage("rateLimitNotice", { code: "613", minutes: "4" });
    const limited = event({ type: "dm_rate_limited", text: notice, person: "@mali.shop", ruleId: null, ruleName: null });
    expect(textOf(full(limited, "en"))).toContain("(first try in 4 min)");
    expect(textOf(compact(limited, "en"))).toContain("Meta says this account is sending messages too often for now (code 613).");
    expect(textOf(full(limited))).toContain(notice);

    // DM ที่ร้านเขียนเอง (บังเอิญตรงกับแม่แบบ) แสดงตามที่ส่งจริง
    expect(textOf(full(event({ type: "dm_sent", text: stored }), "en"))).toContain(stored);
  });

  it("เหตุผลที่ข้าม + ข้อความยาว (ดูทั้งหมด / ย่อ)", () => {
    const html = full(event({ type: "skipped", skipReason: "once_per_user", text: "x".repeat(200) }), "en");
    expect(textOf(html)).toContain("This person already got it from this automation (set to send once per person)");
    expect(textOf(html)).toContain("Show all");
    expect(textOf(html)).toContain("Show less");
    expect(textOf(full(event({ type: "skipped", skipReason: "new_reason" }), "en"))).toContain("new_reason");
  });

  it("errorHint ภาษาอังกฤษ — เมนู Instagram ใช้ชื่อตามแอปภาษาอังกฤษ", () => {
    expect(errorHint("10 / 2018278", "en")).toContain("more than 24 hours");
    expect(errorHint("100 / 2534041", "en")).toBe(
      "This Instagram account has 'Allow access to messages' turned off. Turn it on in your shop's Instagram app: Profile → ☰ → Settings and activity → Messages and story replies → Message controls → Connected tools → Allow access to messages (see step 5 of the Setup guide)",
    );
    // ภาษาไทยยังใช้เมนูชุดเดียวกับคู่มือ
    expect(errorHint("100 / 2534041")).toContain(`${INSTAGRAM_MESSAGE_ACCESS_MENU.join(" → ")} → อนุญาตการเข้าถึงข้อความ`);
    for (const code of ["190", "10", "200", "551", "4", "32", "613"]) {
      const hint = errorHint(code, "en");
      expect(hint, code).toBeTruthy();
      expect(thaiIn(hint!), code).toEqual([]);
    }
    expect(errorHint("1", "en")).toBeNull();
  });
});

describe("แถบแจ้งเตือนรายการไม่สำเร็จ ภาษาอังกฤษ", () => {
  it("แยกส่งไม่สำเร็จ / ต่ออายุ token ไม่สำเร็จ", () => {
    expect(failureSummary({}, "en")).toBeNull();
    expect(failureSummary({ dm_failed: 2, public_reply_failed: 1 }, "en")).toEqual({
      title: "Failed to send in the last 24 hours: 3",
      description: "See the reason and how to fix each one.",
      href: "/activity?filter=failed",
      action: "See reasons",
    });
    const token = failureSummary({ token_refresh_failed: 1 }, "en")!;
    expect(token.title).toBe("Instagram token renewals failed in the last 24 hours: 1");
    expect(token.action).toBe("Go to Settings");
    const both = failureSummary({ dm_failed: 1200, token_refresh_failed: 1 }, "en")!;
    expect(both.title).toBe("Failed in the last 24 hours: 1,201");
    expect(both.description).toContain("Messages not sent: 1,200 · Instagram token renewals failed: 1");
  });
});

describe("หน้า loading ตามภาษา (แสดงได้ทันที ไม่ต้องอ่านคุกกี้)", () => {
  it("กิจกรรม / รายชื่อลูกค้า", () => {
    expect(textOf(render(createElement(ActivityLoading), "en"))).toContain("Loading activity…");
    expect(textOf(render(createElement(ContactsLoading), "en"))).toContain("Loading contacts…");
    expect(textOf(render(createElement(ActivityLoading)))).toContain(activityMessages.th.loading);
    expect(textOf(render(createElement(ContactsLoading)))).toContain("กำลังโหลดรายชื่อลูกค้า…");
  });
});

// ---------------- ทั้งหน้า (ใช้ฐานข้อมูลเทส) ----------------

describe("ทั้งหน้าเป็นภาษาอังกฤษเมื่อคุกกี้ lang=en", () => {
  let db: Db;
  beforeEach(async () => {
    db = await resetDatabase();
    lang.value = undefined;
  });

  it("ภาพรวม: ยังไม่มีข้อมูล", async () => {
    const html = await renderPage(OverviewPage, "/", {}, "en");
    const text = textOf(html);
    expect(thaiIn(html)).toEqual([]);
    for (const s of [
      "Dashboard",
      "Almost ready to auto-reply. Steps left:",
      "Next step:",
      "Automation matches",
      "DMs sent",
      "Click rate",
      "Taps and clicks",
      "New contacts",
      "No data in the last 30 days",
      "Create your first automation",
      "By platform",
      "Top automations",
      "No automations yet",
      "Recent activity",
      "No activity yet",
    ]) {
      expect(text, s).toContain(s);
    }
    // ไม่มีคุกกี้ → ไทย
    const th = textOf(await renderPage(OverviewPage, "/"));
    expect(th).toContain("ภาพรวม");
    expect(th).toContain("ยังไม่มีกฎอัตโนมัติ");
    expect(th).not.toContain("Top automations");
  });

  it("ภาพรวม: มีข้อมูล (กราฟ ตารางกฎ กิจกรรมล่าสุด)", async () => {
    await seed(db);
    const html = await renderPage(OverviewPage, "/", { range: "7" }, "en");
    const text = textOf(html);
    expect(thaiIn(html)).toEqual([]);
    for (const s of [
      "How your automations did over the last 7 days",
      "Daily activity",
      "No data for the previous period",
      "Message results",
      "Total",
      "Show as a table",
      "Public replies",
      "DMs opened by customers",
      "Links opened",
      "Failed to send",
      "Matched an automation",
      "Show 2 more",
      "Promo 1",
      "Runs",
      "Off",
      "All automations",
      "See all",
    ]) {
      expect(text, s).toContain(s);
    }
    expect(html).toContain('title="Share of people who got a DM and tapped a button or link (– for automations without buttons)"');
  });

  it("กิจกรรม: ทุกประเภท + ส่วนตรวจสอบปัญหา", async () => {
    await seed(db);
    const html = await renderPage(ActivityPage, "/activity", {}, "en");
    const text = textOf(html);
    expect(thaiIn(html)).toEqual([]);
    expect(html).toContain('aria-label="Filter by type"');
    for (const s of [
      "Activity",
      "Refresh",
      "Failed in the last 24 hours:",
      "Taps/clicks",
      "Latest:",
      "Today",
      "New comment",
      "New message",
      "Public reply sent",
      "Public reply failed",
      "DM failed",
      "Button tapped",
      "Link clicked",
      "Skipped, not sent",
      "Automation now runs on a new post",
      "Meta asked to slow down DMs for @mali.shop",
      "This automation is off, so the next message wasn't sent",
      "Couldn't check with Meta",
      "(no match)",
      "Troubleshooting",
      "Tasks that failed",
      "Send a DM",
      "Handle a comment",
      "something_new",
      "Attempts: 5",
      "Latest data from Meta (webhook)",
      "Instagram (via Page)",
      "Instagram (Instagram Login)",
      "Unknown source",
      "Comment · mention · Other",
      "Button tap ×2",
      "Page message",
    ]) {
      expect(text, s).toContain(s);
    }
  });

  it("กิจกรรม: ข้อความของระบบที่เก็บเป็นภาษาไทย (สาเหตุ / แจ้งชะลอการส่ง / งานที่ล้มเหลว) แสดงเป็นภาษาอังกฤษ", async () => {
    const fb = { platform: "facebook" as const, pageId: "PAGE1" };
    const ig = { platform: "instagram" as const, pageId: "IG1" };
    const failure = (message: string) => ({ error: { message } });
    const network = systemMessage("graphUnreachable", { detail: "fetch failed" });
    const rateLimit = systemMessage("rateLimitNotice", { code: "613", minutes: "1" });
    // ข้อความเดียวกับที่ lib สร้างจริง (แถวเก่าในฐานข้อมูลก็เป็นข้อความชุดนี้)
    await db.insert(events).values([
      { ...fb, type: "dm_failed", meta: failure(systemMessage("pageTokenRejected")) },
      { ...fb, type: "dm_failed", meta: failure(systemMessage("stepMissing")) },
      { ...fb, type: "public_reply_failed", meta: failure(systemMessage("graphHttpStatus", { status: "502" })) },
      { ...fb, type: "skipped", meta: { reason: "next_post_lookup_failed", ...failure(network) } },
      { ...ig, type: "dm_failed", meta: { error: { message: systemMessage("igTokenRejected"), code: 190 } } },
      { ...ig, type: "token_refresh_failed", meta: { username: "mali.shop", ...failure(systemMessage("igTokenDecrypt")) } },
      { ...ig, type: "dm_rate_limited", text: rateLimit, meta: { accountName: "@mali.shop" } },
    ]);
    await db.insert(jobs).values([
      { type: "mystery", payload: {}, status: "failed", attempts: 5, lastError: systemMessage("unknownJobType", { type: "mystery" }) },
      { type: "send_dm", payload: {}, status: "failed", attempts: 5, lastError: network },
    ]);

    const html = await renderPage(ActivityPage, "/activity", {}, "en");
    expect(thaiIn(html)).toEqual([]);
    const text = textOf(html);
    for (const s of [
      "Reason: Your Page token doesn't work — go to Settings and reconnect the Page.",
      "Reason: This message is no longer in the automation (it may have been deleted while waiting to be sent).",
      "Reason: The Graph API responded with status 502",
      "Reason: Couldn't reach the Graph API: fetch failed",
      "Reason: Your Instagram token doesn't work — go to Settings → Instagram accounts and paste a new token.",
      "Reason: Can't read the saved token — paste a new token.",
      "Meta says this account is sending messages too often for now (code 613). DMs are paused",
      "Unknown task type: mystery",
    ]) {
      expect(text, s).toContain(s);
    }

    // การ์ด "กิจกรรมล่าสุด" ในหน้าภาพรวม (แบบย่อ)
    const overview = await renderPage(OverviewPage, "/", {}, "en");
    expect(thaiIn(overview)).toEqual([]);
    expect(textOf(overview)).toContain("Meta says this account is sending messages too often for now");

    // ไม่มีคุกกี้ → ข้อความไทยต้นฉบับเหมือนเดิม
    const th = textOf(await renderPage(ActivityPage, "/activity"));
    for (const s of [systemMessage("pageTokenRejected"), rateLimit, network, systemMessage("unknownJobType", { type: "mystery" })]) {
      expect(th, s).toContain(s);
    }
  });

  it("กิจกรรม: ตัวกรอง / หน้าว่าง / ดูย้อนหลัง", async () => {
    let html = await renderPage(ActivityPage, "/activity", {}, "en");
    expect(thaiIn(html)).toEqual([]);
    expect(textOf(html)).toContain("No activity yet");
    expect(textOf(html)).toContain("Open Setup guide");
    expect(textOf(html)).toContain("Nothing from Meta yet");

    html = await renderPage(ActivityPage, "/activity", { filter: "failed" }, "en");
    expect(thaiIn(html)).toEqual([]);
    expect(textOf(html)).toContain("Nothing failed to send");
    expect(textOf(html)).toContain("Replies are going out as usual.");
    expect(textOf(html)).toContain("See all activity");

    await seed(db);
    html = await renderPage(ActivityPage, "/activity", { before: "3" }, "en");
    expect(thaiIn(html)).toEqual([]);
    expect(textOf(html)).toContain("You're looking at older events");
    expect(textOf(html)).toContain("Back to latest");
    expect(textOf(html)).toContain("Older: 2");

    html = await renderPage(ActivityPage, "/activity", { before: "1" }, "en");
    expect(textOf(html)).toContain("Nothing older than this");

    // ไทยเหมือนเดิม
    const th = textOf(await renderPage(ActivityPage, "/activity", { filter: "failed" }));
    expect(th).toContain("กิจกรรม");
    expect(th).toContain("สำหรับตรวจสอบปัญหา");
    expect(th).toContain("ส่ง DM ไม่สำเร็จ");
  });

  it("รายชื่อลูกค้า: ตาราง / ค้นหา / ไม่พบ / เลขหน้า", async () => {
    let html = await renderPage(ContactsPage, "/contacts", {}, "en");
    expect(thaiIn(html)).toEqual([]);
    expect(textOf(html)).toContain("No contacts yet");
    expect(textOf(html)).toContain("View automations");

    await seed(db);
    html = await renderPage(ContactsPage, "/contacts", {}, "en");
    let text = textOf(html);
    expect(thaiIn(html)).toEqual([]);
    for (const s of [
      "Contacts",
      "4 total",
      "Search",
      "All",
      "Contact",
      "First seen",
      "Last message",
      "DMs sent",
      "Link clicks",
      "Never messaged",
      "Facebook user",
      "Instagram user",
      "Latest comment:",
      "Open chat",
      "DMs 1 · Link clicks 2",
      "Showing 1–4 of 4",
    ]) {
      expect(text, s).toContain(s);
    }
    expect(html).toContain('placeholder="Search by name or username"');
    expect(html).toContain('aria-label="Open chat with Mali Shop Fan in Meta Business Suite (opens in a new tab)"');
    // มือถือ: ปุ่มเดียวกันเปิดแอป Messenger แทน
    expect(html).toContain('aria-label="Open chat with Mali Shop Fan in the Messenger app"');
    expect(html).toContain('href="fb-messenger://"');

    html = await renderPage(ContactsPage, "/contacts", { q: "mali" }, "en");
    text = textOf(html);
    expect(thaiIn(html)).toEqual([]);
    expect(text).toContain("Results for “ mali ”: 1");
    expect(text).toContain("Clear search");

    html = await renderPage(ContactsPage, "/contacts", { q: "nobody" }, "en");
    expect(thaiIn(html)).toEqual([]);
    expect(textOf(html)).toContain("No results for “nobody”");
    expect(textOf(html)).toContain("Try another name or the customer's username.");

    html = await renderPage(ContactsPage, "/contacts", { page: "9" }, "en");
    expect(thaiIn(html)).toEqual([]);
    expect(textOf(html)).toContain("Nothing on this page");
    expect(textOf(html)).toContain("Back to the first page");

    // ไทยเหมือนเดิม
    const th = textOf(await renderPage(ContactsPage, "/contacts"));
    expect(th).toContain("รายชื่อลูกค้า");
    expect(th).toContain("4 คน");
    expect(th).toContain("แสดง 1–4 จาก 4 คน");
    expect(th).toContain("ผู้ใช้ Facebook");
  });
});
