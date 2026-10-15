import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { prerender } from "react-dom/static";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";

/*
 * หน้าก่อนเข้าสู่ระบบ (เข้าสู่ระบบ / ตั้งรหัสผ่านครั้งแรก) มีปุ่มเลือกธีมและภาษาที่มุมขวาบน
 * ใช้คุกกี้เดียวกับในแดชบอร์ด: ธีมที่เลือกไว้แสดงเป็นปุ่มที่ถูกเลือก
 */

const cookieJar = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.values[name] ? { name, value: cookieJar.values[name] } : undefined),
  }),
}));

const { AuthCard } = await import("@/app/login/auth-card");

const ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };

/** หน้านี้มี Server Component แบบ async ซ้อนกันหลายชั้น → ใช้ prerender (รอทุกชั้นเสร็จก่อนคืน HTML) */
async function render(el: ReactElement, locale: Locale): Promise<string> {
  const inner = createElement(I18nProvider, { locale } as ComponentProps<typeof I18nProvider>, el);
  const { prelude } = await prerender(createElement(AppRouterContext.Provider, { value: ROUTER as never }, inner));
  return new Response(prelude).text();
}

async function renderLogin(cookies: Record<string, string>, locale: Locale) {
  cookieJar.values = cookies;
  return render(createElement(AuthCard, { title: "Log in", children: createElement("form") }), locale);
}

afterEach(() => {
  cookieJar.values = {};
});

describe("ปุ่มเลือกธีม + ภาษาในหน้าเข้าสู่ระบบ", () => {
  it("ไทย: มีทั้งปุ่มธีมสีและปุ่มภาษา", async () => {
    const html = await renderLogin({}, "th");
    expect(html).toContain('aria-label="ธีมสี"');
    expect(html).toContain('aria-label="ภาษา / Language"');
    for (const label of ["สว่าง", "มืด", "ตามเครื่อง"]) expect(html).toContain(label);
    expect(html).toContain(">English<");
  });

  it("อังกฤษ + ธีมมืดที่เลือกไว้: ปุ่มมืดถูกเลือก และปุ่ม English ถูกเลือก", async () => {
    const html = await renderLogin({ lang: "en", theme: "dark" }, "en");
    expect(html).toContain('aria-label="Color theme"');
    expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>(?:(?!<\/button>)[\s\S])*Dark/);
    expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>(?:(?!<\/button>)[\s\S])*English/);
  });
});
