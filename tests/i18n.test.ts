import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { AppShell, type ShellData } from "@/app/(dashboard)/app-shell";
import { NAV_GROUPS } from "@/app/(dashboard)/nav-links";
import { NewRuleButton } from "@/app/(dashboard)/rules/template-chooser";
import { LegalPage } from "@/components/legal-page";
import { NavTitle } from "@/components/localized";
import { Field, formatDateTime, formatNumber, formatRelativeTime } from "@/components/ui";
import {
  createT,
  defineMessages,
  formatters,
  interpolate,
  LOCALE_COOKIE,
  parseLocale,
  placeholdersOf,
  type Catalog,
  type Locale,
} from "@/lib/i18n";
import { I18nProvider, useFormat } from "@/lib/i18n/client";
import { navMessages } from "@/lib/i18n/messages/nav";
import { catalogs, mergedCatalog } from "@/lib/i18n/registry";

/*
 * ระบบแปลภาษา: ค่าจากคุกกี้, การแทนค่า {ชื่อ}, คำแปลครบทุกหมวด, และแถบเมนูแสดงภาษาอังกฤษได้จริง
 */

const ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };

function render(
  el: ReactElement,
  { locale, pathname = "/", timeZone }: { locale?: Locale; pathname?: string; timeZone?: string } = {},
): string {
  const inner = createElement(PathnameContext.Provider, { value: pathname }, el);
  return renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      // ไม่ส่ง locale = ไม่มี Provider (เหมือนเทสอื่นๆ ที่ render คอมโพเนนต์เดี่ยวๆ) → ภาษาไทย
      locale ? createElement(I18nProvider, { locale, timeZone } as ComponentProps<typeof I18nProvider>, inner) : inner,
    ),
  );
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

const SHELL: ShellData = {
  setup: { done: 3, total: 6 },
  pages: [{ id: "P1", name: "ร้านมะลิ", igUsername: "mali.shop", hasError: false }],
  instagram: [],
  theme: "system",
};

function shell(locale?: Locale, data: Partial<ShellData> = {}, pathname = "/"): string {
  return render(createElement(AppShell, { data: { ...SHELL, ...data } } as ComponentProps<typeof AppShell>, "เนื้อหา"), { locale, pathname });
}

describe("parseLocale", () => {
  it("รับ en ทุกรูปแบบที่พบบ่อย", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("EN")).toBe("en");
    expect(parseLocale("en-US")).toBe("en");
    expect(parseLocale("en_GB")).toBe("en");
    expect(parseLocale(" en ")).toBe("en");
  });

  it("ค่าอื่นหรือไม่มีคุกกี้ → ไทย", () => {
    expect(parseLocale("th")).toBe("th");
    expect(parseLocale("th-TH")).toBe("th");
    expect(parseLocale(undefined)).toBe("th");
    expect(parseLocale(null)).toBe("th");
    expect(parseLocale("")).toBe("th");
    expect(parseLocale("fr")).toBe("th");
    expect(parseLocale("english")).toBe("th");
  });

  it("ชื่อคุกกี้", () => {
    expect(LOCALE_COOKIE).toBe("lang");
  });
});

describe("การแทนค่า {ชื่อ}", () => {
  const demo = defineMessages({
    th: { waiting: "รอตอบ {count} รายการ", pair: "{a} กับ {b}", plain: "ไม่มีตัวแปร", onlyThai: "เฉพาะไทย" },
    en: { waiting: "{count} waiting", pair: "{a} and {b}", plain: "No variables", onlyThai: "" },
  });

  it("แทนค่าและใส่ตัวคั่นหลักพันให้ตัวเลขตามภาษา", () => {
    expect(createT(demo, "th")("waiting", { count: 1200 })).toBe("รอตอบ 1,200 รายการ");
    expect(createT(demo, "en")("waiting", { count: 1200 })).toBe("1,200 waiting");
    // ส่งเป็น string = ไม่จัดรูปแบบ
    expect(createT(demo, "en")("waiting", { count: "1200" })).toBe("1200 waiting");
  });

  it("หลายตัวแปร / ไม่มีตัวแปร / ลืมส่งค่า (คงไว้ให้เห็น)", () => {
    const t = createT(demo, "en");
    expect(t("pair", { a: "DM", b: "comments" })).toBe("DM and comments");
    expect(t("plain")).toBe("No variables");
    expect(t("pair", { a: "DM" })).toBe("DM and {b}");
    expect(interpolate("{x}{x}", { x: "ab" })).toBe("abab");
    // ค่าเป็นชื่อ property ของ Object ทั่วไป ต้องไม่หลุดไปอ่านของ prototype
    expect(interpolate("{toString}", {})).toBe("{toString}");
  });

  it("ค่าที่ใส่ไม่ถูกตีความเป็นตัวแปรซ้ำ", () => {
    expect(interpolate("สวัสดี {name}", { name: "{count}", count: 5 })).toBe("สวัสดี {count}");
  });

  it("ไม่มีคำแปล → ใช้ภาษาไทย → ไม่มีเลย → แสดง key", () => {
    // en ว่างก็ยังเป็นคำแปล (ตั้งใจให้ว่างได้) — ทดสอบกรณีไม่มี key จริงๆ ด้วย catalog ที่สร้างเอง
    const partial = { th: { a: "ก" }, en: {} } as unknown as Catalog<{ a: string }>;
    expect(createT(partial, "en")("a")).toBe("ก");
    expect((createT(partial, "en") as (k: string) => string)("missing")).toBe("missing");
  });

  it("t.rich ใส่ element ได้ และ t.locale บอกภาษา", () => {
    const t = createT(demo, "en");
    const node: ReactNode = t.rich("pair", { a: createElement("b", null, "DM"), b: 3 });
    expect(isValidElement(node)).toBe(true);
    expect(renderToStaticMarkup(createElement("p", null, node))).toBe("<p><b>DM</b> and 3</p>");
    expect(t.locale).toBe("en");
  });

  it("ได้ฟังก์ชันตัวเดิมทุกครั้ง (ใช้เป็น dependency ของ hook ได้)", () => {
    expect(createT(demo, "en")).toBe(createT(demo, "en"));
    expect(createT(demo, "en")).not.toBe(createT(demo, "th"));
  });

  it("placeholdersOf", () => {
    expect(placeholdersOf("รอ {count} จาก {total}")).toEqual(["count", "total"]);
    expect(placeholdersOf("ไม่มี")).toEqual([]);
  });
});

describe("คำแปลครบทุกหมวด", () => {
  const entries = Object.entries(catalogs) as [string, Catalog][];

  it("มีหมวดหลักครบ", () => {
    expect(Object.keys(catalogs)).toEqual(expect.arrayContaining(["common", "nav", "shell", "appearance", "auth", "rules", "inbox"]));
  });

  it.each(entries)("%s: en มี key เดียวกับ th ทุกตัว", (_ns, catalog) => {
    expect(Object.keys(catalog.en).sort()).toEqual(Object.keys(catalog.th).sort());
  });

  it.each(entries)("%s: ทุกข้อความไม่ว่าง และใช้ {ตัวแปร} ชุดเดียวกันทั้งสองภาษา", (_ns, catalog) => {
    for (const [key, th] of Object.entries(catalog.th)) {
      const en = catalog.en[key];
      expect(th.trim(), `th.${key}`).not.toBe("");
      expect(en.trim(), `en.${key}`).not.toBe("");
      expect(placeholdersOf(en).sort(), `{ตัวแปร} ของ ${key}`).toEqual(placeholdersOf(th).sort());
    }
  });

  it.each(entries)("%s: ข้อความภาษาอังกฤษไม่มีตัวอักษรไทยหลงอยู่ (ยกเว้นชื่อภาษา “ไทย” / ภาษา)", (_ns, catalog) => {
    for (const [key, en] of Object.entries(catalog.en)) {
      const stripped = en.replace(/ภาษา|ไทย/g, "");
      expect(/[฀-๿]/.test(stripped), `en.${key}: ${en}`).toBe(false);
    }
  });

  it("รวมทุกหมวดเป็น key แบบเต็ม", () => {
    const merged = mergedCatalog();
    expect(merged.en["nav.dashboard"]).toBe("Dashboard");
    expect(merged.th["nav.dashboard"]).toBe("ภาพรวม");
    expect(createT(merged, "en")("rules.newAutomation")).toBe("New Automation");
  });

  it("ชื่อเมนูภาษาอังกฤษตามที่เจ้าของร้านกำหนด", () => {
    const t = createT(navMessages, "en");
    expect([t("dashboard"), t("automation"), t("contacts"), t("activity"), t("inbox")]).toEqual([
      "Dashboard",
      "Automation",
      "Contacts",
      "Activity",
      "Inbox",
    ]);
  });
});

describe("การจัดรูปแบบตามภาษา", () => {
  const d = new Date("2026-10-13T07:05:00Z"); // 14:05 เวลาไทย

  it("ไม่ส่งภาษา = ไทยเหมือนเดิม (โค้ดเดิมไม่ต้องแก้)", () => {
    expect(formatDateTime(d)).toBe(formatDateTime(d, "th"));
    expect(formatDateTime(d)).toContain("ต.ค.");
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatRelativeTime(new Date(d.getTime() - 10_000), d)).toBe("เมื่อสักครู่");
    expect(formatDateTime(null)).toBe("–");
  });

  it("อังกฤษใช้ en-US", () => {
    expect(formatDateTime(d, "en")).toBe("Oct 13, 2:05 PM");
    expect(formatRelativeTime(new Date(d.getTime() - 10_000), d, "en")).toBe("just now");
    expect(formatRelativeTime(new Date(d.getTime() - 5 * 60_000), d, "en")).toBe("5 minutes ago");
    expect(formatRelativeTime(new Date(d.getTime() - 86_400_000), d, "en")).toBe("yesterday");
    expect(formatters("en").date("2026-10-01T00:00:00Z", { day: "numeric", month: "short", timeZone: "UTC" })).toBe("Oct 1");
    expect(formatters("en").list(["DMs", "clicks"])).toBe("DMs and clicks");
    expect(formatters("th").list(["DM", "คลิก"])).toBe("DM และ คลิก");
  });

  it("Client Component ใช้เขตเวลาที่เซิร์ฟเวอร์ส่งมาใน I18nProvider (เบราว์เซอร์อ่าน APP_TIMEZONE เองไม่ได้ → ไม่งั้น hydration ไม่ตรง)", () => {
    function When() {
      return createElement("time", null, useFormat().dateTime(d));
    }
    // root layout ส่ง env.timezone มา → ได้ผลเดียวกับ formatters() ฝั่งเซิร์ฟเวอร์ที่ตั้งเขตเวลาเดียวกัน
    expect(textOf(render(createElement(When), { locale: "en", timeZone: "UTC" })).trim()).toBe("Oct 13, 7:05 AM");
    expect(formatters("en", "UTC").dateTime(d)).toBe("Oct 13, 7:05 AM");
    // ไม่ระบุ = เขตเวลาเริ่มต้น (กรุงเทพฯ)
    expect(textOf(render(createElement(When), { locale: "en" })).trim()).toBe("Oct 13, 2:05 PM");
    expect(textOf(render(createElement(When))).trim()).toBe(formatDateTime(d));
  });

  it("<Field optional> แปลตามภาษา", () => {
    const field = createElement(Field, { label: "Note", optional: true } as ComponentProps<typeof Field>, createElement("input"));
    expect(textOf(render(field))).toContain("(ไม่บังคับ)");
    expect(textOf(render(field, { locale: "en" }))).toContain("(optional)");
  });
});

describe("แถบเมนูสองภาษา", () => {
  it("ค่าเริ่มต้น (ไม่มี Provider / ไทย) ยังเป็นภาษาไทย", () => {
    for (const html of [shell(), shell("th")]) {
      const text = textOf(html);
      for (const label of ["ภาพรวม", "กฎอัตโนมัติ", "รายชื่อลูกค้า", "ข้อความรอตอบ", "กิจกรรม", "คู่มือตั้งค่า", "ตั้งค่า", "ออกจากระบบ", "ธีม", "ภาษา"]) {
        expect(text).toContain(label);
      }
      expect(text).not.toContain("Dashboard");
    }
  });

  it("locale en → ชื่อเมนูและปุ่มเป็นภาษาอังกฤษ", () => {
    const text = textOf(shell("en"));
    for (const label of ["Dashboard", "Automation", "Contacts", "Inbox", "Activity", "Setup guide", "Settings", "Log out", "Theme", "Language", "Finish setup"]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("Steps left: 3");
    // ชื่อภาษาบนปุ่มเลือกภาษาเขียนเป็นภาษาของตัวเองเสมอ
    expect(text).toContain("ไทย");
    expect(text).toContain("English");
    for (const thai of ["ภาพรวม", "กฎอัตโนมัติ", "รายชื่อลูกค้า", "กิจกรรม", "ออกจากระบบ", "ตั้งค่าให้เสร็จ"]) {
      expect(text).not.toContain(thai);
    }
  });

  it("เมนู Inbox อยู่ต่อจาก Contacts และลิงก์ไป /inbox", () => {
    const html = shell("en");
    const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    const order = ["Dashboard", "Automation", "Contacts", "Inbox", "Activity"].map((l) => nav.indexOf(`>${l}<`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(nav).toContain('href="/inbox"');
  });

  it("ตัวเลขข้อความรอตอบ: 0 ไม่แสดง, มี → แสดง, เกิน 99 → 99+", () => {
    const badge = (n: number | undefined, locale: Locale = "en") => {
      const html = shell(locale, { inboxCount: n });
      const start = html.indexOf('href="/inbox"');
      return textOf(html.slice(start, html.indexOf("</a>", start)));
    };
    expect(badge(undefined)).not.toMatch(/\d/);
    expect(badge(0)).not.toMatch(/\d/);
    expect(badge(7)).toContain("7");
    expect(badge(7)).toContain("Waiting for a reply: 7");
    expect(badge(1500)).toContain("99+");
    expect(badge(1500, "th")).toContain("รอตอบ 1,500 รายการ");
  });

  it("หัวข้อบนมือถือเป็นชื่อเมนูของหน้าปัจจุบันตามภาษา", () => {
    const html = shell("en", {}, "/contacts");
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(textOf(header)).toContain("Contacts");
    expect(textOf(header)).toContain("Setup 3/6");
  });

  it("ชื่อหน้า (NavTitle) ตรงกับชื่อเมนูทุกหน้า ทั้งสองภาษา", () => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        const title = (locale?: Locale) => textOf(render(createElement(NavTitle, { name: item.label }), { locale })).trim();
        expect(title("en")).toBe(createT(navMessages, "en")(item.label));
        expect(title()).toBe(createT(navMessages, "th")(item.label));
      }
    }
  });

  it("ปุ่ม New Automation", () => {
    expect(textOf(render(createElement(NewRuleButton), { locale: "en" }))).toContain("New Automation");
    expect(textOf(render(createElement(NewRuleButton)))).toContain("สร้างกฎใหม่");
    // ส่งข้อความเองยังใช้ข้อความนั้น
    expect(textOf(render(createElement(NewRuleButton, null, "Create"), { locale: "en" }))).toContain("Create");
  });
});

describe("หน้าเอกสาร (นโยบาย / การลบข้อมูล) ตามภาษา — ทั้งหน้าตรวจละเอียดใน legal-i18n.test.ts", () => {
  const page = (locale?: Locale) =>
    render(
      createElement(LegalPage, { title: "Privacy Policy", subtitle: "Privacy Policy", locale } as ComponentProps<typeof LegalPage>, "Content"),
      { locale },
    );

  it("ไม่ส่งภาษา = ไทย พร้อมชื่ออังกฤษเหนือหัวข้อ (lang=en ให้โปรแกรมอ่านหน้าจออ่านถูกสำเนียง)", () => {
    const html = page();
    expect(html).toMatch(/^<div lang="th"/);
    expect(html).toContain('<p lang="en"');
    expect(textOf(html)).toContain("กลับหน้าหลัก");
  });

  it("ภาษาอังกฤษ: lang=en ไม่มีชื่อซ้ำเหนือหัวข้อ และเมนูเอกสารเป็นภาษาอังกฤษ", () => {
    const html = page("en");
    expect(html).toMatch(/^<div lang="en"/);
    expect(html).not.toContain('<p lang="en"');
    expect(textOf(html)).toContain("Back to home");
    expect(textOf(html)).toContain("Data Deletion");
    expect(html).toContain('aria-label="Related documents"');
  });
});

// ---------- Client Component ห้ามดึงข้อความทุกหมวด / โค้ดฝั่งเซิร์ฟเวอร์ ----------

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("ขอบเขต Server / Client", () => {
  it('ไฟล์ "use client" ไม่ import i18n/registry หรือ i18n/server', () => {
    const root = path.resolve(import.meta.dirname, "../src");
    const offenders = sourceFiles(root).filter((file) => {
      const src = readFileSync(file, "utf8");
      return /^\s*["']use client["']/.test(src) && /from\s+["'](@\/lib\/i18n|\.)\/(registry|server)["']/.test(src);
    });
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });
});
