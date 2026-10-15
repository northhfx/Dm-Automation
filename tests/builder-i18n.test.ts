import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, createRef, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { eq } from "drizzle-orm";
import { rules } from "@/db/schema";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";
import type { FlowStep } from "@/lib/flows/types";
import { systemMessage } from "@/lib/i18n/system";
import type { StepStats } from "@/lib/stats";
import { createRule, resetDatabase } from "./helpers";

/*
 * ตัวสร้างกฎแบบแผนผัง (การ์ด / แผนผัง / แผงข้อความ / ทั้งหน้า) + ข้อความ error ตอนตรวจและบันทึกกฎ
 * แสดงเป็นภาษาอังกฤษได้ครบ (ไม่มีตัวอักษรไทยหลง) และภาษาไทยยังเหมือนเดิม
 * (ข้อความในกฎเป็นภาษาอังกฤษ เพื่อให้ตรวจได้ว่าไม่มีภาษาไทยหลงจากตัวโปรแกรม)
 */

const lang = vi.hoisted(() => ({ value: undefined as string | undefined }));

// คุกกี้ภาษาของคำขอ (Server Action อ่านผ่าน cookies() ของ Next)
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "lang" && lang.value ? { name, value: lang.value } : undefined) }),
}));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => {} }));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));

const model = await import("@/app/(dashboard)/rules/builder/model");
const { TriggerNode, MessageNode } = await import("@/app/(dashboard)/rules/builder/nodes");
const { MessagePanel } = await import("@/app/(dashboard)/rules/builder/message-panel");
const { TriggerPanel } = await import("@/app/(dashboard)/rules/builder/trigger-panel");
const { FlowCanvas } = await import("@/app/(dashboard)/rules/builder/canvas");
type CanvasApi = import("@/app/(dashboard)/rules/builder/canvas").CanvasApi;
const { ChipInput } = await import("@/app/(dashboard)/rules/builder/widgets");
const { RuleBuilder } = await import("@/app/(dashboard)/rules/builder/rule-builder");
const { validateSteps } = await import("@/lib/flows/validate");
const { invalidPostIdMessage } = await import("@/lib/rules/post-scope");
const { validateRule } = await import("@/app/(dashboard)/rules/form-values");
const { ruleTemplate } = await import("@/app/(dashboard)/rules/templates");
const { saveRule, duplicateRule } = await import("@/app/(dashboard)/rules/actions");

type RuleFormValues = ComponentProps<typeof RuleBuilder>["initial"];
type BuilderDoc = ReturnType<typeof model.createInitialState>["doc"];

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
  return [...html.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((m) =>
    m[1].replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&"),
  );
}

const THAI = /[฀-๿]/;

/** ไม่มีตัวอักษรไทยหลงในข้อความหรือแอตทริบิวต์ที่ผู้ใช้เห็น/โปรแกรมอ่านหน้าจออ่าน */
function expectNoThai(html: string) {
  expect(textOf(html)).not.toMatch(THAI);
  for (const name of ["aria-label", "title", "placeholder"]) {
    for (const value of attrs(html, name)) expect(value, `${name}="${value}"`).not.toMatch(THAI);
  }
}

function expectAll(text: string, expected: string[]) {
  for (const s of expected) expect(text, s).toContain(s);
}

// ---------- ข้อมูลตัวอย่าง ----------

const STEPS: FlowStep[] = [
  {
    id: "s1",
    text: "Hi {name}, want the details?",
    buttons: [
      { id: "b1", title: "Yes please", type: "next", nextStepId: "s2" },
      { id: "b3", title: "", type: "next", nextStepId: "" },
    ],
  },
  { id: "s2", text: "Here you go", buttons: [{ id: "b2", title: "Open", type: "link", url: "https://shop.example.com" }] },
  { id: "s3", text: "", buttons: [] },
];

const base: RuleFormValues = {
  ...ruleTemplate("comment"),
  name: "Price comment",
  keywords: "price\ninfo",
  publicReplies: "Sent!\nCheck your DMs",
  postScope: "specific",
  postIds: ["P1", "P2"],
  steps: STEPS,
};

function docOf(patch: Partial<RuleFormValues> = {}, docPatch: Partial<BuilderDoc> = {}): BuilderDoc {
  return { ...model.createInitialState({ ...base, ...patch }, ["P1", "P2"]).doc, ...docPatch };
}

const STAT = { sent: 1234, reached: 1000, engaged: 123 } as StepStats;
const noop = () => {};

// ---------- การ์ด "เมื่อ…" ----------

describe("การ์ด “เมื่อ…” บนแผนผัง", () => {
  const trigger = (doc: BuilderDoc, o: { problem?: boolean; showErrors?: boolean; locale?: Locale } = {}) =>
    render(
      createElement(TriggerNode, { doc, selected: false, problem: o.problem ?? false, showErrors: o.showErrors ?? false, onMeasure: noop }),
      "locale" in o ? o.locale : "en",
    );

  it("คอมเมนต์ + โพสต์ที่เลือก", () => {
    const html = trigger(docOf());
    expectAll(textOf(html), [
      "When…",
      "Someone comments on a post",
      "Facebook",
      "Instagram",
      "Contains",
      "price",
      "Selected posts/reels (2)",
      "Public reply (picks 1 of 2)",
      "Then send",
    ]);
    expect(attrs(html, "aria-label")).toEqual(expect.arrayContaining(['"When…" card', '"Then send" dot. Drag it to the first message.']));
    expect(attrs(html, "title")).toContain("Drag to another card to change it · Tap to select the line");
    expectNoThai(html);
  });

  it("ป้ายสิ่งที่ยังไม่ครบ + ทุกแบบของโพสต์/เงื่อนไข", () => {
    expect(textOf(trigger(docOf(), { problem: true }))).toContain("Not finished");
    expect(textOf(trigger(docOf(), { problem: true, showErrors: true }))).toContain("Needs fixing");

    const since = "2026-10-01T00:00:00Z";
    const cases: [BuilderDoc, string[]][] = [
      [docOf({ postIds: [] }), ["No posts or reels picked yet"]],
      [docOf({ postScope: "next", postIds: [] }), ["Next post or reel", "Starts counting after you save"]],
      [docOf({ postScope: "next", postIds: [], nextPostSince: since }), ["Waiting for a new post"]],
      [docOf({ postScope: "next", postIds: [], nextPostSince: since }, { rearmNext: true }), ["Starts over after you save"]],
      [
        docOf({ postScope: "next", postIds: [], nextPostSince: since, boundPosts: { facebook: { id: "X", boundAt: since } } }),
        ["Linked", "waiting", "Instagram"],
      ],
      [docOf({ postScope: "any", postIds: [] }), ["All posts and reels"]],
      [docOf({ matchType: "exact", keywords: "", publicReplies: "" }), ["Text is exactly", "No keywords yet", "No public reply"]],
      [
        docOf({ trigger: "dm", matchType: "any", keywords: "", platforms: [] }, { startStepId: null }),
        ["Someone sends you a DM", "Everything (no keywords needed)", "No platform picked yet", "No first message yet"],
      ],
    ];
    for (const [doc, expected] of cases) {
      const html = trigger(doc, { problem: true });
      expectAll(textOf(html), expected);
      expectNoThai(html);
    }
    // ยังไม่ได้เชื่อมข้อความแรก → จุดต่อบอกให้ลากไปสร้าง/เชื่อม
    expect(attrs(trigger(docOf({}, { startStepId: null })), "title")).toContain(
      "Drag to create or connect the next message · Tap to create a new message",
    );
  });

  it("ภาษาไทย (ไม่มี Provider) เหมือนเดิม", () => {
    const text = textOf(trigger(docOf(), { problem: true, locale: undefined as never }));
    expectAll(text, ["เมื่อ…", "ยังไม่ครบ", "มีคนคอมเมนต์ใต้โพสต์", "มีคำว่า", "โพสต์/รีลที่เลือก (2)", "ตอบใต้คอมเมนต์ 2 แบบ (สุ่ม)", "แล้วส่ง"]);
  });
});

// ---------- การ์ดข้อความ ----------

describe("การ์ดข้อความบนแผนผัง", () => {
  const doc = docOf();
  const numbers = model.stepNumbers(doc);
  const stepIds = new Set(doc.steps.map((s) => s.id));

  function node(stepIndex: number, o: { error?: string; unreachable?: boolean; selected?: boolean; locale?: Locale } = {}) {
    const step = doc.steps[stepIndex];
    return render(
      createElement(MessageNode, {
        step,
        number: numbers.get(step.id)!,
        isStart: doc.startStepId === step.id,
        x: 0,
        y: 0,
        selected: o.selected ?? false,
        dropTarget: false,
        linking: false,
        unreachable: o.unreachable ?? false,
        error: o.error,
        showErrors: true,
        stat: STAT,
        stepIds,
        zoom: 1,
        onMeasure: noop,
        onEdit: noop,
        onDuplicate: noop,
        onDelete: noop,
      }),
      "locale" in o ? o.locale : "en",
    );
  }

  it("ภาษาอังกฤษ: หัวการ์ด ชิปชื่อลูกค้า ปุ่ม สถิติ และแถบเครื่องมือ", () => {
    const html = node(0, { selected: true });
    expectAll(textOf(html), [
      "Send message",
      "First message",
      "Hi Customer name , want the details?",
      "Yes please",
      "Button name",
      "Sent: 1,234",
      "Click rate: 12%",
      "Edit",
      "Duplicate",
      "Delete",
    ]);
    expect(attrs(html, "aria-label")).toEqual(
      expect.arrayContaining(["Message #1", "Card actions", "Connection dot for button Yes please", "Connection dot for button Untitled"]),
    );
    expect(attrs(html, "title")).toContain("Drag to another card to change it · Tap to select the line");
    expectNoThai(html);
  });

  it("ปุ่มเปิดลิงก์ / ข้อความว่าง / ปัญหาที่ต้องแก้ / ยังไม่ได้เชื่อม", () => {
    const link = node(1);
    expect(attrs(link, "aria-label")).toContain("Opens a link");
    expectNoThai(link);

    const problem = model.findProblems(doc, "en").find((p) => p.key === "step:s1")!;
    const html = node(2, { error: problem.message, unreachable: true });
    expectAll(textOf(html), ["No text yet. Tap to type.", "Not connected, so it won't be sent"]);
    expectNoThai(html);

    // มีข้อความแล้วแต่ยังมีปัญหา → แสดงปัญหาบนการ์ด (ทั้งข้อความ)
    const withError = node(0, { error: problem.message });
    expect(textOf(withError)).toContain('Message #1, button 2: Give the button a name');
    expectNoThai(withError);
  });

  it("ภาษาไทยเหมือนเดิม", () => {
    const text = textOf(node(0, { selected: true, locale: undefined as never }));
    expectAll(text, ["ส่งข้อความ", "ข้อความแรก", "ชื่อลูกค้า", "ชื่อปุ่ม", "ส่ง 1,234 ครั้ง", "อัตราการกด 12%", "แก้ไข", "ทำสำเนา", "ลบ"]);
    expect(textOf(node(2, { unreachable: true, locale: undefined as never }))).toContain("ยังไม่ได้เชื่อม — จะไม่ถูกส่ง");
  });
});

// ---------- แผงข้อความ ----------

describe("แผงข้อความ (เลือกการ์ดข้อความ)", () => {
  const doc = docOf();
  const numbers = model.stepNumbers(doc);

  function panel(step: FlowStep, o: { doc?: BuilderDoc; unreachable?: boolean; withProblem?: boolean; locale?: Locale } = {}) {
    const d = o.doc ?? doc;
    const problem = o.withProblem ? model.findProblems(d, o.locale ?? "th").find((p) => p.key === `step:${step.id}`) : undefined;
    return render(
      createElement(MessagePanel, {
        doc: d,
        step,
        numbers,
        problem,
        unreachable: o.unreachable ?? false,
        showErrors: true,
        stat: STAT,
        dispatch: noop,
        onCreateFrom: noop,
        onDuplicate: noop,
        onDelete: noop,
      }),
      o.locale,
    );
  }

  it("ภาษาอังกฤษ: ช่องข้อความ ตัวอย่างแชท ปุ่ม สถิติ และการจัดการการ์ด", () => {
    const html = panel(doc.steps[0], { withProblem: true, locale: "en" });
    const text = textOf(html);
    expectAll(text, [
      "Message #1, button 2: Give the button a name",
      "Message to send",
      "{name} is replaced with the customer's name (counted as 30 characters)",
      "Insert customer name",
      "What your customer sees",
      "Hi Mint, want the details?",
      "Shop",
      'Preview with the customer name "Mint"',
      "Buttons (2/3)",
      "A 'Send next message' button leads to the next message.",
      "Button 1",
      "Button 2",
      "Button name",
      "Send next message",
      "Open link",
      "Which message to send",
      "— Pick a message —",
      "#2 · Here you go",
      "#3 · (no text yet)",
      "+ New message",
      "Add button",
      "Stats for this message",
      "Counted since it started",
      "Sent 1,234 total",
      "Tapped 123 of 1,000 reached",
      "Click rate 12% of people reached",
      "Card actions",
      "Duplicate",
      "Delete card",
      'This message is sent as soon as the automation runs (the "When…" card connects here).',
    ]);
    expect(attrs(html, "aria-label")).toEqual(expect.arrayContaining(["Move up", "Move down", "Delete button 1", "When tapped"]));
    expect(attrs(html, "placeholder")).toEqual(expect.arrayContaining(["Type the message your customer will get…", "e.g. Yes, I'm interested!"]));
    expectNoThai(html);
  });

  it("ปุ่มเปิดลิงก์ / ปุ่มเต็ม / ข้อความที่ยังไม่ได้เชื่อม", () => {
    const step: FlowStep = {
      id: "s2",
      text: "Here you go",
      buttons: [
        { id: "b2", title: "Open", type: "link", url: "shop.example.com" },
        { id: "b4", title: "A", type: "link", url: "https://a.example.com" },
        { id: "b5", title: "B", type: "link", url: "https://b.example.com" },
      ],
    };
    const d = { ...doc, steps: doc.steps.map((s) => (s.id === "s2" ? step : s)) };
    const html = panel(step, { doc: d, unreachable: true, locale: "en" });
    expectAll(textOf(html), [
      "Messages with buttons can be up to 640 characters",
      "Link",
      "Links must start with https:// or http://",
      "We turn it into a tracked link automatically, so you can count clicks",
      "Up to 3 buttons",
      "No button leads to this message, so it won't be sent.",
      'or tap "Make it the first message".',
      "Make it the first message",
    ]);
    expectNoThai(html);

    const noStart = panel(doc.steps[2], { doc: { ...doc, startStepId: null }, unreachable: true, locale: "en" });
    expectAll(textOf(noStart), [
      'The "When…" card isn\'t connected to any message yet. Tap "Make it the first message" if you want this message sent first.',
      "No buttons yet",
      "No text yet",
    ]);
    expectNoThai(noStart);
  });

  it("ภาษาไทยเหมือนเดิม", () => {
    const text = textOf(panel(doc.steps[0], { withProblem: true }));
    expectAll(text, [
      "ข้อความ #1 ปุ่มที่ 2: ยังไม่ได้ตั้งชื่อปุ่ม",
      "ข้อความที่จะส่ง",
      "{name} จะถูกแทนด้วยชื่อลูกค้า (นับเผื่อ 30 ตัวอักษร)",
      "ตัวอย่างโดยใช้ชื่อลูกค้า \"มิ้นท์\"",
      "ปุ่ม (2/3)",
      "ปุ่ม 'ส่งข้อความต่อ' พาไปข้อความถัดไป",
      "#3 · (ยังไม่มีข้อความ)",
      "คนกด 123 จาก 1,000 คน",
      "ข้อความนี้ส่งทันทีเมื่อกฎทำงาน (การ์ด \"เมื่อ…\" เชื่อมมาที่นี่)",
    ]);
    expect(textOf(panel(doc.steps[2], { doc: { ...doc, startStepId: null }, unreachable: true }))).toContain(
      'การ์ด "เมื่อ…" ยังไม่ได้เชื่อมกับข้อความไหน — กด "ตั้งเป็นข้อความแรก" ถ้าอยากให้ส่งข้อความนี้ก่อน',
    );
  });
});

// ---------- แผนผัง / ช่องใส่คำ ----------

describe("แผนผังและแถบเครื่องมือ", () => {
  const doc = docOf();
  const canvas = (locale?: Locale) =>
    render(
      createElement(FlowCanvas, {
        apiRef: createRef<CanvasApi>(),
        doc,
        selection: { kind: "edge", from: { kind: "trigger" } },
        sizes: {},
        numbers: model.stepNumbers(doc),
        stepErrors: new Map<string, string>(),
        unreachable: new Set<string>(),
        triggerProblem: false,
        showErrors: false,
        ready: true,
        canUndo: true,
        canRedo: false,
        canAdd: false,
        bottomInset: 0,
        dispatch: noop,
        onMeasure: noop,
        onNodeTap: noop,
        onEdit: noop,
        onDuplicate: noop,
        onDelete: noop,
        onCreate: noop,
      }),
      locale,
    );

  it("ภาษาอังกฤษ", () => {
    const html = canvas("en");
    expect(textOf(html)).toContain("Add message");
    expect(attrs(html, "aria-label")).toEqual(
      expect.arrayContaining([
        "Message map. Drag empty space to move around, or drag the dot next to a button to connect messages.",
        "Undo (Ctrl+Z)",
        "Redo (Ctrl+Shift+Z)",
        "Zoom out",
        "Zoom in",
        "Fit to screen",
        "Tidy up cards",
      ]),
    );
    expect(attrs(html, "title")).toEqual(expect.arrayContaining(["Back to 100%", "You can add up to 20 messages per automation"]));
    expectNoThai(html);
  });

  it("ภาษาไทยเหมือนเดิม", () => {
    const html = canvas();
    expect(textOf(html)).toContain("เพิ่มข้อความ");
    expect(attrs(html, "title")).toEqual(expect.arrayContaining(["กลับไปขนาด 100%", "ใส่ข้อความได้สูงสุด 20 ข้อความต่อกฎ"]));
  });

  it("ช่องใส่คำแบบชิป", () => {
    const props = { values: ["price", "info"], onChange: noop, placeholder: "x" };
    expect(attrs(render(createElement(ChipInput, props), "en"), "aria-label")).toEqual(["Remove keyword price", "Remove keyword info"]);
    expect(attrs(render(createElement(ChipInput, props)), "aria-label")).toEqual(["ลบคำ price", "ลบคำ info"]);
  });
});

// ---------- ทั้งหน้า ----------

describe("หน้าตัวสร้างกฎทั้งหน้า", () => {
  const page = (initial: RuleFormValues, locale?: Locale) =>
    render(
      createElement(RuleBuilder, {
        initial,
        recentPosts: [],
        postsError: null,
        stepStats: { s1: STAT },
        ruleStats: { triggers: 5, sent: 4, ctr: 10 },
      }),
      locale,
    );
  const ok: RuleFormValues = { ...base, id: 7, postScope: "any", postIds: [], steps: [STEPS[1]] };

  it("ภาษาอังกฤษ: แผงภาพรวม แถบล่างบนมือถือ และปุ่มแผง", () => {
    const html = page({ ...base, id: 7 }, "en");
    expectAll(textOf(html), ["Overview", "Overview and things to fix", "Steps left before saving: 2", "Add message"]);
    expect(attrs(html, "aria-label")).toEqual(expect.arrayContaining(["Overview", "Hide panel", "Close panel"]));
    expectNoThai(html);

    expect(textOf(page(ok, "en"))).toContain("Saved");
    expect(textOf(page({ ...ok, id: undefined }, "en"))).toContain("All set. Ready to save.");
  });

  it("ภาษาไทยเหมือนเดิม", () => {
    expectAll(textOf(page({ ...base, id: 7 })), ["ภาพรวม", "ภาพรวมและสิ่งที่ต้องแก้", "เหลืออีก 2 ขั้นก่อนบันทึก"]);
    expect(textOf(page({ ...ok, id: undefined }))).toContain("ครบแล้ว พร้อมบันทึก");
  });
});

describe("แผงเงื่อนไข (เลือกการ์ด “เมื่อ…”)", () => {
  it("ดึงโพสต์ล่าสุดไม่สำเร็จ: สาเหตุที่เป็นข้อความของระบบแสดงตามภาษา", () => {
    const postsError = systemMessage("graphUnreachable", { detail: "fetch failed" });
    const panel = (locale?: Locale) =>
      render(createElement(TriggerPanel, { doc: docOf(), dispatch: noop, problems: [], recentPosts: [], postsError }), locale);
    const en = panel("en");
    expectNoThai(en);
    expect(textOf(en)).toContain("Couldn't reach the Graph API: fetch failed");
    expect(textOf(panel())).toContain(postsError);
  });
});

// ---------- ข้อความ error ตอนตรวจ / บันทึก ----------

describe("ข้อความ error ตอนตรวจข้อความ (validateSteps)", () => {
  const go = { id: "s1", text: "Hi", buttons: [{ id: "b1", title: "Go", type: "next", nextStepId: "s1" }] };
  const open = { id: "s1", text: "Hi", buttons: [{ id: "b1", title: "Open", type: "link", url: "shop.example.com" }] };
  const cases: [unknown, string, string][] = [
    [[], "Add at least 1 message", "ต้องมีข้อความอย่างน้อย 1 ข้อความ"],
    [
      Array.from({ length: 21 }, (_, i) => ({ id: `s${i}`, text: "a", buttons: [] })),
      "You can add up to 20 messages per automation",
      "ใส่ข้อความได้สูงสุด 20 ข้อความต่อกฎ",
    ],
    [[{ id: "bad id", text: "a", buttons: [] }], "Something's wrong with the message data. Refresh the page and try again.", "ข้อมูลข้อความไม่ถูกต้อง ลองรีเฟรชหน้าแล้วแก้ใหม่"],
    [[{ id: "s1", text: " ", buttons: [] }], "Message #1: No text yet", "ข้อความที่ 1: ยังไม่ได้ใส่ข้อความ"],
    // ลิมิตไม่มีตัวคั่นหลักพัน (เหมือนข้อความเดิม)
    [[{ id: "s1", text: "a".repeat(1001), buttons: [] }], "Message #1: Over 1000 characters", "ข้อความที่ 1: ยาวเกิน 1000 ตัวอักษร"],
    [
      [{ id: "s1", text: "{name}" + "a".repeat(980), buttons: [] }],
      "Message #1: Over 1000 characters (counting {name} as 30 characters)",
      "ข้อความที่ 1: ยาวเกิน 1000 ตัวอักษร (โดยนับ {name} เผื่อเป็น 30 ตัวอักษร)",
    ],
    [
      [{ ...open, text: "a".repeat(641), buttons: [{ ...open.buttons[0], url: "https://x.com" }] }],
      "Message #1: Over 640 characters (messages with buttons can have up to 640)",
      "ข้อความที่ 1: ยาวเกิน 640 ตัวอักษร (ข้อความที่มีปุ่มส่งได้ไม่เกิน 640 ตัวอักษร)",
    ],
    [
      [{ ...open, text: "{name}" + "a".repeat(620), buttons: [{ ...open.buttons[0], url: "https://x.com" }] }],
      "Message #1: Over 640 characters (messages with buttons can have up to 640, counting {name} as 30 characters)",
      "ข้อความที่ 1: ยาวเกิน 640 ตัวอักษร (ข้อความที่มีปุ่มส่งได้ไม่เกิน 640 ตัวอักษร โดยนับ {name} เผื่อเป็น 30 ตัวอักษร)",
    ],
    [
      [{ id: "s1", text: "a", buttons: [1, 2, 3, 4].map((n) => ({ id: `b${n}`, title: "t", type: "link", url: "https://x.com" })) }],
      "Message #1: You can add up to 3 buttons",
      "ข้อความที่ 1: ใส่ปุ่มได้สูงสุด 3 ปุ่ม",
    ],
    [[{ ...open, buttons: [{ ...open.buttons[0], title: "" }] }], "Message #1, button 1: Give the button a name", "ข้อความที่ 1 ปุ่มที่ 1: ยังไม่ได้ตั้งชื่อปุ่ม"],
    [
      [{ ...open, buttons: [{ ...open.buttons[0], title: "x".repeat(21) }] }],
      "Message #1, button 1: Button names can be up to 20 characters",
      "ข้อความที่ 1 ปุ่มที่ 1: ชื่อปุ่มยาวได้ไม่เกิน 20 ตัวอักษร",
    ],
    [[open], 'Message #1, button 1 ("Open"): Add a link that starts with https://', 'ข้อความที่ 1 ปุ่มที่ 1 ("Open"): ใส่ลิงก์ที่ขึ้นต้นด้วย https://'],
    [
      [go],
      'Message #1, button 1 ("Go"): Choose which message it sends when tapped (or make it a link button)',
      'ข้อความที่ 1 ปุ่มที่ 1 ("Go"): ยังไม่ได้เชื่อมว่ากดแล้วให้ส่งข้อความไหน (หรือเปลี่ยนเป็นปุ่มเปิดลิงก์)',
    ],
  ];

  it.each(cases)("%#", (input, en, th) => {
    expect(validateSteps(input, { locale: "en" })).toMatchObject({ ok: false, error: en });
    expect(validateSteps(input)).toMatchObject({ ok: false, error: th });
  });
});

describe("สิ่งที่ต้องแก้ก่อนบันทึก (findProblems) และการตรวจตอนบันทึก (validateRule)", () => {
  it("findProblems ภาษาอังกฤษ ครบทุกแบบ ไม่มีภาษาไทยหลง", () => {
    const doc = docOf({ name: "", platforms: [], keywords: "" }, { startStepId: null });
    const problems = model.findProblems(doc, "en");
    const byKey = Object.fromEntries(problems.map((p) => [p.key, p.message]));
    expect(byKey).toMatchObject({
      name: "Name this automation (so you remember what it does)",
      platforms: "Pick at least 1 platform (Facebook or Instagram)",
      keywords: "Add at least 1 keyword (or choose 'Everything')",
      start: 'The "When…" card isn\'t connected to a first message yet. Drag a line from its "Then send" dot to a message card.',
      "step:s1": "Message #1, button 2: Give the button a name",
    });
    const more = model.findProblems(
      docOf({ name: "x".repeat(101), keywords: "y".repeat(101), postIds: [] }, { publicReplies: ["z".repeat(501)], postIdsManual: "https://x.com/p/1" }),
      "en",
    );
    expect(more.map((p) => p.message)).toEqual(
      expect.arrayContaining([
        "The automation name is over 100 characters",
        "Keywords can be up to 100 characters",
        "A public reply is over 500 characters",
        "Enter the post ID, not a link. Or pick from your recent posts above.",
        "Message #3 isn't connected, so it won't be sent",
      ]),
    );
    expect(model.findProblems(docOf({ postIds: [] }), "en").find((p) => p.key === "posts")?.message).toBe("Pick at least 1 post or reel");
    for (const p of [...problems, ...more]) expect(p.message).not.toMatch(THAI);
    expect(invalidPostIdMessage("en")).toBe("Enter the post ID, not a link. Or pick from your recent posts above.");
  });

  it("findProblems ภาษาไทย (ค่าเริ่มต้น) เหมือนเดิม", () => {
    const problems = model.findProblems(docOf({ name: "" }));
    expect(problems.map((p) => p.message)).toEqual(
      expect.arrayContaining(["ตั้งชื่อกฎ (ไว้ดูเองว่ากฎนี้ทำอะไร)", "ข้อความ #1 ปุ่มที่ 2: ยังไม่ได้ตั้งชื่อปุ่ม", "ข้อความ #3 ยังไม่ได้เชื่อม — จะไม่ถูกส่ง"]),
    );
    expect(invalidPostIdMessage()).toBe("ใส่ ID ของโพสต์ ไม่ใช่ลิงก์ — เลือกจากรายการโพสต์ล่าสุดด้านบนแทนได้");
  });

  it("validateRule ภาษาอังกฤษ", () => {
    const good: FlowStep[] = [{ id: "s1", text: "Hi", buttons: [] }];
    const values = (patch: Partial<RuleFormValues>): RuleFormValues => ({ ...base, postScope: "any", postIds: [], steps: good, ...patch });
    const cases: [Partial<RuleFormValues>, string, string][] = [
      [{ name: "" }, "Please name this automation", "กรุณาตั้งชื่อกฎ"],
      [{ name: "x".repeat(101) }, "The automation name is too long", "ชื่อกฎยาวเกินไป"],
      [{ platforms: [] }, "Pick at least 1 platform", "เลือกอย่างน้อย 1 แพลตฟอร์ม"],
      [{ postScope: "specific", postIds: ["x".repeat(101)] }, "A post ID is too long", "ID โพสต์ยาวเกินไป"],
      [{ publicReplies: "y".repeat(501) }, "A public reply is over 500 characters", "ข้อความตอบคอมเมนต์ยาวเกิน 500 ตัวอักษร"],
      [
        { postScope: "specific" },
        "Pick at least 1 post or reel (or switch to 'All posts and reels' or 'Your next post or reel')",
        "เลือกโพสต์หรือรีลอย่างน้อย 1 รายการ (หรือเปลี่ยนเป็น 'ทุกโพสต์และรีล' / 'โพสต์หรือรีลถัดไป')",
      ],
      [{ postScope: "specific", postIds: ["https://x.com/p"] }, "Enter the post ID, not a link. Or pick from your recent posts above.", "ใส่ ID ของโพสต์ ไม่ใช่ลิงก์"],
      [{ keywords: "" }, "Add at least 1 keyword (or choose 'Everything')", "ใส่คำที่ให้ระบบจับอย่างน้อย 1 คำ (หรือเลือก 'ทุกข้อความ')"],
      [
        { startStepId: "" },
        'The "When…" card isn\'t connected to the first message to send. Drag a line from its "Then send" dot to a message card.',
        'ยังไม่ได้เชื่อมการ์ด "เมื่อ…" กับข้อความแรกที่จะส่ง — ลากเส้นจากจุด "แล้วส่ง" ไปที่การ์ดข้อความ',
      ],
      [{ steps: [{ id: "s1", text: "", buttons: [] }] }, "Message #1: No text yet", "ข้อความที่ 1: ยังไม่ได้ใส่ข้อความ"],
    ];
    for (const [patch, en, th] of cases) {
      expect(validateRule(values(patch), "en"), en).toMatchObject({ ok: false, error: en });
      const thai = validateRule(values(patch));
      expect(thai.ok).toBe(false);
      if (!thai.ok) expect(thai.error, th).toContain(th);
    }
    expect(validateRule(values({}), "en").ok).toBe(true);
  });
});

// ---------- Server Action (คุกกี้ภาษา) ----------

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  const all: Record<string, string | string[]> = {
    name: "Edited",
    trigger: "comment",
    platforms: "facebook",
    matchType: "contains",
    keywords: "price",
    steps: JSON.stringify([{ id: "s1", text: "Hi", buttons: [] }]),
    active: "on",
    ...fields,
  };
  for (const [k, v] of Object.entries(all)) for (const x of [v].flat()) data.append(k, x);
  return data;
}

describe("Server Action ส่งข้อความ error ตามคุกกี้ภาษา", () => {
  beforeEach(() => {
    lang.value = undefined;
  });

  it("บันทึกไม่ผ่านการตรวจ: อังกฤษ / ไทย", async () => {
    lang.value = "en";
    expect(await saveRule({}, form({ keywords: "" }))).toMatchObject({ error: "Add at least 1 keyword (or choose 'Everything')", attempt: 1 });
    expect(await saveRule({}, form({ steps: JSON.stringify([{ id: "s1", text: "", buttons: [] }]) }))).toMatchObject({
      error: "Message #1: No text yet",
      errorStepId: "s1",
    });
    lang.value = "th";
    expect((await saveRule({}, form({ keywords: "" }))).error).toBe("ใส่คำที่ให้ระบบจับอย่างน้อย 1 คำ (หรือเลือก 'ทุกข้อความ')");
    lang.value = undefined;
    expect((await saveRule({}, form({ name: "" }))).error).toBe("กรุณาตั้งชื่อกฎ");
  });

  describe("ใช้ฐานข้อมูล", () => {
    beforeEach(async () => {
      await resetDatabase();
    });

    it("กฎถูกลบไปแล้ว → แจ้งตามภาษา", async () => {
      const db = await resetDatabase();
      const rule = await createRule();
      await db.delete(rules).where(eq(rules.id, rule.id));
      lang.value = "en";
      expect((await saveRule({}, form({ id: String(rule.id) }))).error).toBe(
        "This automation no longer exists (it may have been deleted). Copy your messages somewhere first, then create a new automation.",
      );
      lang.value = undefined;
      expect((await saveRule({}, form({ id: String(rule.id) }))).error).toContain("ไม่พบกฎนี้แล้ว");
    });

    it("ชื่อสำเนาตามภาษาที่ใช้ตอนกดทำสำเนา", async () => {
      const db = await resetDatabase();
      const rule = await createRule({ name: "Price comment" });
      const duplicate = async () => {
        const data = new FormData();
        data.set("id", String(rule.id));
        // redirect() ไปหน้าสำเนาโยน error ของ Next — ไม่สนใจ
        await duplicateRule(data).catch(() => {});
      };
      lang.value = "en";
      await duplicate();
      lang.value = undefined;
      await duplicate();
      const names = (await db.query.rules.findMany({ orderBy: (r, { asc }) => [asc(r.id)] })).map((r) => r.name);
      expect(names).toEqual(["Price comment", "Price comment (copy)", "Price comment (สำเนา)"]);
    });
  });
});
