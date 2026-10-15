import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { SetupStatus } from "@/lib/config";
import { createT } from "@/lib/i18n/core";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";
import { settingsMessages } from "@/lib/i18n/messages/settings";
import { systemMessages } from "@/lib/i18n/messages/system";
import { localizeSystemMessage, systemMessage } from "@/lib/i18n/system";
import { INSTAGRAM_ERRORS, type InstagramAccount } from "@/lib/instagram/accounts";
import type { ConnectedPage } from "@/lib/pages";

/*
 * หน้าตั้งค่า (/settings) + ฟอร์ม/รายการที่ใช้ร่วมกับหน้าคู่มือ เป็นภาษาอังกฤษเมื่อเลือก English (คุกกี้ lang=en)
 * - เรนเดอร์ทั้งหน้าด้วยข้อมูลจำลอง (ไม่ใช้ฐานข้อมูล) แล้วตรวจว่าไม่มีตัวอักษรไทยหลง (รวม title / aria-label / placeholder)
 * - error ของ Server Action และข้อความภาษาไทยจาก lib/instagram/* แสดงเป็นภาษาอังกฤษ
 * - ไม่มีคุกกี้ = ภาษาไทยเหมือนเดิม
 * ชื่อเพจ/บัญชีในเทสนี้เป็นภาษาอังกฤษ เพื่อให้ตรวจได้ว่าข้อความของระบบไม่มีภาษาไทยเหลือ
 */

const lang = vi.hoisted(() => ({ value: undefined as string | undefined }));
const fx = vi.hoisted(() => ({
  status: null as unknown,
  pages: [] as unknown[],
  accounts: [] as unknown[],
  igConfig: { appSecret: null as string | null, metaAppSecret: null as string | null, fromEnv: false },
  // ยังไม่ได้ใส่ App ID / App Secret → แลก token ไม่ได้ (ข้อความจาก lib/meta/graph.ts)
  metaConfig: { appId: null as string | null, appSecret: null as string | null, verifyToken: "verify", fromEnv: false },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "lang" && lang.value ? { name, value: lang.value } : undefined) }),
}));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config")>()),
  getSetupStatus: async () => fx.status,
  getInstagramConfig: async () => fx.igConfig,
  getMetaConfig: async () => fx.metaConfig,
}));
vi.mock("@/lib/instagram/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/instagram/accounts")>()),
  listInstagramAccounts: async () => fx.accounts,
}));
vi.mock("@/lib/pages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pages")>()),
  listConnectedPages: async () => fx.pages,
}));
// การ์ด "การแสดงผล" เป็น async Server Component (renderToStaticMarkup เรนเดอร์ไม่ได้) และแปลไว้แล้วในหมวด appearance
vi.mock("@/app/(dashboard)/settings/appearance-card", () => ({ AppearanceCard: () => null }));

const { default: SettingsPage } = await import("@/app/(dashboard)/settings/page");
const actions = await import("@/app/(dashboard)/settings/actions");
const { ConnectForm } = await import("@/app/(dashboard)/settings/connect-form");
const { BaseUrlForm, ChangePasswordForm, InstagramAppForm, MetaAppForm } = await import("@/app/(dashboard)/settings/forms");
const { InstagramConnectForm } = await import("@/app/(dashboard)/settings/instagram-connect-form");
const { InstagramAccountsList } = await import("@/app/(dashboard)/settings/instagram-list");
const { PagesList } = await import("@/app/(dashboard)/settings/pages-list");
const { DisconnectButton, ResubscribeButton } = await import("@/app/(dashboard)/settings/page-actions");
const { DisconnectInstagramButton, RefreshInstagramTokenButton, ResubscribeInstagramButton } = await import(
  "@/app/(dashboard)/settings/instagram-actions"
);

const ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };
const DAY = 24 * 60 * 60_000;
const NOW = Date.now();

function render(el: ReactElement, locale?: Locale): string {
  const inner = createElement(PathnameContext.Provider, { value: "/settings" }, el);
  return renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      locale ? createElement(I18nProvider, { locale } as ComponentProps<typeof I18nProvider>, inner) : inner,
    ),
  );
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function attrs(html: string, name: string): string[] {
  return [...html.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((m) => m[1].replace(/&quot;/g, '"').replace(/&#x27;/g, "'"));
}

const THAI = /[฀-๿]/;

/** ไม่มีตัวอักษรไทยหลงในข้อความหรือแอตทริบิวต์ที่ผู้ใช้เห็น/โปรแกรมอ่านหน้าจออ่าน */
function expectNoThai(html: string) {
  const text = textOf(html);
  expect(text.match(new RegExp(`.{0,40}${THAI.source}.{0,40}`))?.[0] ?? null).toBeNull();
  for (const name of ["aria-label", "title", "placeholder"]) {
    for (const value of attrs(html, name)) expect(value, `${name}="${value}"`).not.toMatch(THAI);
  }
}

// ---------- ข้อมูลตัวอย่าง ----------

function account(o: Partial<InstagramAccount> = {}): InstagramAccount {
  return {
    id: "IG1",
    appScopedId: "APPSCOPED1",
    username: "north.shop",
    name: "North Shop",
    accountType: "Business",
    token: "IG_TOKEN",
    tokenExpiresAt: new Date(NOW + 50 * DAY),
    tokenExpiryEstimated: false,
    tokenRefreshedAt: new Date(NOW - 10 * DAY),
    tokenCheckedAt: null,
    subscribed: true,
    lastError: null,
    lastCommentWebhookAt: null,
    lastMessagingWebhookAt: null,
    connectedAt: new Date(NOW - 10 * DAY),
    ...o,
  };
}

function page(o: Partial<ConnectedPage> = {}): ConnectedPage {
  return {
    id: "P1",
    name: "Mali Shop",
    accessToken: "encrypted",
    token: "PAGE_TOKEN",
    igUserId: null,
    igUsername: null,
    subscribed: true,
    lastError: null,
    connectedAt: new Date("2026-10-01T03:04:00Z"),
    ...o,
  };
}

/** ทุกสถานะของบัญชี — lastError เป็นข้อความภาษาไทยจริงจาก lib/instagram/* */
const ACCOUNTS: InstagramAccount[] = [
  account(),
  account({ id: "IG2", username: "expired.shop", tokenExpiresAt: new Date(NOW - 2 * DAY), lastError: INSTAGRAM_ERRORS.tokenExpired }),
  account({ id: "IG3", username: "rejected.shop", lastError: INSTAGRAM_ERRORS.tokenRejected }),
  account({
    id: "IG4",
    username: "retry.shop",
    lastError: `${INSTAGRAM_ERRORS.refreshPrefix}: Graph API is down`,
    tokenExpiryEstimated: true,
    lastCommentWebhookAt: new Date(NOW - DAY),
    lastMessagingWebhookAt: new Date(NOW - 2 * DAY),
  }),
  account({ id: "IG5", username: "sub.shop", lastError: `${INSTAGRAM_ERRORS.subscribePrefix} (Unsupported request)` }),
  account({ id: "IG6", username: "broken.shop", token: null }),
  account({ id: "IG7", username: "unsub.shop", subscribed: false }),
  account({ id: "IG8", username: "soon.shop", tokenExpiresAt: new Date(NOW + 3 * DAY) }),
];

const PAGES: ConnectedPage[] = [
  page(),
  page({ id: "P2", name: "No Token Shop", token: null }),
  page({ id: "P3", name: "Unsub Shop", subscribed: false, lastError: "(#200) Permissions error", igUserId: "IG1", igUsername: "north.shop" }),
  page({ id: "P4", name: "Via Page Shop", igUserId: "IGX", igUsername: "via.page" }),
];

function status(o: Partial<SetupStatus> = {}, ig: Partial<SetupStatus["instagram"]> = {}): SetupStatus {
  return {
    baseUrl: "https://dm.example.com",
    meta: { appId: "1234567890", appSecret: "secret", verifyToken: "verify", fromEnv: false },
    webhookVerifiedAt: new Date(NOW - DAY).toISOString(),
    pagesConnected: 1,
    pagesSubscribed: 1,
    lastWebhookAt: new Date(NOW - 60 * 60_000),
    badSignatureAt: null,
    ruleCount: 1,
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

const ORIGINAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
afterEach(() => {
  lang.value = undefined;
  if (ORIGINAL_ADMIN_PASSWORD === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = ORIGINAL_ADMIN_PASSWORD;
});

async function settingsPage(locale: Locale | undefined, setup: { status: SetupStatus; pages?: ConnectedPage[]; accounts?: InstagramAccount[] }) {
  lang.value = locale;
  fx.status = setup.status;
  fx.pages = setup.pages ?? [];
  fx.accounts = setup.accounts ?? [];
  return render(await SettingsPage(), locale);
}

// ---------- หน้า /settings ----------

describe("หน้าตั้งค่า (/settings) สองภาษา", () => {
  const problems = {
    status: status(
      {
        baseUrl: null,
        webhookVerifiedAt: null,
        lastWebhookAt: null,
        badSignatureAt: new Date(NOW - DAY).toISOString(),
        meta: { appId: null, appSecret: null, verifyToken: "verify", fromEnv: false },
      },
      { badSignatureAt: new Date(NOW - DAY).toISOString() },
    ),
    pages: PAGES,
    accounts: ACCOUNTS,
  };
  const healthy = {
    status: status({ appReviewDone: true }, { appSecretSet: true, webhookVerifiedAt: new Date().toISOString(), lastWebhookAt: new Date() }),
    pages: [page()],
    accounts: [account()],
  };

  it("ภาษาอังกฤษ: ไม่มีภาษาไทยหลง ทั้งตอนมีปัญหาทุกอย่างและตอนพร้อมใช้งาน", async () => {
    for (const setup of [problems, healthy, { status: status() }]) {
      for (const env of [undefined, "secret-password"]) {
        if (env) process.env.ADMIN_PASSWORD = env;
        else delete process.env.ADMIN_PASSWORD;
        expectNoThai(await settingsPage("en", setup));
      }
    }
  });

  it("ภาษาอังกฤษ: หัวข้อ เมนูหมวด การ์ด และวันที่แบบอังกฤษ", async () => {
    const html = await settingsPage("en", problems);
    const text = textOf(html);
    for (const s of [
      "Setting up for the first time? The Setup guide walks you through it step by step.",
      "Connected Pages",
      "Connect a Page",
      "Instagram accounts",
      "Instagram webhook",
      "Web address",
      "Sending limits",
      "Password",
      "Change password",
      "Meta is sending data, but the App Secret doesn't match",
      "Meta hasn't verified your link yet",
      "Enter your web address first, and we'll create the Callback URL for you.",
      "From developers.facebook.com (opens in a new tab) → your app → App settings → Basic",
      "App Review status",
      "Test mode",
      "I passed App Review and went Live",
      "Private replies",
      "720 /hr",
      "No limit",
      "Connected Oct 1, 10:04 AM",
      "Couldn't renew the token: Graph API is down — we'll try again every 6 hours.",
      "Your Instagram token doesn't work — go to Settings → Instagram accounts and paste a new token.",
    ]) {
      expect(text).toContain(s);
    }
    expect(attrs(html, "aria-label")).toContain("Settings sections");
    expect(text).toContain("(needs attention)");
    // กลุ่มในเมนูหมวด
    expect(html).toContain(">Pages</p>");
    expect(html).toContain(">System</p>");

    const ready = textOf(await settingsPage("en", healthy));
    for (const s of ["Your Facebook and Instagram connections, plus system settings", "Live for everyone", "Unmark as done", "Verified by Meta", "Saved"]) {
      expect(ready).toContain(s);
    }
  });

  it("ภาษาไทย (ไม่มีคุกกี้ หรือคุกกี้ th) ยังเหมือนเดิม", async () => {
    for (const locale of [undefined, "th"] as const) {
      const text = textOf(await settingsPage(locale, problems));
      for (const s of [
        "ตั้งค่าครั้งแรก? ทำตาม คู่มือตั้งค่า ทีละขั้นจะง่ายกว่า",
        "เพจที่เชื่อมต่อ",
        "ใส่ ที่อยู่เว็บของระบบ ก่อน แล้วระบบจะสร้าง Callback URL ให้",
        "720 /ชม.",
        "ไม่จำกัด",
        `${INSTAGRAM_ERRORS.refreshPrefix}: Graph API is down — ระบบจะลองต่ออายุใหม่เองทุก 6 ชั่วโมง`,
        INSTAGRAM_ERRORS.tokenRejected,
      ]) {
        expect(text).toContain(s);
      }
      expect(text).not.toContain("Connected Pages");
    }
  });
});

// ---------- ฟอร์ม / รายการ / ปุ่ม (ใช้ในหน้าคู่มือด้วย) ----------

describe("ฟอร์มและรายการของหน้าตั้งค่า (ภาษาอังกฤษ)", () => {
  it("ฟอร์มทุกแบบไม่มีภาษาไทยหลง", () => {
    const els: ReactElement[] = [
      createElement(ConnectForm, { connectedIds: ["P1"] }),
      createElement(ConnectForm, { inGuide: true }),
      createElement(InstagramConnectForm, { hasAppSecret: false }),
      createElement(InstagramConnectForm, { hasAppSecret: true, inGuide: true }),
      createElement(BaseUrlForm, { baseUrl: null }),
      createElement(ChangePasswordForm, { managedByEnv: false }),
      createElement(ChangePasswordForm, { managedByEnv: true }),
    ];
    for (const fromEnv of [true, false]) {
      for (const hasSecret of [true, false]) {
        els.push(createElement(MetaAppForm, { appId: "1234567890", hasSecret, fromEnv }));
        for (const hasMetaAppSecret of [true, false]) {
          for (const separateApp of [true, false]) {
            els.push(createElement(InstagramAppForm, { hasSecret, hasMetaAppSecret, fromEnv, separateApp }));
          }
        }
      }
    }
    for (const el of els) expectNoThai(render(el, "en"));
  });

  it("ฟอร์มเชื่อมเพจ / Instagram: คำในปุ่ม ช่อง และลิงก์ไปคู่มือ", () => {
    const connect = textOf(render(createElement(ConnectForm, {}), "en"));
    expect(connect).toContain("Paste token");
    expect(connect).toContain("Choose Pages");
    expect(connect).toContain("Create one in Graph API Explorer ( see Setup guide step 4 ) — we'll swap it");
    expect(connect).toContain("Get my Pages");

    const ig = render(createElement(InstagramConnectForm, { hasAppSecret: false }), "en");
    expect(ig).toContain('href="/guide#step-5-token"');
    expect(textOf(ig)).toContain("Enter your Instagram app secret first");
    expect(textOf(ig)).toContain("Connect Instagram");

    const igApp = textOf(render(createElement(InstagramAppForm, { hasSecret: true, hasMetaAppSecret: false, fromEnv: false }), "en"));
    expect(igApp).toContain("Made a separate app for Instagram? (Setup guide step 5)");
    expect(igApp).toContain("(optional)");
  });

  it("รายการเพจ: ทุกสถานะ + วันที่แบบอังกฤษ ไม่ส่ง token ไปที่เบราว์เซอร์", () => {
    for (const pages of [[], PAGES]) {
      for (const inset of [false, true]) expectNoThai(render(createElement(PagesList, { pages, inset, igLoginIds: ["IG1"] }), "en"));
    }
    const html = render(createElement(PagesList, { pages: PAGES, igLoginIds: ["IG1"] }), "en");
    const text = textOf(html);
    for (const s of ["Ready", "Reconnect needed", "Not getting webhooks", "Uses Instagram Login", "Instagram @via.page (via Page)", "Reconnect"]) {
      expect(text).toContain(s);
    }
    expect(text).toContain("Connected Oct 1, 10:04 AM");
    expect(textOf(render(createElement(PagesList, { pages: [] }), "en"))).toContain("No Pages connected yet");
    expect(html).not.toContain("PAGE_TOKEN");
  });

  it("รายการบัญชี Instagram: ทุกสถานะ และข้อความจาก lib แปลเป็นอังกฤษ", () => {
    for (const accounts of [[], ACCOUNTS]) {
      for (const inset of [false, true]) expectNoThai(render(createElement(InstagramAccountsList, { accounts, pages: PAGES, inset }), "en"));
    }
    const html = render(createElement(InstagramAccountsList, { accounts: ACCOUNTS, pages: PAGES }), "en");
    const text = textOf(html);
    for (const s of [
      "Token expired",
      "Token not working",
      "Not getting webhooks",
      "Token expires soon",
      "Needs attention",
      "Reconnect needed",
      "Also linked to Page Unsub Shop",
      "Token valid until",
      "(estimated)",
      "renews automatically",
      "Token expired Oct",
      "Old token was due to expire",
      "Last comment via Instagram Login:",
      "Never",
      "Couldn't subscribe to the webhook (Unsupported request)",
      "Paste a new token",
      "Renew token",
      "Try again",
      "Disconnect",
    ]) {
      expect(text).toContain(s);
    }
    expect(html).not.toContain("IG_TOKEN");
  });

  it("lastError ที่เก็บเป็นภาษาไทย (ข้อความของระบบ ซ้อนกันได้) แสดงเป็นภาษาอังกฤษ — ข้อความจาก Meta คงเดิม", () => {
    const network = systemMessage("graphUnreachable", { detail: "fetch failed" });
    const pages = [
      page({ id: "P5", name: "Offline Shop", subscribed: false, lastError: network }),
      page({ id: "P6", name: "Status Shop", subscribed: false, lastError: systemMessage("graphHttpStatus", { status: "502" }) }),
    ];
    const html = render(createElement(PagesList, { pages }), "en");
    expectNoThai(html);
    expect(textOf(html)).toContain("Couldn't reach the Graph API: fetch failed");
    expect(textOf(html)).toContain("The Graph API responded with status 502");
    expect(textOf(render(createElement(PagesList, { pages })))).toContain(network);

    const accounts = [
      account({ id: "IG9", username: "retry2.shop", lastError: systemMessage("igRefreshFailed", { detail: network }) }),
      account({
        id: "IG10",
        username: "sub2.shop",
        lastError: systemMessage("igSubscribeFailed", { detail: systemMessage("igSubscribeUnconfirmed") }),
      }),
    ];
    const ig = render(createElement(InstagramAccountsList, { accounts, pages: [] }), "en");
    expectNoThai(ig);
    expect(textOf(ig)).toContain("Couldn't renew the token: Couldn't reach the Graph API: fetch failed — we'll try again every 6 hours.");
    expect(textOf(ig)).toContain("Couldn't subscribe to the webhook (Instagram didn't confirm the webhook subscription)");
  });

  it("ปุ่มจัดการเพจ / บัญชี", () => {
    const html = [
      render(createElement(ResubscribeButton, { pageId: "P1", pageName: "Mali Shop" }), "en"),
      render(createElement(DisconnectButton, { pageId: "P1", pageName: "Mali Shop" }), "en"),
      render(createElement(RefreshInstagramTokenButton, { accountId: "IG1" }), "en"),
      render(createElement(ResubscribeInstagramButton, { accountId: "IG1", username: "north.shop" }), "en"),
      render(createElement(DisconnectInstagramButton, { accountId: "IG1", username: "north.shop" }), "en"),
    ].join("");
    expectNoThai(html);
    expect(textOf(html)).toContain("Renew token");
  });
});

// ---------- Server Actions ----------

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const item of [v].flat()) data.append(k, item);
  return data;
}

describe("ข้อผิดพลาดจาก Server Action ตามภาษาในคุกกี้", () => {
  it("ภาษาอังกฤษ", async () => {
    lang.value = "en";
    expect((await actions.connectAction({ step: "token" }, form({ intent: "fetch", token: " " }))).error).toBe(
      "Please paste your User Access Token.",
    );
    expect((await actions.connectAction({ step: "pick", pages: [] }, form({ intent: "save", userToken: "x" }))).error).toBe(
      "Choose at least 1 Page.",
    );
    expect(await actions.saveMetaAppAction({}, form({ appId: "abc", appSecret: "" }))).toEqual({
      error: "App ID must be numbers only (copy it from App settings → Basic).",
      field: "appId",
    });
    expect((await actions.saveMetaAppAction({}, form({ appId: "1234567890", appSecret: "nope" }))).error).toContain(
      "That App Secret doesn't look right",
    );
    expect((await actions.saveBaseUrlAction({}, form({ baseUrl: "dm.example" }))).error).toBe(
      "Enter the full URL, e.g. https://dm-automation-production.up.railway.app",
    );
    process.env.ADMIN_PASSWORD = "from-railway";
    expect((await actions.changePasswordAction({}, form({ current: "a", next: "b" }))).error).toBe(
      "Your password is set with ADMIN_PASSWORD in Railway — change it there instead.",
    );

    fx.igConfig = { appSecret: null, metaAppSecret: null, fromEnv: true };
    expect((await actions.saveInstagramAppAction({}, form({ igAppSecret: "x" }))).error).toBe(
      "This is set in Railway (INSTAGRAM_APP_SECRET) — change it there.",
    );
    fx.igConfig = { appSecret: null, metaAppSecret: null, fromEnv: false };
    expect((await actions.saveInstagramAppAction({}, form({ igAppSecret: "" }))).error).toBe(
      "Paste the Instagram app secret from the API setup with Instagram login page.",
    );
    expect((await actions.saveInstagramAppAction({}, form({ igAppSecret: "bad secret!" }))).error).toContain(
      "That Instagram app secret doesn't look right",
    );

    // ข้อความจาก lib/instagram/connect.ts (ตรวจ token ก่อนเรียก Meta)
    expect(await actions.connectInstagramAction({}, form({ token: "  " }))).toEqual({
      error: "Paste your Instagram access token first.",
      field: "token",
    });
    expect((await actions.connectInstagramAction({}, form({ token: "EAAG123" }))).error).toContain(
      "This is a Facebook token (it starts with EAA).",
    );
    expect(await actions.connectInstagramAction({}, form({ token: "IGQVJ123" }))).toEqual({
      error: "Enter your Instagram app secret in the Instagram App section first.",
      field: "appSecret",
    });

    // ข้อความจาก lib/meta/graph.ts ที่อยู่ใน {detail}
    expect((await actions.connectAction({ step: "token" }, form({ intent: "fetch", token: "EAAB" }))).error).toBe(
      "Couldn't connect: The App ID / App Secret of your Meta App hasn't been entered yet",
    );
  });

  it("ภาษาไทย (ไม่มีคุกกี้) เหมือนเดิม", async () => {
    expect((await actions.connectAction({ step: "token" }, form({ intent: "fetch", token: "" }))).error).toBe("กรุณาวาง User Access Token");
    expect((await actions.saveMetaAppAction({}, form({ appId: "abc" }))).error).toBe(
      "App ID ต้องเป็นตัวเลขล้วน (คัดลอกจากหน้า App settings → Basic)",
    );
    process.env.ADMIN_PASSWORD = "from-railway";
    expect((await actions.changePasswordAction({}, form({ current: "a", next: "b" }))).error).toBe(
      "รหัสผ่านถูกตั้งผ่าน ADMIN_PASSWORD ใน Railway — เปลี่ยนที่นั่นแทน",
    );
    expect((await actions.connectInstagramAction({}, form({ token: "" }))).error).toBe("วาง access token ของ Instagram ก่อน");
    expect((await actions.connectAction({ step: "token" }, form({ intent: "fetch", token: "EAAB" }))).error).toBe(
      "เชื่อมต่อไม่สำเร็จ: ยังไม่ได้ใส่ App ID / App Secret ของ Meta App",
    );
  });
});

// ---------- ข้อความภาษาไทยจาก lib/instagram/* (หมวด system) ----------

describe("ข้อความจาก lib/instagram/* ในหน้าตั้งค่า (localizeSystemMessage)", () => {
  const en = createT(settingsMessages, "en");
  const th = createT(settingsMessages, "th");

  it("แปลข้อความที่รู้จัก พร้อมคงรายละเอียดจาก Meta ไว้ / ไม่รู้จัก → คงเดิม / ภาษาไทย → คงเดิมเสมอ", () => {
    expect(localizeSystemMessage(`${INSTAGRAM_ERRORS.refreshPrefix}: (#190) Bad token`, "en")).toBe("Couldn't renew the token: (#190) Bad token");
    expect(localizeSystemMessage(`${INSTAGRAM_ERRORS.subscribePrefix} (oops)`, "en")).toBe("Couldn't subscribe to the webhook (oops)");
    expect(localizeSystemMessage("บัญชีนี้ผูกกับเพจ Mali Shop ด้วย — ระบบจะใช้ Instagram Login กับบัญชีนี้แทน", "en")).toBe(
      "This account is also linked to your Page Mali Shop — we'll use Instagram Login for it instead.",
    );
    expect(localizeSystemMessage("(#100) Invalid parameter", "en")).toBe("(#100) Invalid parameter");
    expect(localizeSystemMessage(INSTAGRAM_ERRORS.tokenExpired, "th")).toBe(INSTAGRAM_ERRORS.tokenExpired);
  });

  it("INSTAGRAM_ERRORS ตรงกับข้อความต้นฉบับในหมวด system (หน้าตั้งค่าใช้ prefix แยกสถานะของบัญชี)", () => {
    expect(INSTAGRAM_ERRORS.tokenRejected).toBe(systemMessages.th.igTokenRejected);
    expect(INSTAGRAM_ERRORS.tokenExpired).toBe(systemMessages.th.igTokenExpired);
    expect(systemMessages.th.igRefreshFailed).toBe(`${INSTAGRAM_ERRORS.refreshPrefix}: {detail}`);
    expect(systemMessages.th.igSubscribeFailed).toBe(`${INSTAGRAM_ERRORS.subscribePrefix} ({detail})`);
  });

  it("ข้อความแจ้ง 'ผูกกับเพจ' ขึ้นต้นด้วย igLinkedPrefix ทั้งสองภาษา (ฟอร์มใช้กรองข้อความนี้ออก)", () => {
    const notice = systemMessage("igLinkedNotice", { page: "Mali Shop" });
    for (const t of [en, th]) {
      expect(localizeSystemMessage(notice, t.locale).startsWith(t("igLinkedPrefix", { page: "Mali Shop" }))).toBe(true);
    }
  });
});
