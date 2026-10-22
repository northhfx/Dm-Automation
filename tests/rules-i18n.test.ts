import { describe, expect, it, vi } from "vitest";
import { createElement, createRef, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";
import { rulesMessages } from "@/lib/i18n/messages/rules";
import type { RecentPost } from "@/lib/meta/graph";

/*
 * หน้ารายการกฎ + แผงของตัวสร้างกฎ (แถบบน / ภาพรวม / เงื่อนไข) แสดงเป็นภาษาอังกฤษได้ครบ และภาษาไทยยังเหมือนเดิม
 * (render เป็น HTML แล้วตรวจข้อความ — ไม่ใช้ฐานข้อมูล: หน้า /rules ใช้ฐานข้อมูลจำลอง)
 */

const lang = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "lang" && lang.value ? { name, value: lang.value } : undefined) }),
}));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => {} }));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));

// หน้า /rules: ฐานข้อมูลจำลอง (select → from → orderBy) + สถิติจำลอง
const RULE_ROWS = [
  {
    id: 1,
    name: "Price comment",
    active: true,
    trigger: "comment",
    platforms: ["facebook", "instagram"],
    matchType: "contains",
    keywords: ["price", "info"],
    postScope: "any",
    postIds: [],
    boundPosts: {},
    publicReplies: ["Sent!"],
    steps: [{ id: "s1", text: "Hi {name}", buttons: [{ id: "b1", title: "Open", type: "link", url: "https://example.com" }] }],
    folderId: null,
  },
  {
    id: 2,
    name: "Hello chat",
    active: false,
    trigger: "dm",
    platforms: ["facebook"],
    matchType: "any",
    keywords: [],
    postScope: "any",
    postIds: [],
    boundPosts: {},
    publicReplies: [],
    steps: [{ id: "s1", text: "Hello", buttons: [] }],
    folderId: null,
  },
];
vi.mock("@/db/client", () => ({
  // โฟลเดอร์ (select { id, name }) → ยังไม่มี · กฎ → RULE_ROWS
  getDb: () => ({
    select: (fields: Record<string, unknown>) => ({ from: () => ({ orderBy: async () => ("active" in fields ? RULE_ROWS : []) }) }),
  }),
}));
vi.mock("@/lib/stats", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stats")>()),
  getAllTimeRuleStats: async () => new Map([[1, { triggers: 1234, sent: 1300, reached: 1000, engaged: 120, hasButtons: true }]]),
}));

const { default: RulesPage } = await import("@/app/(dashboard)/rules/page");
const { RuleList, RulesEmptyState } = await import("@/app/(dashboard)/rules/rule-list");
const { TemplateOptions } = await import("@/app/(dashboard)/rules/template-chooser");
const { default: NewRuleLoading } = await import("@/app/(dashboard)/rules/new/loading");
const { default: EditRuleLoading } = await import("@/app/(dashboard)/rules/[id]/loading");
const { TopBar } = await import("@/app/(dashboard)/rules/builder/top-bar");
const { OverviewPanel } = await import("@/app/(dashboard)/rules/builder/overview-panel");
const { TriggerPanel } = await import("@/app/(dashboard)/rules/builder/trigger-panel");
const { createInitialState, stepNumbers } = await import("@/app/(dashboard)/rules/builder/model");
const { ruleTemplate } = await import("@/app/(dashboard)/rules/templates");

type RuleListItem = ComponentProps<typeof RuleList>["rules"][number];
type BuilderDoc = ReturnType<typeof createInitialState>["doc"];

const ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };

function render(el: ReactElement, locale?: Locale): string {
  const inner = locale ? createElement(I18nProvider, { locale } as ComponentProps<typeof I18nProvider>, el) : el;
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, inner));
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** ค่าในแอตทริบิวต์ (aria-label / title / placeholder) */
function attrs(html: string, name: string): string[] {
  return [...html.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((m) => m[1].replace(/&quot;/g, '"').replace(/&#x27;/g, "'"));
}

const THAI = /[฀-๿]/;

/** ไม่มีตัวอักษรไทยหลงในข้อความหรือแอตทริบิวต์ที่ผู้ใช้เห็น/โปรแกรมอ่านหน้าจออ่าน */
function expectNoThai(html: string) {
  expect(textOf(html)).not.toMatch(THAI);
  for (const name of ["aria-label", "title", "placeholder"]) {
    for (const value of attrs(html, name)) expect(value, `${name}="${value}"`).not.toMatch(THAI);
  }
}

// ---------- ข้อมูลตัวอย่าง (ชื่อกฎ/คำ/ข้อความเป็นภาษาอังกฤษ เพื่อให้ตรวจได้ว่าไม่มีภาษาไทยหลง) ----------

const base: RuleListItem = {
  id: 1,
  name: "Price comment",
  rank: 1,
  folderId: null,
  folderName: null,
  scheduleState: "open",
  scheduleAt: null,
  active: true,
  trigger: "comment",
  platforms: ["facebook", "instagram"],
  matchType: "contains",
  keywords: ["price", "info", "link", "buy", "cost", "how much"],
  postScope: "specific",
  postCount: 3,
  boundPlatforms: [],
  publicReply: true,
  stepCount: 2,
  buttonCount: 1,
  firstText: "Hi {name}, here is the link",
  runs: 1234,
  hasButtons: true,
  ctr: 12.5,
};

const RULES: RuleListItem[] = [
  base,
  { ...base, id: 2, name: "Next post", matchType: "exact", keywords: ["yes"], postScope: "next", boundPlatforms: ["facebook"], active: false },
  { ...base, id: 3, name: "Every comment", matchType: "any", keywords: [], postScope: "any", publicReply: false },
  { ...base, id: 4, name: "No posts", postScope: "specific", postCount: 0, keywords: ["x"] },
  { ...base, id: 5, name: "Waiting", postScope: "next", boundPlatforms: [] },
  { ...base, id: 6, name: "Bound all", postScope: "next", boundPlatforms: ["facebook", "instagram"] },
  { ...base, id: 7, name: "Chat price", trigger: "dm", matchType: "contains", keywords: ["price"], hasButtons: false, ctr: null, buttonCount: 0, firstText: "" },
  { ...base, id: 8, name: "Chat exact", trigger: "dm", matchType: "exact", keywords: ["hi"] },
  { ...base, id: 9, name: "Chat any", trigger: "dm", matchType: "any", keywords: [] },
];

function doc(patch: Partial<BuilderDoc> = {}): BuilderDoc {
  return { ...createInitialState(ruleTemplate("comment")).doc, name: "Test", publicReplies: ["Sent!", "Check your DMs"], ...patch };
}

const POSTS: RecentPost[] = [
  { id: "P1", platform: "instagram", caption: "New bag", permalink: "https://instagram.com/reel/abc", imageUrl: null, createdAt: "2026-10-13T07:05:00Z", mediaType: "VIDEO" },
  { id: "P2", platform: "facebook", caption: "", permalink: "https://facebook.com/x/videos/1", imageUrl: "https://cdn/x.jpg", createdAt: null, mediaType: null },
  ...Array.from({ length: 6 }, (_, i): RecentPost => ({
    id: `F${i}`,
    platform: "facebook",
    caption: `Post ${i}`,
    permalink: null,
    imageUrl: null,
    createdAt: "2026-10-12T07:05:00Z",
    mediaType: null,
  })),
];

const noop = () => {};

// ---------- หน้า /rules ----------

describe("หน้ารายการกฎ (/rules) สองภาษา", () => {
  async function page(locale: Locale | undefined): Promise<string> {
    lang.value = locale;
    return render(await RulesPage({ searchParams: Promise.resolve({}) } as never), locale);
  }

  it("ภาษาอังกฤษ: หัวหน้า ป้าย ปุ่ม และการ์ด", async () => {
    const html = await page("en");
    const text = textOf(html);
    expect(text).toContain("Automation");
    expect(text).toContain("Reply to comments and messages automatically when customers type the keywords you set.");
    expect(text).toContain("On: 1 of 2");
    expect(text).toContain("New Automation");
    expect(text).toContain("When someone comments");
    expect(text).toContain("When someone messages you");
    // CTR = 120 / 1000
    expect(text).toContain("12%");
    expect(text).toContain("1,234");
    expectNoThai(html);
  });

  it("ภาษาไทย (คุกกี้ th หรือไม่มีคุกกี้) ยังเหมือนเดิม", async () => {
    for (const locale of [undefined, "th"] as const) {
      const text = textOf(await page(locale));
      expect(text).toContain("กฎอัตโนมัติ");
      expect(text).toContain("ตอบคอมเมนต์และแชทให้อัตโนมัติ เมื่อลูกค้าพิมพ์คำที่คุณตั้งไว้");
      expect(text).toContain("เปิดอยู่ 1 จาก 2 กฎ");
      expect(text).toContain("สร้างกฎใหม่");
    }
  });
});

describe("รายการกฎ (RuleList)", () => {
  it("ภาษาอังกฤษครบทุกแบบของเงื่อนไข / โพสต์ / สถิติ", () => {
    const html = render(createElement(RuleList, { rules: RULES }), "en");
    const text = textOf(html);
    for (const s of [
      "When someone comments",
      "When someone messages you",
      "If several automations match, the top one is used",
      "Comment contains",
      "Comment is exactly",
      "Every comment",
      "Message contains",
      "Message is exactly",
      "Every message",
      "+2 more",
      "Selected posts/reels: 3",
      "No posts or reels picked yet",
      "Waiting for your next post or reel",
      "Linked to your new post/reel",
      "Facebook linked",
      "All posts and reels",
      "Customer name",
      "No message written yet",
      "Public reply",
      "Messages: 2",
      "Buttons: 1",
      "Runs 1,234",
      // 12.5 → "13%" (ตั้งแต่ 10% ขึ้นไปไม่มีทศนิยม)
      "Click rate 13%",
      "(no buttons)",
      "On",
      "Off",
      "Numbers cover the last 12 months · Click rate = share of people who got the DM and tapped a button or link · Move an automation up or down from its ⋮ button",
    ]) {
      expect(text, s).toContain(s);
    }
    expect(attrs(html, "aria-label")).toEqual(expect.arrayContaining(["Turn on Price comment", "Options for Price comment"]));
    expect(attrs(html, "title")).toEqual(expect.arrayContaining(["Position 1", "This automation has no buttons, so it has no click rate"]));
    expect(text).toContain("Position 1");
    expectNoThai(html);
  });

  it("ภาษาไทยเหมือนเดิม", () => {
    const text = textOf(render(createElement(RuleList, { rules: RULES })));
    for (const s of [
      "เมื่อมีคนคอมเมนต์",
      "ถ้าตรงหลายกฎ ระบบใช้กฎที่อยู่บนสุด",
      "คอมเมนต์ที่มีคำว่า",
      "แชทที่พิมพ์ว่า",
      "ทุกข้อความในแชท",
      "3 โพสต์/รีลที่เลือก",
      "ผูก Facebook แล้ว",
      "ตอบใต้คอมเมนต์",
      "ส่ง 2 ข้อความ",
      "1 ปุ่ม",
      "ทำงาน 1,234 ครั้ง",
      "อัตราการกด 13%",
      "(ไม่มีปุ่ม)",
      "ลำดับที่ 1",
      "ตัวเลขนับย้อนหลัง 12 เดือน · อัตราการกด = สัดส่วนคนที่กดปุ่มหรือลิงก์ จากคนที่ได้รับ DM · ย้ายกฎขึ้น/ลงได้จากปุ่ม ⋮ ของแต่ละกฎ",
    ]) {
      expect(text, s).toContain(s);
    }
  });

  it("หน้าว่าง + แบบเริ่มต้น", () => {
    const html = render(createElement(RulesEmptyState), "en");
    const text = textOf(html);
    for (const s of [
      "No automations yet",
      "Pick a starting template below",
      "Comment → DM with a button",
      "Reply to messages by keyword",
      "Start from scratch",
      "Recommended",
      "Tap button",
      "Empty card",
    ]) {
      expect(text, s).toContain(s);
    }
    expectNoThai(html);
    expect(textOf(render(createElement(RulesEmptyState)))).toContain("ยังไม่มีกฎอัตโนมัติ");
    expect(textOf(render(createElement(TemplateOptions, { layout: "grid" })))).toContain("คอมเมนต์ → ส่ง DM พร้อมปุ่ม");
  });
});

describe("หน้าโหลดของตัวสร้างกฎ", () => {
  it("บอกโปรแกรมอ่านหน้าจอตามภาษา", () => {
    expect(textOf(render(createElement(NewRuleLoading), "en"))).toContain("Preparing your new automation…");
    expect(textOf(render(createElement(EditRuleLoading), "en"))).toContain("Opening automation…");
    expect(textOf(render(createElement(NewRuleLoading)))).toContain("กำลังเตรียมกฎใหม่…");
    expect(textOf(render(createElement(EditRuleLoading)))).toContain("กำลังเปิดกฎ…");
  });
});

// ---------- ตัวสร้างกฎ: แถบบน / ภาพรวม / เงื่อนไข ----------

describe("แถบบนของตัวสร้างกฎ", () => {
  const props = {
    ruleId: 5,
    name: "My automation",
    nameRef: createRef<HTMLInputElement>(),
    nameInvalid: false,
    active: true,
    dirty: true,
    pending: false,
    stats: { triggers: 1234, sent: 10, ctr: 12.5 },
    onName: noop,
    onActive: noop,
    onSave: noop,
    schedule: { startsAt: null, endsAt: null },
    onSchedule: noop,
  };

  it("ภาษาอังกฤษ", () => {
    const html = render(createElement(TopBar, props), "en");
    const text = textOf(html);
    for (const s of ["Runs: 1,234 · Click rate: 13%", "Active", "On", "Unsaved changes", "Save"]) expect(text, s).toContain(s);
    expect(attrs(html, "aria-label")).toEqual(expect.arrayContaining(["Back to all automations", "Automation name", "Options for this automation"]));
    expect(attrs(html, "placeholder")).toEqual(["Name it, e.g. Comment “info” → send link"]);
    expect(attrs(html, "title")).toEqual(expect.arrayContaining(["All automations", "Save (Ctrl+S)"]));
    expectNoThai(html);
    expect(textOf(render(createElement(TopBar, { ...props, dirty: false }), "en"))).toContain("Saved");
    expect(textOf(render(createElement(TopBar, { ...props, pending: true }), "en"))).toContain("Saving…");
  });

  it("ภาษาไทยเหมือนเดิม", () => {
    const text = textOf(render(createElement(TopBar, props)));
    for (const s of ["ทำงาน 1,234 ครั้ง · อัตราการกด 13%", "เปิดใช้งาน", "ยังไม่ได้บันทึก", "บันทึก"]) expect(text, s).toContain(s);
  });
});

describe("แผงภาพรวม", () => {
  const d = doc();
  const props = {
    doc: d,
    selection: { kind: "edge" as const, from: { kind: "trigger" as const } },
    problems: [],
    numbers: stepNumbers(d),
    serverError: "Server said no",
    stats: { triggers: 1234, sent: 1300, ctr: 12.5 },
    dispatch: noop,
    onGoTo: noop,
  };

  it("ภาษาอังกฤษ", () => {
    const html = render(createElement(OverviewPanel, props), "en");
    const text = textOf(html);
    for (const s of [
      "Selected line",
      '"When…" card → message #1',
      "Remove this line",
      "Couldn't save",
      "Before you save",
      "All set. Ready to save.",
      "Results for this automation",
      "Runs 1,234 total",
      "DMs sent 1,300 messages",
      "Click rate 13% of people reached",
      "How to use",
      "Tap a card to edit it · Drag a card to move it",
      "Drag from the dot next to a button.",
      "Drag empty space to move around",
      'Set up the trigger ("When…" card)',
    ]) {
      expect(text, s).toContain(s);
    }
    expect(html).toContain('<b class="font-medium text-fg">Tap a card</b> to edit it');
    expectNoThai(html);
  });

  it("เส้นจากปุ่ม (ปุ่มไม่มีชื่อ)", () => {
    const step = d.steps[0];
    const button = step.buttons[0];
    const unnamed: BuilderDoc = { ...d, steps: d.steps.map((s) => (s.id === step.id ? { ...s, buttons: [{ ...button, title: " " }] } : s)) };
    const html = render(
      createElement(OverviewPanel, {
        ...props,
        doc: unnamed,
        numbers: stepNumbers(unnamed),
        selection: { kind: "edge", from: { kind: "button", stepId: step.id, buttonId: button.id } },
      }),
      "en",
    );
    expect(textOf(html)).toContain('"Untitled" button on message #1 → message #2');
    const th = textOf(
      render(
        createElement(OverviewPanel, {
          ...props,
          doc: unnamed,
          numbers: stepNumbers(unnamed),
          selection: { kind: "edge", from: { kind: "button", stepId: step.id, buttonId: button.id } },
        }),
      ),
    );
    expect(th).toContain('ปุ่ม "ไม่มีชื่อ" ของข้อความ #1 → ข้อความ #2');
  });

  it("ภาษาไทยเหมือนเดิม", () => {
    const text = textOf(render(createElement(OverviewPanel, props)));
    for (const s of ['การ์ด "เมื่อ…" → ข้อความ #1', "ครบแล้ว พร้อมบันทึก", "ทำงาน 1,234 ครั้ง", "แตะการ์ด เพื่อแก้ไข", 'ตั้งค่าเงื่อนไข (การ์ด "เมื่อ…")']) {
      expect(text, s).toContain(s);
    }
  });
});

describe("แผงเงื่อนไข (การ์ด “เมื่อ…”)", () => {
  const props = { dispatch: noop, problems: [], recentPosts: POSTS, postsError: null };

  it("คอมเมนต์ + โพสต์ที่เลือก: ภาษาอังกฤษ", () => {
    const html = render(createElement(TriggerPanel, { ...props, doc: doc({ postScope: "specific", postIds: ["P1"] }) }), "en");
    const text = textOf(html);
    for (const s of [
      "Runs when",
      "Someone comments",
      "Someone messages you",
      "Platforms",
      "Keywords to watch for",
      "Contains",
      "Exact match",
      "Everything",
      "Runs when a comment contains any of the keywords.",
      "Keywords",
      "Public reply",
      "Add version",
      "Picks from 2 at random",
      "No repeat DMs",
      "Reply to each person once per post",
      "Advanced",
      "Priority",
      "Which posts or reels?",
      "Selected posts or reels",
      "Your next post or reel",
      "All posts and reels",
      "Tap to select (you can pick several)",
      "Selected: 1",
      "Show all (8)",
      "Reel",
      "Video",
      "(no caption)",
      "Oct 13, 2:05 PM",
      "Enter IDs yourself",
    ]) {
      expect(text, s).toContain(s);
    }
    expect(attrs(html, "aria-label")).toEqual(expect.arrayContaining(["Runs when", "Reply version 1", "Delete reply version 2", "Which posts or reels?"]));
    expect(attrs(html, "placeholder")).toEqual(expect.arrayContaining(["e.g. interested, price, link", "e.g. 1234567890_987654321"]));
    expectNoThai(html);
  });

  it("แชท / ตรงทั้งหมด / ทุกข้อความ", () => {
    const dm = (matchType: BuilderDoc["matchType"]) => textOf(render(createElement(TriggerPanel, { ...props, doc: doc({ trigger: "dm", matchType }) }), "en"));
    expect(dm("contains")).toContain("Runs when a message contains any of the keywords.");
    expect(dm("exact")).toContain("Runs only when the whole text matches one of the keywords exactly.");
    expect(dm("any")).toContain("Runs on every message. No keywords needed.");
    expect(textOf(render(createElement(TriggerPanel, { ...props, doc: doc({ matchType: "any" }) }), "en"))).toContain("Runs on every comment.");
  });

  it("ดึงโพสต์ไม่ได้ / ไม่มีโพสต์", () => {
    const failed = textOf(render(createElement(TriggerPanel, { ...props, recentPosts: [], postsError: "Token expired", doc: doc({ postScope: "specific" }) }), "en"));
    expect(failed).toContain("Can't load your recent posts right now");
    expect(failed).toContain("You can enter post IDs below, or try refreshing this page.");
    const empty = textOf(render(createElement(TriggerPanel, { ...props, recentPosts: [], doc: doc({ postScope: "specific" }) }), "en"));
    expect(empty).toContain("No recent posts found.");
    expect(empty).toContain("Post or reel IDs");
  });

  it("โพสต์ถัดไป: ทุกสถานะเป็นภาษาอังกฤษ", () => {
    const next = (patch: Partial<BuilderDoc>) => render(createElement(TriggerPanel, { ...props, doc: doc({ postScope: "next", ...patch }) }), "en");

    const start = textOf(next({}));
    expect(start).toContain("Starts counting after you save");
    expect(start).toContain("Posts or reels published before then won't use this automation.");

    const rearm = textOf(next({ rearmNext: true }));
    expect(rearm).toContain("Will start over when you save");
    expect(rearm).toContain("Undo");

    const waiting = textOf(next({ nextPostSince: "2026-10-13T07:05:00Z" }));
    expect(waiting).toContain("Waiting for a new post since Oct 13, 2:05 PM");
    expect(waiting).toContain("Start over with the next post");

    const boundHtml = next({
      nextPostSince: "2026-10-13T07:05:00Z",
      boundPosts: { instagram: { id: "P1", boundAt: "2026-10-13T08:00:00Z" } },
    });
    const bound = textOf(boundHtml);
    expect(bound).toContain("Linked");
    // ฝั่งเซิร์ฟเวอร์ (ยังไม่รู้เวลาปัจจุบันของเบราว์เซอร์) แสดงเป็นวันที่
    expect(bound).toContain("Linked on Oct 13, 3:00 PM");
    expect(bound).toContain("Since Oct 13, 2:05 PM");
    expect(bound).toContain("Clears the linked post");
    expect(attrs(boundHtml, "aria-label")).toContain("Open the post on Instagram");
    for (const html of [next({}), next({ rearmNext: true }), boundHtml]) expectNoThai(html);
  });

  it("ภาษาไทยเหมือนเดิม", () => {
    const comment = textOf(render(createElement(TriggerPanel, { ...props, doc: doc({ postScope: "specific", postIds: ["P1"] }) })));
    for (const s of [
      "ทำงานเมื่อ",
      'ทำงานเมื่อคอมเมนต์มีคำใดคำหนึ่งอยู่ เช่น "สนใจค่ะ" ก็นับคำว่า "สนใจ"',
      "สุ่ม 2 แบบ",
      "เลือกแล้ว 1",
      "ดูทั้งหมด 8 รายการ",
      "รีล",
      "วิดีโอ",
      "(ไม่มีข้อความ)",
    ]) {
      expect(comment, s).toContain(s);
    }
    const bound = textOf(
      render(
        createElement(TriggerPanel, {
          ...props,
          doc: doc({ postScope: "next", nextPostSince: "2026-10-13T07:05:00Z", boundPosts: { instagram: { id: "P1", boundAt: "2026-10-13T08:00:00Z" } } }),
        }),
      ),
    );
    expect(bound).toContain("ผูกเมื่อ 13 ต.ค. 15:00");
    expect(bound).toContain("ตั้งแต่ 13 ต.ค. 14:05");
    expect(bound).toContain("ผูกแล้ว");
  });
});

describe("ข้อความหมวด rules", () => {
  it("ใช้คำว่า Automation ไม่ใช้ rule ในภาษาอังกฤษ", () => {
    for (const [key, en] of Object.entries(rulesMessages.en)) expect(en.replace(/\{\w+\}/g, ""), key).not.toMatch(/\brules?\b/i);
  });
});
