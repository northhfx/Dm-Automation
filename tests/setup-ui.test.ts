import { describe, expect, it } from "vitest";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { SetupStatus } from "@/lib/config";
import { INSTAGRAM_MESSAGE_ACCESS_MENU } from "@/lib/meta/setup-info";
import {
  INSTAGRAM_ERRORS,
  instagramAccountHealth,
  instagramHealthLevel,
  type InstagramAccount,
} from "@/lib/instagram/accounts";
import { failureSummary } from "@/app/(dashboard)/activity/failure-summary";
import { AppShell, type ShellData } from "@/app/(dashboard)/app-shell";
import type { TimelineEvent } from "@/app/(dashboard)/activity/load-events";
import { errorHint, TimelineItem, TimelineItemCompact } from "@/app/(dashboard)/activity/timeline";
import { GuideView } from "@/app/(dashboard)/guide/guide-view";
import { instagramStepStatus } from "@/app/(dashboard)/guide/instagram-step";
import { openStepFromHash } from "@/app/(dashboard)/guide/open-step-from-hash";
import { InstagramConnectForm } from "@/app/(dashboard)/settings/instagram-connect-form";
import { InstagramAccountsList, instagramNeedsAttention } from "@/app/(dashboard)/settings/instagram-list";
import { createInitialState } from "@/app/(dashboard)/rules/builder/model";
import { TriggerNode } from "@/app/(dashboard)/rules/builder/nodes";
import { ruleTemplate } from "@/app/(dashboard)/rules/templates";

/*
 * หน้าตั้งค่า / คู่มือ / กิจกรรม ที่เจ้าของร้านใช้แก้ปัญหาเอง (render เป็น HTML แล้วตรวจข้อความ — ไม่ใช้ฐานข้อมูล)
 */

const DAY = 24 * 60 * 60_000;
const ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };

function render(el: ReactElement, pathname = "/settings"): string {
  return renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      createElement(PathnameContext.Provider, { value: pathname }, el),
    ),
  );
}

/** ข้อความล้วน (ตัดแท็ก HTML) */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}

function account(o: Partial<InstagramAccount> = {}): InstagramAccount {
  const now = Date.now();
  return {
    id: "IG1",
    appScopedId: "APPSCOPED1",
    username: "northh.fx",
    name: "North FX",
    accountType: "Business",
    token: "IG_TOKEN",
    tokenExpiresAt: new Date(now + 50 * DAY),
    tokenExpiryEstimated: false,
    tokenRefreshedAt: new Date(now - 10 * DAY),
    tokenCheckedAt: null,
    subscribed: true,
    lastError: null,
    lastCommentWebhookAt: null,
    lastMessagingWebhookAt: null,
    connectedAt: new Date(now - 10 * DAY),
    ...o,
  };
}

function status(o: { igSubscribed?: number; igAccounts?: number; igWebhookVerified?: boolean } = {}): SetupStatus {
  return {
    baseUrl: "https://dm.example.com",
    meta: { appId: "1234567890", appSecret: "secret", verifyToken: "verify", fromEnv: false },
    webhookVerifiedAt: new Date().toISOString(),
    pagesConnected: 1,
    pagesSubscribed: 1,
    lastWebhookAt: new Date(),
    badSignatureAt: null,
    ruleCount: 1,
    appReviewDone: false,
    instagram: {
      appSecretSet: false,
      fromEnv: false,
      accounts: o.igAccounts ?? 0,
      subscribed: o.igSubscribed ?? 0,
      webhookVerifiedAt: o.igWebhookVerified ? new Date().toISOString() : null,
      lastWebhookAt: null,
      badSignatureAt: null,
      tokenWarning: null,
    },
  };
}

function guide(igAccounts: InstagramAccount[], s: SetupStatus = status()): string {
  return render(createElement(GuideView, { status: s, pages: [], igAccounts, igHasMetaAppSecret: false }));
}

/** การ์ดของขั้นที่ n เปิดอยู่ไหม (ขั้นที่เสร็จแล้วจะพับไว้) */
function stepOpen(html: string, n: number): boolean {
  const m = new RegExp(`<li id="step-${n}"[^>]*><details( open="")?`).exec(html);
  if (!m) throw new Error(`ไม่พบการ์ดขั้นที่ ${n}`);
  return Boolean(m[1]);
}

/** ส่วนหัวของการ์ดขั้นที่ n (ป้าย + ชื่อ + สรุป) */
function stepSummary(html: string, n: number): string {
  const start = html.indexOf(`<li id="step-${n}"`);
  const end = html.indexOf("</summary>", start);
  return textOf(html.slice(start, end));
}

describe("คู่มือขั้นที่ 5: ติ๊กเสร็จเฉพาะเมื่อมีบัญชีที่ใช้งานได้จริง", () => {
  it("token หมดอายุแล้ว (แม้ยัง subscribed) → ไม่ติ๊กเสร็จ การ์ดเปิดอยู่ และบอกให้วาง token ใหม่ในข้อ 7", () => {
    const expiredAt = new Date(Date.now() - 2 * DAY);
    // สถานะรวมบอกว่า subscribe อยู่ แต่คู่มือต้องดูที่ token ของบัญชีเอง
    const html = guide([account({ tokenExpiresAt: expiredAt })], status({ igAccounts: 1, igSubscribed: 1 }));
    const summary = stepSummary(html, 5);
    expect(summary).not.toContain("เสร็จแล้ว");
    expect(summary).not.toContain("token ใช้ได้ถึง");
    expect(summary).toContain("หมดอายุเมื่อ");
    expect(summary).toContain("วาง token ใหม่ในข้อ 7");
    expect(stepOpen(html, 5)).toBe(true);
  });

  it("Meta ไม่รับ token แล้ว → ไม่ติ๊กเสร็จ", () => {
    const html = guide([account({ lastError: INSTAGRAM_ERRORS.tokenRejected })], status({ igAccounts: 1 }));
    expect(stepSummary(html, 5)).toContain("ใช้ไม่ได้แล้ว — วาง token ใหม่ในข้อ 7");
    expect(stepOpen(html, 5)).toBe(true);
  });

  it("บัญชีใช้งานได้ → ติ๊กเสร็จ และบอกว่าวันหมดอายุเป็นค่าประมาณ (ถ้าประมาณเอา)", () => {
    const html = guide([account({ tokenExpiryEstimated: true })], status({ igAccounts: 1, igSubscribed: 1, igWebhookVerified: true }));
    const summary = stepSummary(html, 5);
    expect(summary).toContain("เสร็จแล้ว");
    expect(summary).toMatch(/@northh\.fx \(token ใช้ได้ถึง .+ \(โดยประมาณ\)\)/);
    expect(stepOpen(html, 5)).toBe(false);
  });

  it("วาง token แล้วแต่ Meta ยังไม่ยืนยัน Webhook ของ Instagram → การ์ดยังเปิด และชี้ไปข้อ 8", () => {
    const html = guide([account()], status({ igAccounts: 1, igSubscribed: 1 }));
    const summary = stepSummary(html, 5);
    expect(summary).not.toContain("เสร็จแล้ว");
    expect(summary).toContain("ข้อ 8");
    expect(stepOpen(html, 5)).toBe(true);
  });

  it("instagramStepStatus: เรียงความสำคัญ ใช้ได้ → token ตาย → ยังไม่รับ webhook → ยังไม่เชื่อม", () => {
    const now = new Date();
    expect(instagramStepStatus([], now).done).toBe(false);
    expect(instagramStepStatus([account({ subscribed: false })], now)).toMatchObject({ done: false });
    expect(instagramStepStatus([account({ subscribed: false })], now).summary).toContain("ยังไม่รับ webhook");
    expect(instagramStepStatus([account({ token: null })], now).summary).toContain("ใช้ไม่ได้แล้ว");
    // ต่ออายุไม่สำเร็จชั่วคราว: token ยังใช้ได้ → ยังนับว่าเสร็จ
    expect(instagramStepStatus([account({ lastError: `${INSTAGRAM_ERRORS.refreshPrefix}: 500` })], now).done).toBe(true);
    const both = instagramStepStatus([account({ tokenExpiresAt: new Date(now.getTime() - DAY) }), account({ id: "IG2", username: "ok.shop" })], now);
    expect(both.done).toBe(true);
    expect(both.summary).toContain("@ok.shop");
    expect(both.summary).not.toContain("@northh.fx");
  });

  it("instagramStepStatus: เชื่อม token แล้วแต่ Meta ยังไม่ยืนยัน Webhook → ยังไม่เสร็จ และชี้ไปข้อ 8", () => {
    const now = new Date();
    const pending = instagramStepStatus([account()], now, false);
    expect(pending.done).toBe(false);
    expect(pending.summary).toContain("ข้อ 8");
    expect(instagramStepStatus([account()], now, true).done).toBe(true);
  });
});

describe("คู่มือขั้นที่ 5: secret ของแอปแยกต้องกรอกครบ", () => {
  it("ช่อง App secret (App settings → Basic) แสดงเลย ไม่พับ ไม่บอกว่าไม่บังคับ และต้องกรอก", () => {
    const html = guide([]);
    expect(html).toMatch(/<input[^>]*id="igMetaAppSecret"[^>]*required=""/);
    expect(html).not.toContain("สร้างแอปแยกสำหรับ Instagram?");
    const text = textOf(html);
    expect(text).toContain("App secret ของแอป Instagram (App settings → Basic)");
    expect(text).not.toMatch(/App secret ของแอป Instagram \(App settings → Basic\)\s*\(ไม่บังคับ\)/);
    // ข้อ 4 บอกว่าค่าที่สองเอามาจากไหน
    expect(text).toContain("ช่องที่สอง: เมนูซ้าย App settings → Basic → ช่อง App secret → กด Show → คัดลอก");
  });

  it("ข้อ 2 บอกให้อัปโหลด App icon (ไม่งั้นเปิด Live ไม่ได้) และข้อ 11 ชี้กลับมาครบ", () => {
    const text = textOf(guide([]));
    expect(text).toContain("อัปโหลด App icon");
    expect(text).toMatch(/ถ้ากดไม่ได้ ตรวจข้อ 2 ว่ากรอกครบ \([^)]*App icon/);
  });

  it("มีจุดลิงก์ตรงไปข้อ 7 (วาง token) และข้อ 8 (webhook)", () => {
    const html = guide([]);
    expect(html).toMatch(/<li value="7" id="step-5-token"/);
    expect(html).toMatch(/<li value="8" id="step-5-webhook"/);
  });

  it("ขั้นที่ 7 บอกว่าก่อน App Review จำกัดเฉพาะเพจ Facebook (Instagram Login ไม่ต้องยื่น)", () => {
    const text = textOf(guide([]));
    expect(text).not.toContain("ก่อนผ่าน App Review ระบบยังตอบได้เฉพาะ");
    expect(text).toContain("ก่อนผ่าน App Review เพจ Facebook ยังตอบได้เฉพาะบัญชีที่มีชื่อในแอป");
    expect(text).toContain("Instagram ที่เชื่อมผ่าน Instagram Login ในขั้นที่ 5 ไม่ต้องรอ App Review");
  });

  it("เมนูเปิด 'อนุญาตการเข้าถึงข้อความ' ในคู่มือตรงกับคำอธิบาย error 2534041 ในหน้ากิจกรรม", () => {
    const path = INSTAGRAM_MESSAGE_ACCESS_MENU.join(" → ");
    expect(path).toBe("โปรไฟล์ → ☰ → การตั้งค่าและกิจกรรม → ข้อความและการตอบกลับสตอรี่ → การควบคุมข้อความ → เครื่องมือที่เชื่อมต่อ");
    expect(textOf(guide([]))).toContain(`${path} → เปิด อนุญาตการเข้าถึงข้อความ`);
    expect(errorHint("100 / 2534041")).toContain(`${path} → อนุญาตการเข้าถึงข้อความ`);
  });
});

describe("ลิงก์ไปคู่มือเปิดตรงจุดที่ต้องทำ", () => {
  it("ฟอร์มวาง token (หน้าตั้งค่า) ลิงก์ไปข้อ 7 ของขั้นที่ 5", () => {
    const html = render(createElement(InstagramConnectForm, { hasAppSecret: true }));
    expect(html).toContain('href="/guide#step-5-token"');
  });

  it("openStepFromHash เปิด <details> ที่ครอบจุดนั้นอยู่ (การ์ดที่พับไว้เพราะเสร็จแล้ว)", () => {
    class El {
      open = false;
      children: El[] = [];
      constructor(
        readonly tag: string,
        readonly id: string | null = null,
        readonly parentElement: El | null = null,
      ) {
        parentElement?.children.push(this);
      }
      querySelector(sel: string): El | null {
        for (const c of this.children) {
          if (c.tag === sel) return c;
          const found = c.querySelector(sel);
          if (found) return found;
        }
        return null;
      }
      closest(sel: string): El | null {
        return this.tag === sel ? this : (this.parentElement?.closest(sel) ?? null);
      }
    }
    const card = new El("li", "step-5");
    const details = new El("details", null, card);
    const list = new El("ol", null, details);
    new El("li", "step-5-token", list);
    const all = [card, details, list, ...list.children];
    const doc = { getElementById: (id: string) => (all.find((e) => e.id === id) ?? null) as unknown as HTMLElement };

    expect(openStepFromHash("#step-5-token", doc)).toBe(true);
    expect(details.open).toBe(true);
    expect(openStepFromHash("#step-5-token", doc)).toBe(false); // เปิดอยู่แล้ว

    details.open = false;
    expect(openStepFromHash("#step-5", doc)).toBe(true);
    expect(details.open).toBe(true);

    details.open = false;
    expect(openStepFromHash("#instagram", doc)).toBe(false);
    expect(openStepFromHash("#step-9-nope", doc)).toBe(false);
    expect(details.open).toBe(false);
  });
});

describe("สถานะบัญชี Instagram ในหน้าตั้งค่า: กติกาเดียวกับแถบเมนู", () => {
  it("ต่ออายุไม่สำเร็จชั่วคราว → ป้าย 'ต้องตรวจสอบ' (ไม่ใช่ 'พร้อมใช้งาน') และบอกว่าระบบลองใหม่เอง", () => {
    const a = account({ lastError: `${INSTAGRAM_ERRORS.refreshPrefix}: Graph API ล่ม` });
    const text = textOf(render(createElement(InstagramAccountsList, { accounts: [a], pages: [] })));
    expect(text).toContain("ต้องตรวจสอบ");
    expect(text).not.toContain("พร้อมใช้งาน");
    expect(text).toContain("ระบบจะลองต่ออายุใหม่เองทุก 6 ชั่วโมง");
    expect(instagramNeedsAttention([a])).toBe(true);
  });

  it("Meta ไม่รับ token แล้ว → ป้ายสีแดง และให้วาง token ใหม่ (ไม่มีปุ่มต่ออายุ)", () => {
    const a = account({ lastError: INSTAGRAM_ERRORS.tokenRejected });
    const html = render(createElement(InstagramAccountsList, { accounts: [a], pages: [] }));
    const text = textOf(html);
    expect(text).toContain("token ใช้ไม่ได้");
    expect(text).not.toContain("พร้อมใช้งาน");
    expect(text).not.toContain("ต่ออายุให้อัตโนมัติ");
    expect(html).toContain('href="#connect-instagram"');
    expect(text).not.toContain("ต่ออายุ token");
  });

  it("subscribe ซ้ำหลังต่ออายุไม่สำเร็จ → ให้กดลองใหม่ได้", () => {
    const a = account({ lastError: `${INSTAGRAM_ERRORS.subscribePrefix} (Graph API ล่ม)` });
    const text = textOf(render(createElement(InstagramAccountsList, { accounts: [a], pages: [] })));
    expect(text).toContain("ต้องตรวจสอบ");
    expect(text).toContain("ลองใหม่");
  });

  it("แถบเมนู (ชิปบัญชี) ใช้กติกาเดียวกัน: ต่ออายุไม่สำเร็จชั่วคราว = ต้องตรวจสอบ ไม่ใช่ ยังไม่พร้อมใช้งาน", () => {
    const shell = (a: InstagramAccount) => {
      const data: ShellData = {
        setup: { done: 6, total: 6 },
        pages: [],
        instagram: [{ id: a.id, username: a.username, status: instagramHealthLevel(instagramAccountHealth(a)) }],
        theme: "system",
      };
      return textOf(render(createElement(AppShell, { data } as ComponentProps<typeof AppShell>, "เนื้อหา")));
    };
    const retrying = shell(account({ lastError: `${INSTAGRAM_ERRORS.refreshPrefix}: 500` }));
    expect(retrying).toContain("ต้องตรวจสอบ");
    expect(retrying).not.toContain("ยังไม่พร้อมใช้งาน");
    expect(shell(account({ lastError: INSTAGRAM_ERRORS.tokenRejected }))).toContain("ยังไม่พร้อมใช้งาน");
    expect(shell(account({ subscribed: false }))).toContain("ยังไม่พร้อมใช้งาน");
    const ok = shell(account());
    expect(ok).not.toContain("ต้องตรวจสอบ");
    expect(ok).not.toContain("ยังไม่พร้อมใช้งาน");
  });

  it("ไม่มีปัญหา → พร้อมใช้งาน", () => {
    const a = account();
    expect(textOf(render(createElement(InstagramAccountsList, { accounts: [a], pages: [] })))).toContain("พร้อมใช้งาน");
    expect(instagramNeedsAttention([a])).toBe(false);
  });
});

describe("แถบแจ้งเตือนในหน้ากิจกรรม", () => {
  it("ต่ออายุ token ไม่สำเร็จไม่ถูกนับว่า 'ส่งไม่สำเร็จ'", () => {
    expect(failureSummary({})).toBeNull();
    expect(failureSummary({ dm_failed: 2, public_reply_failed: 1 })).toMatchObject({
      title: "ส่งไม่สำเร็จ 3 รายการ ใน 24 ชั่วโมงที่ผ่านมา",
      href: "/activity?filter=failed",
    });
    const token = failureSummary({ token_refresh_failed: 1 })!;
    expect(token.title).not.toContain("ส่งไม่สำเร็จ");
    expect(token.title).toContain("ต่ออายุ token Instagram ไม่สำเร็จ 1 ครั้ง");
    expect(token.href).toBe("/settings#instagram");
    const both = failureSummary({ dm_failed: 1, token_refresh_failed: 1 })!;
    expect(both.title).toBe("มีรายการไม่สำเร็จ 2 รายการ ใน 24 ชั่วโมงที่ผ่านมา");
    expect(both.description).toContain("ส่งข้อความไม่สำเร็จ 1 รายการ");
    expect(both.description).toContain("ต่ออายุ token Instagram ไม่สำเร็จ 1 ครั้ง");
  });
});

describe("หน้ากิจกรรม: ข้อความเข้าที่ไม่ตรงกฎ (ไม่เก็บชื่อ/ข้อความ)", () => {
  const now = new Date("2026-10-13T10:00:00Z");
  function unmatched(type: "comment_received" | "dm_received"): TimelineEvent {
    return {
      id: 1,
      type,
      platform: "facebook",
      createdAt: new Date(now.getTime() - 60_000),
      ruleId: null,
      ruleName: null,
      person: null,
      text: null,
      buttons: [],
      error: null,
      skipReason: null,
      unmatched: true,
    };
  }
  const full = (e: TimelineEvent) => textOf(render(createElement(TimelineItem, { event: e, now })));
  const compact = (e: TimelineEvent) => textOf(render(createElement(TimelineItemCompact, { event: e, now })));

  it("ไม่บอกว่าคำไม่ตรง — คอมเมนต์อาจไม่ตรงเพราะโพสต์/แพลตฟอร์มที่ตั้งไว้ก็ได้", () => {
    for (const html of [full(unmatched("comment_received")), compact(unmatched("comment_received"))]) {
      expect(html).toContain("มีคนคอมเมนต์ (ไม่ตรงกฎ)");
      expect(html).toContain("ไม่ได้เก็บชื่อและข้อความ เพราะไม่ตรงกับกฎไหนเลย (คำ โพสต์ หรือแพลตฟอร์มที่ตั้งไว้)");
      expect(html).not.toContain("ไม่ตรงกับคำที่ตั้งไว้");
    }
  });

  it("แชทไม่มีเรื่องโพสต์ → ไม่พูดถึงโพสต์", () => {
    for (const html of [full(unmatched("dm_received")), compact(unmatched("dm_received"))]) {
      expect(html).toContain("มีคนทักแชท (ไม่ตรงกฎ)");
      expect(html).toContain("ไม่ได้เก็บชื่อและข้อความ เพราะไม่ตรงกับกฎไหนเลย (คำหรือแพลตฟอร์มที่ตั้งไว้)");
      expect(html).not.toContain("โพสต์");
    }
  });

  it("ข้อความเข้าที่ตรงกฎ → ไม่มีป้าย/คำอธิบายนี้", () => {
    const html = full({ ...unmatched("comment_received"), unmatched: false, person: "Somchai", text: "สนใจ" });
    expect(html).not.toContain("ไม่ตรงกฎ");
    expect(html).not.toContain("ไม่ได้เก็บชื่อ");
  });

  it("ชี้ไปหน้าข้อความรอตอบ (ที่เก็บชื่อ/ข้อความไว้ให้ตามตอบ) — เฉพาะกิจกรรมที่ยังไม่เกินอายุของหน้านั้น", () => {
    const raw = (e: TimelineEvent) => render(createElement(TimelineItem, { event: e, now }));
    for (const type of ["comment_received", "dm_received"] as const) {
      const html = raw(unmatched(type));
      expect(html).toContain('href="/inbox"');
      expect(textOf(html)).toContain("ดูในข้อความรอตอบ");
    }
    // เกิน 30 วัน → รายการในหน้าข้อความรอตอบถูกลบไปแล้ว ไม่ต้องชี้ไป
    const old = raw({ ...unmatched("dm_received"), createdAt: new Date(now.getTime() - 31 * DAY) });
    expect(old).not.toContain('href="/inbox"');
    // ข้อความที่ตรงกฎ (ระบบตอบแล้ว) ไม่อยู่ในหน้าข้อความรอตอบ
    const matched = raw({ ...unmatched("comment_received"), unmatched: false, person: "Somchai", text: "สนใจ" });
    expect(matched).not.toContain('href="/inbox"');
  });
});

describe("ตัวสร้างกฎ: การ์ดบนผืนผ้าใบโหมดสว่างหน้าตาเหมือนเดิม", () => {
  it("เงาการ์ดแบบเดิมในโหมดสว่าง และใช้ shadow-sm เฉพาะโหมดมืด", () => {
    const { doc } = createInitialState({ ...ruleTemplate("comment"), name: "ทดสอบ" });
    const html = render(
      createElement(TriggerNode, { doc, selected: false, problem: false, showErrors: false, onMeasure: () => {} }),
    );
    expect(html).toContain("shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.08)]");
    expect(html).toContain("dark:shadow-sm");
    expect(html).not.toMatch(/(?<![:\w-])shadow-sm/);
  });
});
