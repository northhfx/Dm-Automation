import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as clickLink } from "@/app/r/[code]/route";
import type { Db } from "@/db/client";
import { createT, placeholdersOf } from "@/lib/i18n";
import { systemMessages } from "@/lib/i18n/messages/system";
import { localizeSystemMessage, systemMessage, type SystemKey } from "@/lib/i18n/system";
import { connectInstagramWithToken, InstagramConnectError } from "@/lib/instagram/connect";
import { graphRequest } from "@/lib/meta/graph";
import { resetDatabase } from "./helpers";

/*
 * ข้อความที่โค้ดเบื้องหลังสร้างเอง (หมวด system) — เก็บ/โยนเป็นภาษาไทยต้นฉบับเสมอ แล้วแปลตอนแสดงผล
 * - localizeSystemMessage แปลได้ทุกแม่แบบ (รวมข้อความซ้อนกันหลายชั้น) และไม่แตะข้อความอื่น
 * - ข้อความไทยที่สร้างได้ยังเหมือนเดิมทุกตัวอักษร (แถวเก่าในฐานข้อมูล + โค้ดที่เทียบข้อความกันเอง)
 * - ไม่มีข้อความไทยหลงในโค้ด (src/**) นอกหมวดข้อความ ยกเว้นรายการที่ตั้งใจไว้ด้านล่าง
 */

const THAI = /[฀-๿]/;
const KEYS = Object.keys(systemMessages.th) as SystemKey[];

/** ค่าตัวอย่างของ {ตัวแปร}: ภาษาอังกฤษ ไม่ซ้ำกัน (ไว้ตรวจว่าค่าไปอยู่ถูกที่) */
function sampleVars(key: SystemKey): Record<string, string> {
  return Object.fromEntries(placeholdersOf(systemMessages.th[key]).map((name) => [name, `<${name}:${key}>`]));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("localizeSystemMessage", () => {
  const en = createT(systemMessages, "en");

  it.each(KEYS)("%s: ภาษาไทยต้นฉบับ → ภาษาอังกฤษ (ค่าในตัวแปรคงเดิม) / ภาษาไทย → คงเดิม", (key) => {
    const vars = sampleVars(key);
    const thai = systemMessage(key, vars);
    expect(thai).toMatch(THAI);
    const english = localizeSystemMessage(thai, "en");
    expect(english).toBe(en(key, vars));
    expect(english).not.toMatch(THAI);
    expect(localizeSystemMessage(thai, "th")).toBe(thai);
  });

  it("ข้อความซ้อนกันหลายชั้น ({detail} / {note}) แปลครบทุกชั้น", () => {
    const network = systemMessage("graphUnreachable", { detail: "fetch failed" });
    expect(localizeSystemMessage(systemMessage("igRefreshFailed", { detail: network }), "en")).toBe(
      "Couldn't renew the token: Couldn't reach the Graph API: fetch failed",
    );
    expect(localizeSystemMessage(systemMessage("igSubscribeFailed", { detail: systemMessage("igSubscribeUnconfirmed") }), "en")).toBe(
      "Couldn't subscribe to the webhook (Instagram didn't confirm the webhook subscription)",
    );
    expect(
      localizeSystemMessage(systemMessage("capWait", { note: systemMessage("capPrivateReply", { limit: "720" }) }), "en"),
    ).toBe("Reached the limit of 720 private replies per hour — queued to send once the hour is up (no messages are lost)");
    const wait = systemMessage("rateLimitWait", { code: "10 / 2534040", hits: "2", max: "10", minutes: "2" });
    expect(localizeSystemMessage(systemMessage("rateLimitWaitAccount", { note: wait }), "en")).toBe(
      "Meta asked us to slow down (code 10 / 2534040), round 2/10 — trying again in 2 min (paused for the whole account)",
    );
  });

  it("ข้อความที่ไม่ตรงแม่แบบ (error จาก Meta / ข้อความอื่น) คงเดิม — ตัวแปรที่เป็นข้อมูล (ชื่อเพจ ฯลฯ) ไม่ถูกแปล", () => {
    for (const message of [
      "(#100) Invalid parameter",
      "Error validating access token: Session has expired",
      "",
      "ข้อความอื่นที่ไม่ใช่ของระบบ",
      // ต้องตรงทั้งข้อความ ไม่ใช่แค่บางส่วน
      `ก่อนหน้า ${systemMessages.th.stepMissing}`,
      `${systemMessages.th.stepMissing} ต่อท้าย`,
    ]) {
      expect(localizeSystemMessage(message, "en")).toBe(message);
    }
    // ชื่อเพจที่บังเอิญตรงกับแม่แบบ ไม่ถูกแปล (แปลซ้อนเฉพาะ {detail} / {note})
    expect(localizeSystemMessage(systemMessage("igLinkedNotice", { page: systemMessages.th.linkNotFound }), "en")).toBe(
      `This account is also linked to your Page ${systemMessages.th.linkNotFound} — we'll use Instagram Login for it instead.`,
    );
    // ค่าในตัวแปรที่มีวงเล็บปีกกา ไม่ถูกตีความเป็นตัวแปรซ้ำ
    expect(localizeSystemMessage(systemMessage("graphUnreachable", { detail: "{detail} {x}" }), "en")).toBe(
      "Couldn't reach the Graph API: {detail} {x}",
    );
  });
});

describe("ข้อความไทยต้นฉบับเหมือนเดิมทุกตัวอักษร (แถวเก่าในฐานข้อมูลยังแปลได้ / โค้ดที่เทียบข้อความยังทำงาน)", () => {
  it("ข้อความที่ประกอบจากตัวแปร", () => {
    // ตัวเลขไม่มีตัวคั่นหลักพัน (ส่งเป็นข้อความ)
    expect(systemMessage("capPrivateReply", { limit: "1000" })).toBe("ตอบคอมเมนต์ทาง DM ครบ 1000 ครั้งใน 1 ชั่วโมงแล้ว");
    expect(systemMessage("capWait", { note: systemMessage("capDm", { limit: "3" }) })).toBe(
      "ส่ง DM ครบ 3 ข้อความใน 1 ชั่วโมงแล้ว — รอคิวส่งต่อเมื่อพ้นช่วง 1 ชั่วโมง (ข้อความไม่หาย)",
    );
    expect(systemMessage("rateLimitWait", { code: "613", hits: "1", max: "10", minutes: "1" })).toBe(
      "Meta ขอให้ชะลอการส่ง (รหัส 613) รอบที่ 1/10 — ลองส่งใหม่ในอีก 1 นาที",
    );
    expect(systemMessage("rateLimitNotice", { code: "613", minutes: "1" })).toBe(
      "Meta แจ้งว่าบัญชีนี้ส่งข้อความถี่เกินกำหนดชั่วคราว (รหัส 613) — ระบบพักการส่ง DM ไว้ก่อน " +
        "แล้วจะลองส่งใหม่เองเป็นระยะ (ครั้งแรกในอีก 1 นาที) ข้อความไม่หาย ไม่ต้องทำอะไร",
    );
    expect(systemMessage("igIdMismatch", { username: "mint.shop", id: "IG1", pageIgId: "IG2" })).toBe(
      "ID ของ @mint.shop จาก Instagram Login (IG1) ไม่ตรงกับที่ผูกกับเพจ (IG2) — ระบบยังทำงานได้ แต่อาจตอบซ้ำ แจ้งผู้พัฒนา",
    );
    expect(systemMessage("unknownJobType", { type: "mystery" })).toBe("ไม่รู้จักงานประเภท mystery");
  });
});

describe("ข้อความจากโค้ดจริงแปลได้", () => {
  it("Graph API: เชื่อมต่อไม่ได้ / ตอบกลับสถานะที่ไม่ใช่ JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fetch failed"));
    const network = await graphRequest("/me", { api: "instagram" }).catch((e: Error) => e.message);
    expect(network).toBe("เชื่อมต่อ Graph API ไม่ได้: fetch failed");
    expect(localizeSystemMessage(network as string, "en")).toBe("Couldn't reach the Graph API: fetch failed");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("<html>Bad gateway</html>", { status: 502 }));
    const status = await graphRequest("/me", { api: "instagram" }).catch((e: Error) => e.message);
    expect(status).toBe("Graph API ตอบกลับสถานะ 502");
    expect(localizeSystemMessage(status as string, "en")).toBe("The Graph API responded with status 502");
  });

  it("เชื่อม Instagram: ตรวจ token ก่อนเรียก Meta", async () => {
    const db = {} as Db;
    for (const [token, english] of [
      ["  ", "Paste your Instagram access token first."],
      ["EAAG123", "This is a Facebook token (it starts with EAA)."],
    ]) {
      const err = await connectInstagramWithToken(db, token).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InstagramConnectError);
      const message = (err as InstagramConnectError).message;
      expect(message).toMatch(THAI);
      expect(localizeSystemMessage(message, "en")).toContain(english);
    }
  });

  it("ลิงก์ติดตามที่ไม่มีในระบบ: ตามคุกกี้ภาษา (ลูกค้าไม่มีคุกกี้ = ไทย)", async () => {
    await resetDatabase();
    const click = (cookie?: string) =>
      clickLink(new NextRequest("https://dm.example.com/r/nope", cookie ? { headers: { cookie } } : undefined), {
        params: Promise.resolve({ code: "nope" }),
      });
    const thai = await click();
    expect(thai.status).toBe(404);
    expect(await thai.text()).toBe("ไม่พบลิงก์นี้");
    const english = await click("lang=en");
    expect(english.status).toBe(404);
    expect(await english.text()).toBe("Link not found");
  });
});

// ---------- ไม่มีข้อความไทยหลงในโค้ด ----------

const ROOT = path.resolve(import.meta.dirname, "..");

/** โฟลเดอร์ที่ไม่ตรวจ: หมวดข้อความ + ตัวระบบแปลภาษาเอง (ชื่อภาษา "ไทย", คำเชื่อม "และ" ฯลฯ) */
const SKIP_DIRS = ["src/lib/i18n"];

/**
 * ข้อความไทยที่ตั้งใจเก็บไว้ในโค้ด (ไฟล์ → ข้อความ, "*" = ทั้งไฟล์) — ไม่ใช่ข้อความที่หน้าจัดการแสดง
 * ข้อความใหม่ที่เจ้าของร้านเห็น ให้ใส่ในหมวดข้อความ (src/lib/i18n/messages/*) แทนการเพิ่มที่นี่
 */
const ALLOWED: Record<string, readonly string[] | "*"> = {
  // ข้อความตั้งต้นที่ส่งหาลูกค้า (ภาษาของลูกค้า ไม่ตามภาษาของหน้าจัดการ — ดู lib/i18n/locale.ts)
  "src/app/(dashboard)/rules/templates.ts": "*",
  "src/lib/rules/template.ts": ["คุณลูกค้า"],
  // ชื่อเมนูในแอป Instagram ภาษาไทย (มีชุดภาษาอังกฤษคู่กัน)
  "src/lib/meta/setup-info.ts": ["โปรไฟล์", "การตั้งค่าและกิจกรรม", "ข้อความและการตอบกลับสตอรี่", "การควบคุมข้อความ", "เครื่องมือที่เชื่อมต่อ"],
  // ส่วนต้นของ system.igRefreshFailed / system.igSubscribeFailed (ใช้เทียบ lastError — settings-i18n.test.ts ตรวจว่าตรงกัน)
  "src/lib/instagram/accounts.ts": ["ต่ออายุ token ไม่สำเร็จ", "subscribe webhook ไม่สำเร็จ"],
  // ไม่มีหน้าไหนแสดงได้ถ้าไม่มี DATABASE_URL — เห็นใน log ของเซิร์ฟเวอร์เท่านั้น
  "src/lib/env.ts": ["ยังไม่ได้ตั้งค่า DATABASE_URL (ดูวิธีตั้งค่าใน README.md)"],
  // ผู้เรียกจับไว้ทุกที่ (token: null) ไม่แสดงข้อความนี้
  "src/lib/crypto.ts": ["รูปแบบข้อมูลเข้ารหัสไม่ถูกต้อง"],
  // error สำหรับนักพัฒนา (ใช้คอมโพเนนต์ผิดที่)
  "src/components/menu.tsx": ["MenuItem ต้องอยู่ใน <Menu>"],
  // เทียบผลของ relativeTime ภาษาไทย ("เมื่อวาน" / "เมื่อสักครู่") ไม่ได้แสดง
  "src/app/(dashboard)/rules/builder/trigger-panel.tsx": ["เมื่อ"],
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return SKIP_DIRS.includes(path.relative(ROOT, p)) ? [] : sourceFiles(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** อยู่ในอาร์กิวเมนต์ของ console.log / console.error ฯลฯ (ข้อความใน log ของเซิร์ฟเวอร์ ไม่ใช่หน้าเว็บ) */
function inConsoleCall(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === "console"
    ) {
      return true;
    }
  }
  return false;
}

/** ข้อความไทยทั้งหมดในโค้ดของไฟล์ (string / template / ข้อความใน JSX — ไม่รวมคอมเมนต์และ regex) */
function thaiLiterals(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateLiteralToken(node)) text = node.text;
    else if (ts.isJsxText(node)) text = node.text.trim();
    if (text && THAI.test(text) && !inConsoleCall(node)) found.push(text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("ไม่มีข้อความไทยหลงในโค้ด (ทุกข้อความที่หน้าจัดการแสดงต้องผ่านหมวดข้อความ)", () => {
  it("src/** นอกหมวดข้อความ มีข้อความไทยเฉพาะที่ตั้งใจไว้", () => {
    const leftovers: string[] = [];
    for (const file of sourceFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      const allowed = ALLOWED[rel];
      if (allowed === "*") continue;
      for (const text of thaiLiterals(file)) {
        if (!allowed?.includes(text)) leftovers.push(`${rel}: ${text}`);
      }
    }
    expect(leftovers).toEqual([]);
  });

  it("รายการที่ตั้งใจไว้ยังมีอยู่จริง (ลบออกจากรายการเมื่อโค้ดเปลี่ยนแล้ว)", () => {
    for (const [rel, texts] of Object.entries(ALLOWED)) {
      const found = thaiLiterals(path.join(ROOT, rel));
      if (texts === "*") expect(found.length, rel).toBeGreaterThan(0);
      else for (const text of texts) expect(found, rel).toContain(text);
    }
  });
});
