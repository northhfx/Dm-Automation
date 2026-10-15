import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";

/*
 * หน้านโยบายความเป็นส่วนตัว / การลบข้อมูล (สาธารณะ — ผู้ตรวจของ Meta เปิดอ่าน) ตามคุกกี้ภาษา
 * - ภาษาอังกฤษ: ไม่มีตัวอักษรไทยหลง (ยกเว้นชื่อภาษา "ไทย" ในปุ่มเลือกภาษา ซึ่งเขียนเป็นภาษาของตัวเองเสมอ)
 * - ไม่มีคุกกี้ = ภาษาไทยเหมือนเดิม (ข้อความครบทุกประโยค)
 */

const lang = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "lang" && lang.value ? { name, value: lang.value } : undefined) }),
}));

const privacy = await import("@/app/privacy/page");
const deletion = await import("@/app/data-deletion/page");

const ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };
const THAI = /[฀-๿]/;

function render(el: ReactElement, locale?: Locale): string {
  // root layout ห่อทั้งแอปด้วย I18nProvider ตามคุกกี้ (ปุ่มเลือกภาษาอ่านภาษาจากตรงนี้)
  const inner = locale ? createElement(I18nProvider, { locale } as ComponentProps<typeof I18nProvider>, el) : el;
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, inner));
}

/** ชื่อร้าน / อีเมลติดต่อ (ไม่ส่ง = ไม่ได้ตั้งทั้งคู่) */
function setContact(env: { BUSINESS_NAME?: string; CONTACT_EMAIL?: string } = {}) {
  delete process.env.BUSINESS_NAME;
  delete process.env.CONTACT_EMAIL;
  Object.assign(process.env, env);
}

/** เรนเดอร์ทั้งหน้าเหมือนคำขอจริงที่มีคุกกี้ lang (ไม่ส่ง = ไม่มีคุกกี้) */
async function renderPage(page: { default: () => Promise<ReactElement> }, locale?: Locale, env: Record<string, string> = {}) {
  lang.value = locale;
  setContact(env);
  return render(await page.default(), locale);
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** ตัดปุ่มเลือกภาษาออก (ชื่อภาษาเขียนเป็นภาษาของตัวเองเสมอ: "ไทย | English", ป้าย "Language / ภาษา") */
function withoutLanguageToggle(html: string): string {
  return html.replace(/<div role="radiogroup"[\s\S]*?<\/div>/, "");
}

/** ไม่มีตัวอักษรไทยหลงในข้อความหรือแอตทริบิวต์ */
function expectNoThai(html: string) {
  const rest = withoutLanguageToggle(html);
  expect(textOf(rest).match(new RegExp(`.{0,40}${THAI.source}.{0,40}`))?.[0] ?? null).toBeNull();
  expect(rest).not.toMatch(THAI);
}

afterEach(() => {
  lang.value = undefined;
  setContact();
});

const WITH_CONTACT = { BUSINESS_NAME: "Mali Shop", CONTACT_EMAIL: "hello@mali.example" };

describe("หน้านโยบายความเป็นส่วนตัว (/privacy)", () => {
  it("ภาษาอังกฤษ: ไม่มีภาษาไทยหลง ทั้งตอนตั้งและไม่ได้ตั้งชื่อร้าน/อีเมล", async () => {
    for (const env of [{}, WITH_CONTACT]) expectNoThai(await renderPage(privacy, "en", env));
  });

  it("ภาษาอังกฤษ: เนื้อหาครบทุกหัวข้อ + ลิงก์ไปหน้าการลบข้อมูล + อีเมล", async () => {
    const html = await renderPage(privacy, "en", WITH_CONTACT);
    const text = textOf(html);
    for (const s of [
      "Back to home",
      "Privacy Policy",
      'Mali Shop ("we") uses this system to automatically reply to comments and messages on our Facebook and Instagram accounts. This policy explains how we collect and use your information.',
      "Information we collect",
      "Your name, username, and user ID, which Facebook/Instagram share with us when you comment on or send a message to our Page",
      "The comments and chat messages you send to our Page",
      "Clicks on the links we send you (how many times and when)",
      "How we use your information",
      "To reply to your comments and send you the information you ask for by message",
      "To review overall statistics, such as the number of messages sent and click rates, so we can improve our service",
      "We do not sell or disclose your information to third parties, except to service providers that the system needs in order to work (such as our server provider).",
      "Data retention and deletion",
      "You can ask us to delete your information by following the steps on our Data Deletion page .",
      "Contact us",
      "Send a message to our Page directly, or email hello@mali.example .",
      "Data Deletion",
    ]) {
      expect(text, s).toContain(s);
    }
    expect(html).toMatch(/^<div lang="en"/);
    expect(html).toContain('href="/data-deletion"');
    expect(html).toContain('href="mailto:hello@mali.example"');
    expect(html).toContain('aria-label="Related documents"');
    // หัวข้อเป็นภาษาอังกฤษอยู่แล้ว → ไม่ต้องมีชื่ออังกฤษซ้ำเหนือหัวข้อ
    expect(html).not.toContain('<p lang="en"');

    const plain = textOf(await renderPage(privacy, "en"));
    expect(plain).toContain('The operator of this Page ("we") uses this system');
    expect(plain).toContain("Send a message to our Page directly.");
    expect(plain).not.toContain("email");
  });

  it("ไม่มีคุกกี้ = ภาษาไทยเหมือนเดิม พร้อมชื่ออังกฤษเหนือหัวข้อให้ผู้ตรวจของ Meta", async () => {
    const html = await renderPage(privacy, undefined, WITH_CONTACT);
    const text = textOf(html);
    for (const s of [
      "กลับหน้าหลัก",
      "นโยบายความเป็นส่วนตัว",
      'Mali Shop ("เรา") ใช้ระบบนี้เพื่อตอบคอมเมนต์และข้อความบน Facebook และ Instagram ของเราโดยอัตโนมัติ นโยบายนี้อธิบายว่าเราเก็บและใช้ข้อมูลของคุณอย่างไร',
      "ชื่อ, ชื่อผู้ใช้ และรหัสผู้ใช้ที่ Facebook/Instagram ส่งให้เรา เมื่อคุณคอมเมนต์หรือส่งข้อความถึงเพจ",
      "เราไม่ขายหรือเปิดเผยข้อมูลของคุณให้บุคคลภายนอก นอกจากผู้ให้บริการที่จำเป็นต่อการทำงานของระบบ (เช่น ผู้ให้บริการเซิร์ฟเวอร์)",
      "คุณสามารถขอลบข้อมูลได้ตามขั้นตอนใน หน้าการลบข้อมูล",
      "ส่งข้อความหาเพจของเราโดยตรง หรืออีเมล hello@mali.example",
      "การลบข้อมูล",
    ]) {
      expect(text, s).toContain(s);
    }
    expect(html).toMatch(/^<div lang="th"/);
    expect(html).toContain('<p lang="en" class="text-xs font-semibold tracking-wide text-accent uppercase">Privacy Policy</p>');
    expect(textOf(await renderPage(privacy, "th"))).toContain('ผู้ให้บริการเพจ ("เรา") ใช้ระบบนี้');
  });

  it("ชื่อแท็บตามภาษา", async () => {
    lang.value = "en";
    expect(await privacy.generateMetadata()).toEqual({ title: "Privacy Policy" });
    lang.value = undefined;
    expect(await privacy.generateMetadata()).toEqual({ title: "นโยบายความเป็นส่วนตัว" });
  });
});

describe("หน้าการลบข้อมูล (/data-deletion)", () => {
  it("ภาษาอังกฤษ: ไม่มีภาษาไทยหลง และเนื้อหาครบ", async () => {
    for (const env of [{}, WITH_CONTACT]) expectNoThai(await renderPage(deletion, "en", env));
    const html = await renderPage(deletion, "en", WITH_CONTACT);
    const text = textOf(html);
    for (const s of [
      "Data Deletion Instructions",
      "How to request deletion",
      "If you want us to delete your information that we received through Facebook or Instagram, you can:",
      'Send our Page a message saying "Delete my data" , along with your account name.',
      "Or email us at hello@mali.example .",
      "What we delete",
      "We will delete your name, user ID, message history, and link-click data from our system within 30 days, and let you know once it's done.",
      "Remove the app's access yourself",
      "You can also remove the app's access yourself on Facebook: Settings → Apps and websites → Select this app → Remove",
      "Privacy Policy",
    ]) {
      expect(text, s).toContain(s);
    }
    expect(html).toContain("<strong>Settings</strong>");
    expect(textOf(await renderPage(deletion, "en"))).not.toContain("Or email us");
  });

  it("ไม่มีคุกกี้ = ภาษาไทยเหมือนเดิม", async () => {
    const html = await renderPage(deletion, undefined, WITH_CONTACT);
    const text = textOf(html);
    for (const s of [
      "การขอลบข้อมูล",
      "วิธีขอลบข้อมูล",
      "หากต้องการให้เราลบข้อมูลของคุณที่ได้รับผ่าน Facebook หรือ Instagram ทำได้ดังนี้",
      'ส่งข้อความถึงเพจของเราว่า "ขอลบข้อมูล" พร้อมชื่อบัญชีของคุณ',
      "หรือส่งอีเมลมาที่ hello@mali.example",
      "เราจะลบชื่อ รหัสผู้ใช้ ประวัติข้อความ และข้อมูลการคลิกลิงก์ของคุณออกจากระบบภายใน 30 วัน และแจ้งกลับเมื่อดำเนินการเสร็จ",
      "คุณยังสามารถถอนสิทธิ์การเข้าถึงของแอปได้เองที่ Facebook: การตั้งค่า → แอปและเว็บไซต์ → เลือกแอปนี้ → ลบ",
    ]) {
      expect(text, s).toContain(s);
    }
    expect(html).toContain('<p lang="en" class="text-xs font-semibold tracking-wide text-accent uppercase">Data Deletion Instructions</p>');
  });

  it("ชื่อแท็บตามภาษา", async () => {
    lang.value = "en";
    expect(await deletion.generateMetadata()).toEqual({ title: "User Data Deletion" });
    lang.value = undefined;
    expect(await deletion.generateMetadata()).toEqual({ title: "การลบข้อมูลผู้ใช้" });
  });
});

describe("ปุ่มเลือกภาษาที่หัวหน้า (ผู้ตรวจที่เปิดลิงก์มาครั้งแรกได้หน้าไทย กดเปลี่ยนเป็น English ได้เอง)", () => {
  it("มีทั้งสองหน้า ทั้งสองภาษา และเลือกภาษาปัจจุบันไว้", async () => {
    for (const page of [privacy, deletion]) {
      const th = await renderPage(page);
      expect(th).toContain('role="radiogroup"');
      expect(th).toMatch(/aria-checked="true"[^>]*><span class="truncate"><span lang="th">ไทย<\/span>/);
      const en = await renderPage(page, "en");
      expect(en).toMatch(/aria-checked="true"[^>]*><span class="truncate"><span lang="en">English<\/span>/);
    }
  });
});
