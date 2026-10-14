import { describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { SetupStatus } from "@/lib/config";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";
import { guideMessages } from "@/lib/i18n/messages/guide";
import { INSTAGRAM_ERRORS, type InstagramAccount } from "@/lib/instagram/accounts";
import { INSTAGRAM_MESSAGE_ACCESS_MENU, INSTAGRAM_MESSAGE_ACCESS_MENU_EN, REQUIRED_PERMISSIONS } from "@/lib/meta/setup-info";
import type { ConnectedPage } from "@/lib/pages";

/*
 * หน้าคู่มือตั้งค่า (/guide) เป็นภาษาอังกฤษเมื่อเลือก English (คุกกี้ lang=en)
 * - เรนเดอร์ทั้งหน้า (รวมฟอร์มจากหน้าตั้งค่าที่ฝังอยู่) แล้วตรวจว่าไม่มีตัวอักษรไทยหลงอยู่เลย (รวม aria-label / title / placeholder)
 * - ไม่มีคุกกี้ = ภาษาไทยเหมือนเดิม (ข้อความไทยตรวจละเอียดใน setup-ui.test.ts)
 * ไม่ใช้ฐานข้อมูล: page.tsx โหลดข้อมูลผ่านฟังก์ชันที่ mock ไว้ด้านล่าง ชื่อเพจ/บัญชีในเทสเป็นภาษาอังกฤษ
 */

// คุกกี้ภาษาของคำขอ (getLocale() อ่านผ่าน cookies() ของ Next)
const lang = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "lang" && lang.value ? { name, value: lang.value } : undefined),
  }),
}));

// ข้อมูลที่ page.tsx โหลด (แทนฐานข้อมูล)
const data = vi.hoisted(() => ({
  status: null as unknown as SetupStatus,
  pages: [] as ConnectedPage[],
  igAccounts: [] as InstagramAccount[],
}));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config")>()),
  getSetupStatus: async () => data.status,
  getInstagramConfig: async () => ({ metaAppSecret: null }),
}));
vi.mock("@/lib/pages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pages")>()),
  listConnectedPages: async () => data.pages,
}));
vi.mock("@/lib/instagram/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/instagram/accounts")>()),
  listInstagramAccounts: async () => data.igAccounts,
}));

const { default: GuidePage } = await import("@/app/(dashboard)/guide/page");
const { GuideView } = await import("@/app/(dashboard)/guide/guide-view");
const { instagramStepStatus } = await import("@/app/(dashboard)/guide/instagram-step");

const ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };
const DAY = 24 * 60 * 60_000;
const THAI = /[฀-๿]/;

function render(el: ReactElement, locale?: Locale): string {
  const inner = createElement(PathnameContext.Provider, { value: "/guide" }, el);
  return renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      // root layout ห่อทั้งแอปด้วย I18nProvider ตามคุกกี้ — ไม่ส่ง locale = ไม่มี Provider (ไทย)
      locale ? createElement(I18nProvider, { locale } as ComponentProps<typeof I18nProvider>, inner) : inner,
    ),
  );
}

/** เรนเดอร์ทั้งหน้าเหมือนคำขอจริงที่มีคุกกี้ lang (ไม่ส่ง = ไม่มีคุกกี้) */
async function renderGuide(o: { status?: SetupStatus; pages?: ConnectedPage[]; igAccounts?: InstagramAccount[] } = {}, locale?: Locale) {
  data.status = o.status ?? status();
  data.pages = o.pages ?? [];
  data.igAccounts = o.igAccounts ?? [];
  lang.value = locale;
  return render(await GuidePage(), locale);
}

/** ข้อความล้วน (ตัดแท็ก HTML — ตัวหนา <b> ตัดทิ้งเฉยๆ เพราะอยู่กลางประโยค แท็กอื่นแทนด้วยช่องว่าง) */
function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<\/?b\b[^>]*>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}

/** ข้อความไทยที่หลงอยู่ (ทั้งข้อความบนหน้าและ attribute ที่โปรแกรมอ่านหน้าจอ/tooltip ใช้) */
function thaiLeftovers(html: string): string[] {
  const words = textOf(html)
    .split(" ")
    .filter((w) => THAI.test(w));
  const attrs = [...html.matchAll(/(?:aria-label|title|placeholder|alt)="([^"]*)"/g)].map((m) => m[1]).filter((v) => THAI.test(v));
  return [...words, ...attrs];
}

/** ส่วนหัวของการ์ดขั้นที่ n (ป้าย + ชื่อ + สรุป) */
function stepSummary(html: string, n: number): string {
  const start = html.indexOf(`<li id="step-${n}"`);
  const end = html.indexOf("</summary>", start);
  return textOf(html.slice(start, end)).trim();
}

function account(o: Partial<InstagramAccount> = {}): InstagramAccount {
  return {
    id: "IG1",
    appScopedId: "APPSCOPED1",
    username: "north.shop",
    name: "North Shop",
    accountType: "Business",
    token: "IG_TOKEN",
    tokenExpiresAt: new Date(Date.now() + 50 * DAY),
    tokenExpiryEstimated: false,
    tokenRefreshedAt: new Date(Date.now() - 10 * DAY),
    tokenCheckedAt: null,
    subscribed: true,
    lastError: null,
    lastCommentWebhookAt: null,
    lastMessagingWebhookAt: null,
    connectedAt: new Date(Date.now() - 10 * DAY),
    ...o,
  };
}

function page(o: Partial<ConnectedPage> = {}): ConnectedPage {
  return {
    id: "P1",
    name: "Mali Shop",
    token: "PAGE_TOKEN",
    subscribed: true,
    igUserId: null,
    igUsername: null,
    lastError: null,
    connectedAt: new Date(Date.now() - 10 * DAY),
    ...o,
  } as ConnectedPage;
}

/** ค่าเริ่มต้น: ตั้งค่าครบทุกขั้น (ยกเว้น App Review) */
function status(o: Partial<SetupStatus> = {}, ig: Partial<SetupStatus["instagram"]> = {}): SetupStatus {
  return {
    baseUrl: "https://dm.example.com",
    meta: { appId: "1234567890", appSecret: "secret", verifyToken: "verify", fromEnv: false },
    webhookVerifiedAt: "2026-10-01T03:04:00Z",
    pagesConnected: 1,
    pagesSubscribed: 1,
    lastWebhookAt: new Date("2026-10-02T05:06:00Z"),
    badSignatureAt: null,
    ruleCount: 1234,
    appReviewDone: false,
    instagram: {
      appSecretSet: false,
      fromEnv: false,
      accounts: 0,
      subscribed: 0,
      webhookVerifiedAt: null,
      lastWebhookAt: null,
      badSignatureAt: null,
      tokenWarning: null,
      ...ig,
    },
    ...o,
  };
}

/** ยังไม่ได้ตั้งค่าอะไรเลย (เห็นคำเตือน "ทำขั้นที่ 1 ก่อน" และฟอร์มทุกอัน) */
const EMPTY = status({
  baseUrl: null,
  meta: { appId: null, appSecret: null, verifyToken: "verify", fromEnv: false },
  webhookVerifiedAt: null,
  pagesConnected: 0,
  pagesSubscribed: 0,
  lastWebhookAt: null,
  ruleCount: 0,
});

/** ทำไปบางขั้น + มีปัญหา (ลายเซ็นไม่ตรงทั้ง Facebook และ Instagram) */
const TROUBLE = status(
  { webhookVerifiedAt: null, pagesSubscribed: 0, lastWebhookAt: null, badSignatureAt: "2026-10-03T07:08:00Z" },
  { subscribed: 1, accounts: 1, badSignatureAt: "2026-10-04T09:10:00Z" },
);

describe("คู่มือตั้งค่าภาษาอังกฤษ (คุกกี้ lang=en)", () => {
  it("ยังไม่ได้ตั้งค่า: ไม่มีภาษาไทยหลงอยู่ และขั้นแรกเป็นขั้นต่อไป", async () => {
    const html = await renderGuide({ status: EMPTY }, "en");
    expect(thaiLeftovers(html)).toEqual([]);
    const text = textOf(html);
    expect(text).toContain("Setup guide");
    expect(text).toContain("0 of 6 steps done");
    expect(text).toContain("6 to go, then you're ready");
    expect(html).toContain('aria-label="Setup progress"');
    expect(stepSummary(html, 1)).toContain("Step 1 Next step Tell the system where it lives");
    expect(text).toContain("Finish step 1 first. The links will show up here.");
    expect(text).toContain("Finish step 2 first.");
    expect(text).toContain("Enter your App ID / App Secret (step 2) first.");
    // ยังไม่มี Webhook → บอกวิธีเช็ก พร้อมชื่อปุ่ม "Check again" ตรงกับปุ่มจริง
    expect(text).toContain("No data from Meta yet");
    expect(text).toContain('then click "Check again" here');
    expect(text).toContain("Check again");
  });

  it("ตั้งค่าบางส่วน + มีปัญหา: ไม่มีภาษาไทยหลงอยู่ วันที่และตัวเลขเป็นแบบอังกฤษ", async () => {
    const html = await renderGuide(
      { status: TROUBLE, pages: [page({ subscribed: false, igUsername: "north.shop" })], igAccounts: [account()] },
      "en",
    );
    expect(thaiLeftovers(html)).toEqual([]);
    const text = textOf(html);
    expect(text).toContain("Go to step 3: Set up the webhook");
    expect(stepSummary(html, 4)).toContain("Optional. You can use Instagram only (connected in step 5).");
    expect(stepSummary(html, 5)).toContain(
      "Connected @north.shop. Still to do: item 8 (Instagram webhook) and item 11 (publish the app)",
    );
    expect(stepSummary(html, 6)).toContain("Automations so far: 1,234");
    expect(text).toContain("Meta sent Instagram data, but the signature doesn't match your saved secret");
    expect(text).toContain("Last seen Oct 4, 4:10 PM.");
    expect(text).toContain("Meta sent data, but the App Secret here doesn't match the one in Meta");
    expect(text).toContain("(last seen Oct 3, 2:08 PM)");
    expect(html).toContain('href="/settings#meta-app"');
    expect(text).toContain("type your shop's username (@north.shop) → send the invite");
    // ปุ่มคัดลอก permission ทีละตัว
    expect(text).toContain(`add everything on this list (${REQUIRED_PERMISSIONS.length} in all.`);
    expect(html).toContain('aria-label="Tap to copy one at a time"');
    expect(html).toContain('aria-label="Copy pages_messaging"');
    expect(text).toContain("Copy all");
  });

  it("ตั้งค่าครบ: สรุปของแต่ละขั้นเป็นภาษาอังกฤษ", async () => {
    const html = await renderGuide(
      {
        status: status(
          { appReviewDone: true },
          { subscribed: 1, accounts: 1, webhookVerifiedAt: "2026-10-01T00:00:00Z", lastWebhookAt: new Date("2026-10-05T11:12:00Z") },
        ),
        pages: [page(), page({ id: "P2", name: "Second Shop" })],
        igAccounts: [account({ tokenExpiryEstimated: true })],
      },
      "en",
    );
    expect(thaiLeftovers(html)).toEqual([]);
    const text = textOf(html);
    expect(text).toContain("6 of 6 steps done");
    expect(text).toContain("All set! The system is ready to reply to customers for you.");
    expect(text).toContain("Go to Dashboard");
    expect(stepSummary(html, 1)).toBe("Step 1 Done Your system is online https://dm.example.com");
    expect(stepSummary(html, 2)).toContain("App ID 1234567890 saved");
    expect(stepSummary(html, 3)).toContain("Meta confirmed your system's link on Oct 1, 10:04 AM");
    expect(stepSummary(html, 4)).toContain("Connected: Mali Shop, Second Shop");
    expect(stepSummary(html, 5)).toMatch(/Connected: @north\.shop \(token valid until .+ \(estimated\)\)/);
    expect(stepSummary(html, 7)).toContain("Data is coming in from Meta (last: Oct 2, 12:06 PM)");
    expect(stepSummary(html, 8)).toContain("App Review passed and your app is Live");
    expect(text).toContain("Meta confirmed your Instagram link · Last data via Instagram Login: Oct 5, 6:12 PM");
    expect(text).toContain("Mark as not done");
  });

  it("ชื่อปุ่ม/เมนูของ Meta และ Instagram ใช้ชื่อภาษาอังกฤษตามที่แอปแสดง", async () => {
    const text = textOf(await renderGuide({ status: EMPTY }, "en"));
    // เมนูในแอป Instagram (ชุดเดียวกับคำอธิบาย error 2534041 ในหน้ากิจกรรม)
    expect(text).toContain(`${INSTAGRAM_MESSAGE_ACCESS_MENU_EN.join(" → ")} → turn on Allow access to messages`);
    expect(text).toContain("In the left menu, open App settings → Basic: copy the App ID, click Show next to App secret");
    expect(text).toContain("Second box: in the left menu, open App settings → Basic → App secret → click Show → copy it");
    expect(text).toContain('Publish the app: in the left menu, open Publish (at first it says "Unpublished") → click the Publish button');
    expect(text).toContain("set it to Live.) If you can't click it, check that item 2 is complete (2 links, App icon,");
    expect(text).toContain("there's an App Mode: Development / Live switch. Set it to Live.");
    expect(text).toContain("Manage messaging & content on Instagram");
    expect(text).toContain("I don't want to connect a business portfolio yet");
    // ลิงก์ภายนอกบอกโปรแกรมอ่านหน้าจอว่าเปิดแท็บใหม่
    expect(text).toContain("(opens in a new tab)");
    // ปุ่มสร้างกฎใช้ชื่อเดียวกับทั้งแอป
    expect(text).toContain("New Automation");
  });

  it("ไม่มีคุกกี้ = ภาษาไทยเหมือนเดิม และตรงกับ GuideView ที่ไม่ส่ง locale ทุกไบต์", async () => {
    const html = await renderGuide({ status: TROUBLE, igAccounts: [account()] });
    const text = textOf(html);
    expect(text).toContain("เสร็จแล้ว 4 จาก 6 ขั้น");
    expect(text).toContain(`${INSTAGRAM_MESSAGE_ACCESS_MENU.join(" → ")} → เปิด อนุญาตการเข้าถึงข้อความ`);
    expect(text).toContain("Meta ส่งข้อมูลมาแล้ว แต่ App Secret ในระบบไม่ตรงกับใน Meta");
    expect(text).not.toContain("Setup progress");
    const direct = render(createElement(GuideView, { status: TROUBLE, pages: [], igAccounts: [account()], igHasMetaAppSecret: false }));
    expect(html).toBe(direct);
  });
});

describe("สรุปของขั้นที่ 5 (instagramStepStatus) ภาษาอังกฤษ", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const en = (accounts: InstagramAccount[], webhookOk = true) => instagramStepStatus(accounts, now, webhookOk, "en");

  it("ทุกสถานะเป็นภาษาอังกฤษ ไม่มีภาษาไทย", () => {
    const cases = [
      en([]),
      en([account()]),
      en([account()], false),
      en([account({ tokenExpiresAt: new Date("2026-01-01T00:00:00Z"), tokenExpiryEstimated: true })]),
      en([account({ lastError: INSTAGRAM_ERRORS.tokenRejected })]),
      en([account({ subscribed: false })]),
    ];
    for (const c of cases) expect(c.summary).not.toMatch(THAI);
    expect(cases[0]).toEqual({
      done: false,
      summary: "Let the system reply to Instagram comments and DMs by connecting straight to Instagram, separate from Facebook",
    });
    expect(cases[1].done).toBe(true);
    expect(cases[2].summary).toContain("item 8");
    expect(cases[3].summary).toBe("The token for @north.shop expired on Jan 1, 7:00 AM (estimated). Paste a new token in item 7.");
    expect(cases[4].summary).toBe("The token for @north.shop no longer works. Paste a new token in item 7.");
    // ชื่อปุ่มตรงกับปุ่ม "Try again" ในรายการบัญชี (common.retry)
    expect(cases[5].summary).toBe(
      'Connected @north.shop, but it isn\'t receiving webhooks yet. Click "Try again" in the account list in item 7.',
    );
  });

  it("ไม่ส่งภาษา = ไทยเหมือนเดิม", () => {
    expect(instagramStepStatus([account({ subscribed: false })], now).summary).toBe(
      'เชื่อม @north.shop แล้ว แต่ยังไม่รับ webhook — กด "ลองใหม่" ในรายการบัญชีที่ข้อ 7',
    );
  });
});

describe("ข้อความของคู่มือ", () => {
  it("เมนูในแอป Instagram มีจำนวนชั้นเท่ากันทั้งสองภาษา", () => {
    expect(INSTAGRAM_MESSAGE_ACCESS_MENU_EN).toHaveLength(INSTAGRAM_MESSAGE_ACCESS_MENU.length);
    for (const m of INSTAGRAM_MESSAGE_ACCESS_MENU_EN) expect(m).not.toMatch(THAI);
  });

  it("ชื่อขั้นแบบสั้น (รายการด้านขวา กว้างราว 190px) ไม่ยาวเกินไป", () => {
    const shorts = Object.entries(guideMessages.en).filter(([k]) => /^short\d$/.test(k));
    expect(shorts).toHaveLength(8);
    for (const [, v] of shorts) expect(v.length).toBeLessThanOrEqual(24);
  });
});
