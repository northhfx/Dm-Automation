/**
 * สมองของหน้าสร้าง/แก้กฎแบบแผนผัง (ไม่มี React — ทดสอบได้ใน tests/builder.test.ts)
 * เก็บทุกอย่างของกฎไว้ใน "doc" ก้อนเดียว + ประวัติสำหรับย้อนกลับ/ทำซ้ำ
 */
import type { BoundPosts, MatchType, Platform, PostScope, TriggerType } from "@/db/schema";
import { estimateStepHeight, layoutCanvas, type CanvasLayout, type NodeSize } from "@/lib/flows/layout";
import { FLOW_LIMITS, type CanvasPoint, type FlowButton, type FlowStep } from "@/lib/flows/types";
import { validateSteps } from "@/lib/flows/validate";
import type { RuleFormValues } from "../form-values";

/** id ของการ์ด "เมื่อ…" บนแผนผัง (มี @ จึงไม่มีทางชนกับ id ของข้อความ) */
export const TRIGGER_NODE = "@trigger";

export const CARD_WIDTH = 288;
export const TRIGGER_WIDTH = 272;
/** ระยะจากขอบบนของการ์ดข้อความถึงจุดรับเส้น (กลางหัวการ์ด) */
export const INPUT_HANDLE_Y = 26;

export type EdgeFrom = { kind: "trigger" } | { kind: "button"; stepId: string; buttonId: string };

export type Selection = null | { kind: "trigger" } | { kind: "step"; id: string } | { kind: "edge"; from: EdgeFrom };

export interface BuilderDoc {
  name: string;
  trigger: TriggerType;
  platforms: Platform[];
  matchType: MatchType;
  keywords: string[];
  /** กฎคอมเมนต์ใช้กับ: โพสต์/รีลที่เลือก, โพสต์/รีลถัดไป หรือทุกโพสต์/รีล */
  postScope: PostScope;
  /** กด "เริ่มรอโพสต์ถัดไปใหม่" แล้วยังไม่ได้บันทึก (คำสั่งครั้งเดียว — บันทึกแล้วล้างทิ้ง) */
  rearmNext: boolean;
  /** โพสต์ที่ติ๊กเลือกจากรายการโพสต์ล่าสุด (ใช้เมื่อ postScope = "specific") */
  postIds: string[];
  /** Post ID ที่พิมพ์เอง (คั่นด้วยบรรทัดใหม่/จุลภาค) */
  postIdsManual: string;
  /**
   * แสดงผลเท่านั้น (มาจากเซิร์ฟเวอร์ ไม่นับเป็นการแก้ไข — ดู docJson):
   * เริ่มรอโพสต์ถัดไปตั้งแต่เมื่อไหร่ (ISO) และโพสต์ที่กฎแบบ "โพสต์ถัดไป" ผูกไว้แล้วในแต่ละแพลตฟอร์ม
   */
  nextPostSince: string | null;
  boundPosts: BoundPosts;
  /** ข้อความตอบใต้คอมเมนต์ (สุ่มใช้) — ช่องว่างจะถูกตัดทิ้งตอนบันทึก */
  publicReplies: string[];
  oncePerUser: boolean;
  priority: number;
  active: boolean;
  /** ข้อความทั้งหมดตามลำดับที่สร้าง (เลขการ์ดอิงลำดับนี้) */
  steps: FlowStep[];
  /** ข้อความแรกที่การ์ด "เมื่อ…" เชื่อมไป (null = ยังไม่ได้เชื่อม) */
  startStepId: string | null;
  triggerPos: CanvasPoint;
  positions: Record<string, CanvasPoint>;
}

/** ค่าแสดงผลของกฎแบบ "โพสต์ถัดไป" ที่เซิร์ฟเวอร์ส่งกลับมาหลังบันทึก */
export type ScopeDisplay = Pick<BuilderDoc, "nextPostSince" | "boundPosts">;

export interface BuilderState {
  doc: BuilderDoc;
  past: BuilderDoc[];
  future: BuilderDoc[];
  /** ใช้รวมการพิมพ์ต่อเนื่อง/การลากครั้งเดียวให้ย้อนกลับได้ในครั้งเดียว */
  lastKey: string | null;
  lastAt: number;
  selection: Selection;
  /** doc ล่าสุดที่บันทึกแล้ว (ใช้บอกว่ามีการแก้ที่ยังไม่บันทึก) */
  savedJson: string;
  /** ตำแหน่งการ์ดถูกจัดอัตโนมัติจากขนาดประมาณ — ให้จัดใหม่อีกครั้งเมื่อวัดขนาดจริงได้ */
  autoPlaced: boolean;
}

export interface MeasuredNode extends NodeSize {
  /** ระยะจากขอบบนของการ์ดถึงจุดต่อเส้นขาออก แยกตาม id ของปุ่ม (การ์ด "เมื่อ…" ใช้ key "out") */
  handles: Record<string, number>;
}

export type Sizes = Record<string, MeasuredNode>;

const HISTORY_LIMIT = 100;
const COALESCE_MS = 1000;

/* ---------------------------------------------------------------- ตัวช่วยทั่วไป */

export function newId(prefix: "s" | "b"): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return prefix + random.replace(/-/g, "").slice(0, 10);
}

export const splitKeywords = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

const splitLines = (s: string) =>
  s
    .split(/\n/)
    .map((x) => x.trim())
    .filter(Boolean);

/** ค่าที่ใช้เทียบว่ามีการแก้ค้างไหม (ไม่รวมค่าที่แสดงผลอย่างเดียวจากเซิร์ฟเวอร์) */
export function docJson(doc: BuilderDoc): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ตัดค่าที่แสดงผลอย่างเดียวออก
  const { nextPostSince, boundPosts, ...editable } = doc;
  return JSON.stringify(editable);
}

export function isDirty(state: BuilderState): boolean {
  return docJson(state.doc) !== state.savedJson;
}

/* ---------------------------------------------------------------- สร้าง state เริ่มต้น */

export function createInitialState(values: RuleFormValues, knownPostIds: Iterable<string> = []): BuilderState {
  const known = new Set(knownPostIds);
  const steps = values.steps.length ? structuredClone(values.steps) : [{ id: "s1", text: "", buttons: [] }];
  const startStepId =
    values.startStepId !== undefined ? (steps.some((s) => s.id === values.startStepId) ? values.startStepId : null) : (steps[0]?.id ?? null);
  const canvas = values.canvas ?? {};
  const saved = canvas.steps ?? {};
  const hasAll = !!canvas.trigger && steps.every((s) => saved[s.id]);
  const hasAny = !!canvas.trigger || steps.some((s) => saved[s.id]);

  let triggerPos: CanvasPoint;
  let positions: Record<string, CanvasPoint>;
  if (hasAll) {
    triggerPos = { ...canvas.trigger! };
    positions = Object.fromEntries(steps.map((s) => [s.id, { ...saved[s.id] }]));
  } else {
    const auto = layoutCanvas(steps, { startStepId });
    if (hasAny) {
      // มีตำแหน่งบางส่วน: คงตำแหน่งเดิมไว้ แล้ววางการ์ดที่ขาดไว้ทางขวาสุด
      triggerPos = canvas.trigger ? { ...canvas.trigger } : auto.trigger;
      positions = {};
      const maxX = Math.max(triggerPos.x, ...Object.values(saved).map((p) => p.x));
      let y = 0;
      for (const s of steps) {
        if (saved[s.id]) positions[s.id] = { ...saved[s.id] };
        else {
          positions[s.id] = { x: maxX + 340, y };
          y += estimateStepHeight(s) + 40;
        }
      }
    } else {
      triggerPos = auto.trigger;
      positions = auto.steps;
    }
  }

  const doc: BuilderDoc = {
    name: values.name,
    trigger: values.trigger,
    platforms: [...values.platforms],
    matchType: values.matchType,
    keywords: splitKeywords(values.keywords),
    // ค่าจากฟอร์มรุ่นเก่าที่ไม่มี postScope: มีโพสต์ = เฉพาะที่เลือก
    postScope: values.postScope ?? (values.postIds.length ? "specific" : "any"),
    rearmNext: false,
    postIds: values.postIds.filter((id) => known.has(id)),
    postIdsManual: values.postIds.filter((id) => !known.has(id)).join("\n"),
    nextPostSince: values.nextPostSince ?? null,
    boundPosts: values.boundPosts ?? {},
    publicReplies: splitLines(values.publicReplies),
    oncePerUser: values.oncePerUser,
    priority: values.priority,
    active: values.active,
    steps,
    startStepId,
    triggerPos,
    positions,
  };
  return {
    doc,
    past: [],
    future: [],
    lastKey: null,
    lastAt: 0,
    selection: null,
    savedJson: docJson(doc),
    autoPlaced: !hasAny,
  };
}

/* ---------------------------------------------------------------- อ่านข้อมูลจาก doc */

/** ข้อความเรียงแบบที่บันทึก: ข้อความแรก (ที่ "เมื่อ…" เชื่อมไป) ก่อน แล้วตามด้วยที่เหลือตามลำดับเดิม */
export function orderedSteps(doc: BuilderDoc): FlowStep[] {
  const start = doc.steps.find((s) => s.id === doc.startStepId);
  return start ? [start, ...doc.steps.filter((s) => s !== start)] : doc.steps;
}

/** เลขการ์ด: ข้อความแรก = 1 ที่เหลือเรียงตามลำดับที่สร้าง (ลากย้ายแล้วเลขไม่เปลี่ยน) */
export function stepNumbers(doc: BuilderDoc): Map<string, number> {
  return new Map(orderedSteps(doc).map((s, i) => [s.id, i + 1]));
}

/** การ์ดที่ลูกค้าจะได้รับจริง (ไล่จากข้อความแรกตามปุ่ม "ส่งข้อความต่อ") */
export function reachableSteps(doc: BuilderDoc): Set<string> {
  const byId = new Map(doc.steps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const queue = doc.startStepId && byId.has(doc.startStepId) ? [doc.startStepId] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const b of byId.get(id)?.buttons ?? []) if (b.type === "next" && b.nextStepId && byId.has(b.nextStepId)) queue.push(b.nextStepId);
  }
  return seen;
}

export interface Edge {
  key: string;
  from: EdgeFrom;
  /** การ์ดต้นทาง (TRIGGER_NODE หรือ id ข้อความ) */
  source: string;
  /** key ของจุดต่อขาออก ("out" หรือ id ปุ่ม) */
  handle: string;
  target: string;
}

export function edgeKey(from: EdgeFrom): string {
  return from.kind === "trigger" ? "trigger" : `${from.stepId}:${from.buttonId}`;
}

export function edgesOf(doc: BuilderDoc): Edge[] {
  const ids = new Set(doc.steps.map((s) => s.id));
  const edges: Edge[] = [];
  if (doc.startStepId && ids.has(doc.startStepId)) {
    edges.push({ key: "trigger", from: { kind: "trigger" }, source: TRIGGER_NODE, handle: "out", target: doc.startStepId });
  }
  for (const s of doc.steps) {
    for (const b of s.buttons) {
      if (b.type !== "next" || !b.nextStepId || !ids.has(b.nextStepId) || b.nextStepId === s.id) continue;
      const from: EdgeFrom = { kind: "button", stepId: s.id, buttonId: b.id };
      edges.push({ key: edgeKey(from), from, source: s.id, handle: b.id, target: b.nextStepId });
    }
  }
  return edges;
}

/** ปลายทางปัจจุบันของจุดต่อ (undefined = ยังไม่ได้เชื่อม) */
export function targetOf(doc: BuilderDoc, from: EdgeFrom): string | undefined {
  if (from.kind === "trigger") return doc.startStepId ?? undefined;
  const b = doc.steps.find((s) => s.id === from.stepId)?.buttons.find((x) => x.id === from.buttonId);
  const t = b?.type === "next" ? b.nextStepId : undefined;
  return t && doc.steps.some((s) => s.id === t) ? t : undefined;
}

export function canAddStep(doc: BuilderDoc): boolean {
  return doc.steps.length < FLOW_LIMITS.maxSteps;
}

/* ---------------------------------------------------------------- ปัญหาที่ต้องแก้ก่อนบันทึก */

export type ProblemTarget = { kind: "name" } | { kind: "trigger" } | { kind: "step"; id: string };

export interface Problem {
  key: string;
  message: string;
  target: ProblemTarget;
  /** true = บันทึกไม่ได้จนกว่าจะแก้, false = แค่เตือน */
  blocking: boolean;
}

/**
 * ตรวจแบบเดียวกับฝั่งเซิร์ฟเวอร์ (validateRule) แต่รวบรวมทุกจุดที่ต้องแก้ แทนที่จะหยุดที่จุดแรก
 * เรียงตามลำดับเดียวกับที่เซิร์ฟเวอร์ตรวจ — ปัญหาแรกที่ blocking คือสิ่งที่ต้องแก้ก่อน
 */
export function findProblems(doc: BuilderDoc): Problem[] {
  const out: Problem[] = [];
  const add = (key: string, message: string, target: ProblemTarget, blocking = true) => out.push({ key, message, target, blocking });
  const trigger = { kind: "trigger" } as const;
  const name = doc.name.trim();
  if (!name) add("name", "ตั้งชื่อกฎ (ไว้ดูเองว่ากฎนี้ทำอะไร)", { kind: "name" });
  else if (name.length > 100) add("name", "ชื่อกฎยาวเกิน 100 ตัวอักษร", { kind: "name" });
  if (doc.platforms.length === 0) add("platforms", "เลือกอย่างน้อย 1 แพลตฟอร์ม (Facebook หรือ Instagram)", trigger);
  if (doc.matchType !== "any" && doc.keywords.length === 0) add("keywords", "ใส่คำที่ให้ระบบจับอย่างน้อย 1 คำ (หรือเลือก 'ทุกข้อความ')", trigger);
  if (doc.keywords.some((k) => k.length > 100)) add("keyword-long", "คำที่ให้จับยาวได้ไม่เกิน 100 ตัวอักษร", trigger);
  if (doc.trigger === "comment") {
    if (doc.publicReplies.some((r) => r.trim().length > 500)) add("replies", "ข้อความตอบใต้คอมเมนต์ยาวเกิน 500 ตัวอักษร", trigger);
    if (doc.postScope === "specific" && postIdsOf(doc).length === 0) add("posts", "เลือกโพสต์หรือรีลอย่างน้อย 1 รายการ", trigger);
  }
  if (!doc.startStepId || !doc.steps.some((s) => s.id === doc.startStepId)) {
    add("start", 'ยังไม่ได้เชื่อมการ์ด "เมื่อ…" กับข้อความแรก — ลากเส้นจากจุด "แล้ว" ไปที่การ์ดข้อความ', trigger);
  }

  // ตรวจข้อความทีละการ์ด: เจอปัญหาแล้วแทนการ์ดนั้นด้วยการ์ดที่ถูกต้องชั่วคราว แล้วตรวจต่อ (เลขการ์ดใน error ยังตรง)
  let steps = orderedSteps(doc);
  for (let guard = 0; guard <= steps.length; guard++) {
    const result = validateSteps(steps);
    if (result.ok) break;
    if (!result.stepId) {
      add("steps", result.error, trigger);
      break;
    }
    // ใช้ชื่อเรียกเดียวกับบนการ์ด ("ข้อความ #2")
    add(`step:${result.stepId}`, result.error.replace(/^ข้อความที่ (\d+)/, "ข้อความ #$1"), { kind: "step", id: result.stepId });
    const bad = result.stepId;
    steps = steps.map((s) => (s.id === bad ? { id: s.id, text: "x", buttons: [] } : s));
  }

  const reach = reachableSteps(doc);
  const numbers = stepNumbers(doc);
  if (doc.startStepId) {
    for (const s of doc.steps) {
      if (!reach.has(s.id)) add(`lost:${s.id}`, `ข้อความ #${numbers.get(s.id)} ยังไม่ได้เชื่อม — จะไม่ถูกส่ง`, { kind: "step", id: s.id }, false);
    }
  }
  return out;
}

export function postIdsOf(doc: BuilderDoc): string[] {
  if (doc.postScope !== "specific" || doc.trigger !== "comment") return [];
  const manual = splitKeywords(doc.postIdsManual).flatMap((s) => s.split(/\s+/));
  return [...new Set([...doc.postIds, ...manual])].filter(Boolean);
}

/** สถานะของกฎแบบ "โพสต์หรือรีลถัดไป" (ใช้ทั้งบนการ์ด "เมื่อ…" และในแผงตั้งค่า) */
export type NextPostStatus =
  /** ยังไม่ได้บันทึกเป็นแบบ "โพสต์ถัดไป" → เริ่มนับหลังกดบันทึก */
  | { kind: "start" }
  /** กด "เริ่มรอโพสต์ถัดไปใหม่" ไว้ → เริ่มนับใหม่เมื่อกดบันทึก */
  | { kind: "rearm" }
  /** บันทึกแล้ว ยังไม่มีโพสต์ใหม่ */
  | { kind: "waiting"; since: string }
  /** ผูกกับโพสต์แล้วอย่างน้อย 1 แพลตฟอร์ม (waiting = แพลตฟอร์มที่ยังรออยู่) */
  | { kind: "bound"; since: string; bound: Platform[]; waiting: Platform[] };

export function nextPostStatus(doc: BuilderDoc): NextPostStatus {
  if (doc.rearmNext) return { kind: "rearm" };
  if (!doc.nextPostSince) return { kind: "start" };
  const platforms: Platform[] = doc.platforms.length ? doc.platforms : ["facebook", "instagram"];
  const bound = platforms.filter((p) => doc.boundPosts[p]);
  if (!bound.length) return { kind: "waiting", since: doc.nextPostSince };
  return { kind: "bound", since: doc.nextPostSince, bound, waiting: platforms.filter((p) => !doc.boundPosts[p]) };
}

/* ---------------------------------------------------------------- ค่าที่ส่งไปบันทึก */

/** ชื่อช่อง/ค่า ตามที่ formDataToValues อ่าน (ข้อความเรียงข้อความแรกก่อน) */
export function toFormEntries(doc: BuilderDoc, ruleId?: number): [string, string][] {
  const entries: [string, string][] = [];
  if (ruleId) entries.push(["id", String(ruleId)]);
  entries.push(["name", doc.name.trim()], ["trigger", doc.trigger]);
  for (const p of doc.platforms) entries.push(["platforms", p]);
  entries.push(["matchType", doc.matchType], ["keywords", doc.keywords.join("\n")]);
  const isComment = doc.trigger === "comment";
  // ข้อความแชท (DM) ใช้ได้ทุกที่เสมอ — เซิร์ฟเวอร์ก็บังคับเป็น "any" เหมือนกัน
  entries.push(["postScope", isComment ? doc.postScope : "any"]);
  if (isComment && doc.postScope === "specific") {
    for (const id of doc.postIds) entries.push(["postIds", id]);
    entries.push(["postIdsManual", doc.postIdsManual]);
  }
  if (isComment && doc.postScope === "next" && doc.rearmNext) entries.push(["rearmNext", "1"]);
  entries.push([
    "publicReplies",
    doc.publicReplies
      .map((r) => r.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean)
      .join("\n"),
  ]);
  entries.push(["steps", JSON.stringify(orderedSteps(doc))]);
  entries.push(["canvas", JSON.stringify({ trigger: doc.triggerPos, steps: doc.positions })]);
  entries.push(["startStepId", doc.startStepId ?? ""]);
  if (doc.oncePerUser) entries.push(["oncePerUser", "on"]);
  entries.push(["priority", String(doc.priority)]);
  if (doc.active) entries.push(["active", "on"]);
  return entries;
}

export function toFormData(doc: BuilderDoc, ruleId?: number): FormData {
  const data = new FormData();
  for (const [k, v] of toFormEntries(doc, ruleId)) data.append(k, v);
  return data;
}

/* ---------------------------------------------------------------- ตำแหน่งการ์ด */

export function nodeBox(doc: BuilderDoc, sizes: Sizes, id: string): { x: number; y: number; w: number; h: number } {
  if (id === TRIGGER_NODE) {
    const m = sizes[TRIGGER_NODE];
    return { ...doc.triggerPos, w: m?.w ?? TRIGGER_WIDTH, h: m?.h ?? 220 };
  }
  const step = doc.steps.find((s) => s.id === id);
  const m = sizes[id];
  return { ...(doc.positions[id] ?? { x: 0, y: 0 }), w: m?.w ?? CARD_WIDTH, h: m?.h ?? (step ? estimateStepHeight(step) : 160) };
}

/** หาที่ว่างใกล้จุดที่ต้องการ (เลื่อนลงทีละนิดจนไม่ทับการ์ดอื่น) */
export function findFreeSpot(doc: BuilderDoc, sizes: Sizes, at: CanvasPoint, h = 180): CanvasPoint {
  const boxes = [TRIGGER_NODE, ...doc.steps.map((s) => s.id)].map((id) => nodeBox(doc, sizes, id));
  const hits = (p: CanvasPoint) => boxes.some((b) => p.x < b.x + b.w + 16 && p.x + CARD_WIDTH + 16 > b.x && p.y < b.y + b.h + 16 && p.y + h + 16 > b.y);
  const p = { x: Math.round(at.x), y: Math.round(at.y) };
  for (let i = 0; i < 40 && hits(p); i++) p.y += 48;
  return p;
}

/** ตำแหน่งการ์ดใหม่ที่สร้างจากจุดต่อ: ทางขวาของการ์ดต้นทาง ระดับเดียวกับจุดต่อ */
export function spotRightOf(doc: BuilderDoc, sizes: Sizes, from: EdgeFrom): CanvasPoint {
  const source = from.kind === "trigger" ? TRIGGER_NODE : from.stepId;
  const box = nodeBox(doc, sizes, source);
  const handleKey = from.kind === "trigger" ? "out" : from.buttonId;
  const handleY = sizes[source]?.handles[handleKey] ?? box.h / 2;
  return findFreeSpot(doc, sizes, { x: box.x + box.w + 72, y: box.y + handleY - INPUT_HANDLE_Y });
}

export function autoLayout(doc: BuilderDoc, sizes: Sizes): CanvasLayout {
  const stepSizes = Object.fromEntries(doc.steps.filter((s) => sizes[s.id]).map((s) => [s.id, sizes[s.id]]));
  return layoutCanvas(doc.steps, { startStepId: doc.startStepId, sizes: stepSizes });
}

/* ---------------------------------------------------------------- reducer */

type ScalarKey =
  | "name"
  | "trigger"
  | "platforms"
  | "matchType"
  | "keywords"
  | "postScope"
  | "rearmNext"
  | "postIds"
  | "postIdsManual"
  | "publicReplies"
  | "oncePerUser"
  | "priority"
  | "active";

export type BuilderAction =
  | { type: "patch"; patch: Partial<Pick<BuilderDoc, ScalarKey>>; key?: string; at?: number }
  | { type: "setText"; stepId: string; text: string; at?: number }
  | { type: "addButton"; stepId: string; buttonId: string; button?: Partial<FlowButton> }
  | { type: "updateButton"; stepId: string; buttonId: string; patch: Partial<Omit<FlowButton, "id">>; at?: number }
  | { type: "removeButton"; stepId: string; buttonId: string }
  | { type: "moveButton"; stepId: string; buttonId: string; dir: -1 | 1 }
  | { type: "addStep"; id: string; at: CanvasPoint; from?: EdgeFrom; step?: Partial<Omit<FlowStep, "id">>; select?: boolean }
  | { type: "duplicateStep"; stepId: string; id: string; buttonIds: string[]; at: CanvasPoint }
  | { type: "deleteStep"; stepId: string }
  | { type: "connect"; from: EdgeFrom; target: string }
  | { type: "disconnect"; from: EdgeFrom }
  | { type: "setStart"; stepId: string }
  | { type: "move"; node: string; to: CanvasPoint; key?: string; at?: number }
  | { type: "layout"; layout: CanvasLayout; history: boolean; keepClean?: boolean }
  | { type: "select"; selection: Selection }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "saved"; doc: BuilderDoc; display?: ScopeDisplay };

function fixSelection(selection: Selection, doc: BuilderDoc): Selection {
  if (!selection) return null;
  if (selection.kind === "step") return doc.steps.some((s) => s.id === selection.id) ? selection : null;
  if (selection.kind === "edge") return targetOf(doc, selection.from) ? selection : null;
  return selection;
}

function commit(state: BuilderState, doc: BuilderDoc, key?: string, at = 0, selection: Selection = state.selection): BuilderState {
  if (doc === state.doc) return selection === state.selection ? state : { ...state, selection: fixSelection(selection, doc) };
  const coalesce = !!key && key === state.lastKey && (key.startsWith("drag:") || at - state.lastAt < COALESCE_MS);
  return {
    ...state,
    doc,
    past: coalesce ? state.past : [...state.past, state.doc].slice(-HISTORY_LIMIT),
    future: [],
    lastKey: key ?? null,
    lastAt: at,
    selection: fixSelection(selection, doc),
  };
}

function mapStep(doc: BuilderDoc, stepId: string, fn: (s: FlowStep) => FlowStep): BuilderDoc {
  let changed = false;
  const steps = doc.steps.map((s) => {
    if (s.id !== stepId) return s;
    const next = fn(s);
    if (next !== s) changed = true;
    return next;
  });
  return changed ? { ...doc, steps } : doc;
}

function mapButton(doc: BuilderDoc, stepId: string, buttonId: string, fn: (b: FlowButton) => FlowButton): BuilderDoc {
  return mapStep(doc, stepId, (s) => {
    if (!s.buttons.some((b) => b.id === buttonId)) return s;
    return { ...s, buttons: s.buttons.map((b) => (b.id === buttonId ? fn(b) : b)) };
  });
}

function connectDoc(doc: BuilderDoc, from: EdgeFrom, target: string | null): BuilderDoc {
  if (target !== null && !doc.steps.some((s) => s.id === target)) return doc;
  if (from.kind === "trigger") return doc.startStepId === target ? doc : { ...doc, startStepId: target };
  if (target === from.stepId) return doc; // ปุ่มพากลับมาการ์ดตัวเองไม่ได้
  return mapButton(doc, from.stepId, from.buttonId, (b) =>
    b.type === "next" && (b.nextStepId ?? "") === (target ?? "") ? b : { id: b.id, title: b.title, type: "next", nextStepId: target ?? "" },
  );
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  const { doc } = state;
  switch (action.type) {
    case "patch": {
      const patch = action.patch;
      const changed = (Object.keys(patch) as ScalarKey[]).some((k) => JSON.stringify(doc[k]) !== JSON.stringify(patch[k]));
      return changed ? commit(state, { ...doc, ...patch }, action.key, action.at) : state;
    }
    case "setText": {
      const next = mapStep(doc, action.stepId, (s) => (s.text === action.text ? s : { ...s, text: action.text }));
      return commit(state, next, `text:${action.stepId}`, action.at);
    }
    case "addButton": {
      const next = mapStep(doc, action.stepId, (s) => {
        if (s.buttons.length >= FLOW_LIMITS.maxButtons) return s;
        const type = action.button?.type ?? "next";
        const button: FlowButton =
          type === "next"
            ? { id: action.buttonId, title: action.button?.title ?? "", type, nextStepId: action.button?.nextStepId ?? "" }
            : { id: action.buttonId, title: action.button?.title ?? "", type, url: action.button?.url ?? "" };
        return { ...s, buttons: [...s.buttons, button] };
      });
      return commit(state, next);
    }
    case "updateButton": {
      const { patch } = action;
      const next = mapButton(doc, action.stepId, action.buttonId, (b) => {
        if (patch.type && patch.type !== b.type) {
          // เปลี่ยนชนิดปุ่ม: ล้างปลายทางเดิม
          return patch.type === "link"
            ? { id: b.id, title: patch.title ?? b.title, type: "link", url: patch.url ?? "" }
            : { id: b.id, title: patch.title ?? b.title, type: "next", nextStepId: patch.nextStepId ?? "" };
        }
        const merged = { ...b, ...patch };
        return (Object.keys(patch) as (keyof typeof patch)[]).every((k) => b[k] === merged[k]) ? b : merged;
      });
      const key = `button:${action.buttonId}:${Object.keys(patch).sort().join(",")}`;
      return commit(state, next, patch.type || patch.nextStepId !== undefined ? undefined : key, action.at);
    }
    case "removeButton": {
      const next = mapStep(doc, action.stepId, (s) =>
        s.buttons.some((b) => b.id === action.buttonId) ? { ...s, buttons: s.buttons.filter((b) => b.id !== action.buttonId) } : s,
      );
      const sel = state.selection;
      const clearEdge = sel?.kind === "edge" && sel.from.kind === "button" && sel.from.buttonId === action.buttonId;
      return commit(state, next, undefined, 0, clearEdge ? null : sel);
    }
    case "moveButton": {
      const next = mapStep(doc, action.stepId, (s) => {
        const i = s.buttons.findIndex((b) => b.id === action.buttonId);
        const j = i + action.dir;
        if (i < 0 || j < 0 || j >= s.buttons.length) return s;
        const buttons = [...s.buttons];
        [buttons[i], buttons[j]] = [buttons[j], buttons[i]];
        return { ...s, buttons };
      });
      return commit(state, next);
    }
    case "addStep": {
      if (!canAddStep(doc) || doc.steps.some((s) => s.id === action.id)) return state;
      const step: FlowStep = { id: action.id, text: action.step?.text ?? "", buttons: action.step?.buttons ?? [] };
      let next: BuilderDoc = {
        ...doc,
        steps: [...doc.steps, step],
        positions: { ...doc.positions, [action.id]: { x: Math.round(action.at.x), y: Math.round(action.at.y) } },
      };
      if (action.from) next = connectDoc(next, action.from, action.id);
      return commit(state, next, undefined, 0, action.select === false ? state.selection : { kind: "step", id: action.id });
    }
    case "duplicateStep": {
      const source = doc.steps.find((s) => s.id === action.stepId);
      if (!source || !canAddStep(doc) || doc.steps.some((s) => s.id === action.id)) return state;
      const copy: FlowStep = {
        id: action.id,
        text: source.text,
        buttons: source.buttons.map((b, i) => ({ ...b, id: action.buttonIds[i] ?? newId("b") })),
      };
      const next: BuilderDoc = {
        ...doc,
        steps: [...doc.steps, copy],
        positions: { ...doc.positions, [action.id]: { x: Math.round(action.at.x), y: Math.round(action.at.y) } },
      };
      return commit(state, next, undefined, 0, { kind: "step", id: action.id });
    }
    case "deleteStep": {
      if (!doc.steps.some((s) => s.id === action.stepId)) return state;
      const positions = { ...doc.positions };
      delete positions[action.stepId];
      const next: BuilderDoc = {
        ...doc,
        startStepId: doc.startStepId === action.stepId ? null : doc.startStepId,
        positions,
        steps: doc.steps
          .filter((s) => s.id !== action.stepId)
          .map((s) =>
            s.buttons.some((b) => b.type === "next" && b.nextStepId === action.stepId)
              ? { ...s, buttons: s.buttons.map((b) => (b.type === "next" && b.nextStepId === action.stepId ? { ...b, nextStepId: "" } : b)) }
              : s,
          ),
      };
      return commit(state, next, undefined, 0, null);
    }
    case "connect":
      return commit(state, connectDoc(doc, action.from, action.target));
    case "disconnect": {
      const sel = state.selection;
      const wasSelected = sel?.kind === "edge" && edgeKey(sel.from) === edgeKey(action.from);
      return commit(state, connectDoc(doc, action.from, null), undefined, 0, wasSelected ? null : sel);
    }
    case "setStart":
      return commit(state, connectDoc(doc, { kind: "trigger" }, action.stepId));
    case "move": {
      const to = { x: Math.round(action.to.x), y: Math.round(action.to.y) };
      if (action.node === TRIGGER_NODE) {
        if (doc.triggerPos.x === to.x && doc.triggerPos.y === to.y) return state;
        return commit(state, { ...doc, triggerPos: to }, action.key, action.at);
      }
      const old = doc.positions[action.node];
      if (!doc.steps.some((s) => s.id === action.node) || (old && old.x === to.x && old.y === to.y)) return state;
      return commit(state, { ...doc, positions: { ...doc.positions, [action.node]: to } }, action.key, action.at);
    }
    case "layout": {
      const positions = { ...doc.positions };
      for (const s of doc.steps) if (action.layout.steps[s.id]) positions[s.id] = action.layout.steps[s.id];
      const next: BuilderDoc = { ...doc, triggerPos: action.layout.trigger, positions };
      if (!action.history) {
        // จัดวางตอนโหลดหน้า (ยังไม่นับเป็นการแก้ไข)
        const wasClean = docJson(doc) === state.savedJson;
        return {
          ...state,
          doc: next,
          autoPlaced: false,
          savedJson: action.keepClean && wasClean ? docJson(next) : state.savedJson,
        };
      }
      return { ...commit(state, next), autoPlaced: false };
    }
    case "select":
      return commit(state, doc, undefined, 0, action.selection);
    case "undo": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        doc: prev,
        past: state.past.slice(0, -1),
        future: [doc, ...state.future],
        lastKey: null,
        selection: fixSelection(state.selection, prev),
      };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        doc: next,
        past: [...state.past, doc],
        future: rest,
        lastKey: null,
        selection: fixSelection(state.selection, next),
      };
    }
    case "saved": {
      // "เริ่มรอใหม่" เป็นคำสั่งครั้งเดียว: บันทึกแล้วเซิร์ฟเวอร์ทำให้แล้ว → ล้างทุกฉบับ (รวมประวัติย้อนกลับ) กันส่งซ้ำ
      // ค่าแสดงผลจากเซิร์ฟเวอร์ใส่ให้ทุกฉบับเช่นกัน — ย้อนกลับแล้วจะได้ไม่เห็นสถานะเก่า
      const consumed = action.doc.rearmNext;
      const display = action.display;
      const fix = (d: BuilderDoc): BuilderDoc => {
        let out = d;
        if (consumed && out.rearmNext) out = { ...out, rearmNext: false };
        if (display && (out.nextPostSince !== display.nextPostSince || JSON.stringify(out.boundPosts) !== JSON.stringify(display.boundPosts))) {
          out = { ...out, nextPostSince: display.nextPostSince, boundPosts: display.boundPosts };
        }
        return out;
      };
      return { ...state, doc: fix(state.doc), past: state.past.map(fix), future: state.future.map(fix), savedJson: docJson(fix(action.doc)) };
    }
  }
}

/** สถิติ CTR ของข้อความ (คนที่กดปุ่ม/ลิงก์ ÷ คนที่ได้รับข้อความ) */
export function stepCtr(stat: { reached: number; engaged: number } | undefined): number | null {
  return stat && stat.reached > 0 ? (stat.engaged / stat.reached) * 100 : null;
}
