import { z } from "zod";
import type { MatchType, Platform, Rule, TriggerType } from "@/db/schema";
import type { FlowCanvas, FlowStep } from "@/lib/flows/types";
import { sanitizeCanvas, validateSteps } from "@/lib/flows/validate";

/** ค่าในฟอร์มตั้งกฎ (เก็บเป็นข้อความเพื่อคืนค่ากลับไปให้ฟอร์มเมื่อกรอกผิด) */
export interface RuleFormValues {
  id?: number;
  name: string;
  trigger: TriggerType;
  platforms: Platform[];
  matchType: MatchType;
  keywords: string;
  postIds: string[];
  publicReplies: string;
  /** ข้อความแรกอยู่ลำดับแรกเสมอ (ข้อความที่การ์ด "เมื่อ…" เชื่อมไป) */
  steps: FlowStep[];
  /** ตำแหน่งการ์ดบนแผนผัง */
  canvas: FlowCanvas;
  /**
   * id ของข้อความที่การ์ด "เมื่อ…" เชื่อมไป — ส่งมาจากหน้าแก้ไขแบบแผนผัง
   * "" = ยังไม่ได้เชื่อม, undefined = ฟอร์มไม่ได้ส่งมา (ใช้ข้อความลำดับแรก)
   */
  startStepId?: string;
  oncePerUser: boolean;
  priority: number;
  active: boolean;
}

export interface RuleFormState {
  error?: string;
  /** ข้อความ (การ์ด) ที่ทำให้บันทึกไม่ได้ */
  errorStepId?: string;
  values?: RuleFormValues;
  /** เปลี่ยนทุกครั้งที่ submit เพื่อให้ฟอร์มโหลดค่าที่ส่งคืนมาใหม่ */
  attempt?: number;
}

export const DEFAULT_RULE: RuleFormValues = {
  name: "",
  trigger: "comment",
  platforms: ["facebook", "instagram"],
  matchType: "contains",
  keywords: "",
  postIds: [],
  publicReplies: "ส่งรายละเอียดให้ทาง DM แล้วนะคะ 💌\nเช็คกล่องข้อความได้เลยค่ะ ✨\nส่งให้แล้วค่ะ ดูใน DM นะคะ 🙏",
  // แบบเดียวกับที่ ManyChat นิยมใช้: ถามก่อนแล้วให้กดปุ่ม → ค่อยส่งลิงก์ (ลูกค้ามีส่วนร่วมมากกว่าส่งลิงก์ทันที)
  steps: [
    {
      id: "s1",
      text: "สวัสดีค่ะคุณ {name} 😊\nอยากได้รายละเอียดเพิ่มเติมใช่มั้ยคะ?\n\nกดปุ่มด้านล่างได้เลย ส่งให้ทันทีค่ะ 👇",
      buttons: [{ id: "b1", title: "ใช่ ฉันสนใจ!", type: "next", nextStepId: "s2" }],
    },
    {
      id: "s2",
      text: "ขอบคุณที่สนใจนะคะ 🙏\nรายละเอียดทั้งหมดอยู่ที่ปุ่มด้านล่างเลยค่ะ",
      buttons: [{ id: "b2", title: "ดูรายละเอียด ✅", type: "link", url: "" }],
    },
  ],
  canvas: {},
  oncePerUser: true,
  priority: 100,
  active: true,
};

export function ruleToFormValues(rule: Rule): RuleFormValues {
  return {
    id: rule.id,
    name: rule.name,
    trigger: rule.trigger,
    platforms: rule.platforms,
    matchType: rule.matchType,
    keywords: rule.keywords.join("\n"),
    postIds: rule.postIds,
    publicReplies: rule.publicReplies.join("\n"),
    steps: rule.steps,
    canvas: rule.canvas ?? {},
    oncePerUser: rule.oncePerUser,
    priority: rule.priority,
    active: rule.active,
  };
}

const splitLines = (s: string) =>
  s
    .split(/\n/)
    .map((x) => x.trim())
    .filter(Boolean);

const splitList = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

function parseJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value ?? "null"));
  } catch {
    return null;
  }
}

function parseStepsJson(value: FormDataEntryValue | null): FlowStep[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

/** ย้ายข้อความเริ่มต้นไปไว้ลำดับแรก (ระบบส่งข้อความลำดับแรกเมื่อกฎทำงาน) */
function moveStartFirst(steps: FlowStep[], startStepId: string | undefined): FlowStep[] {
  const index = startStepId ? steps.findIndex((s) => s?.id === startStepId) : -1;
  return index > 0 ? [steps[index], ...steps.slice(0, index), ...steps.slice(index + 1)] : steps;
}

export function formDataToValues(formData: FormData): RuleFormValues {
  const id = Number(formData.get("id"));
  const manualPostIds = splitList(String(formData.get("postIdsManual") ?? "")).flatMap((s) => s.split(/\s+/));
  const startStepId = formData.has("startStepId") ? String(formData.get("startStepId")) : undefined;
  const steps = moveStartFirst(parseStepsJson(formData.get("steps")), startStepId);
  return {
    id: Number.isInteger(id) && id > 0 ? id : undefined,
    name: String(formData.get("name") ?? "").trim(),
    trigger: formData.get("trigger") === "dm" ? "dm" : "comment",
    platforms: formData.getAll("platforms").map(String).filter((p): p is Platform => p === "facebook" || p === "instagram"),
    matchType: (["contains", "exact", "any"].includes(String(formData.get("matchType")))
      ? formData.get("matchType")
      : "contains") as MatchType,
    keywords: String(formData.get("keywords") ?? ""),
    postIds: [...new Set([...formData.getAll("postIds").map(String), ...manualPostIds])].filter(Boolean),
    publicReplies: String(formData.get("publicReplies") ?? ""),
    steps,
    canvas: (parseJson(formData.get("canvas")) ?? {}) as FlowCanvas,
    startStepId,
    oncePerUser: formData.get("oncePerUser") === "on",
    priority: Number(formData.get("priority") ?? 100) || 100,
    active: formData.get("active") === "on",
  };
}

const ruleSchema = z.object({
  name: z.string().min(1, "กรุณาตั้งชื่อกฎ").max(100, "ชื่อกฎยาวเกินไป"),
  trigger: z.enum(["comment", "dm"]),
  platforms: z.array(z.enum(["facebook", "instagram"])).min(1, "เลือกอย่างน้อย 1 แพลตฟอร์ม"),
  matchType: z.enum(["contains", "exact", "any"]),
  keywords: z.array(z.string().max(100)),
  postIds: z.array(z.string().max(100)),
  publicReplies: z.array(z.string().max(500, "ข้อความตอบคอมเมนต์ยาวเกิน 500 ตัวอักษร")),
  oncePerUser: z.boolean(),
  priority: z.number().int().min(1).max(1000),
  active: z.boolean(),
});

export type ValidRule = z.infer<typeof ruleSchema> & { steps: FlowStep[]; canvas: FlowCanvas };

export function validateRule(
  values: RuleFormValues,
): { ok: true; data: ValidRule } | { ok: false; error: string; stepId?: string } {
  const parsed = ruleSchema.safeParse({
    ...values,
    keywords: splitList(values.keywords),
    publicReplies: values.trigger === "comment" ? splitLines(values.publicReplies) : [],
    postIds: values.trigger === "comment" ? values.postIds : [],
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const data = parsed.data;
  if (data.matchType !== "any" && data.keywords.length === 0) {
    return { ok: false, error: "ใส่ keyword อย่างน้อย 1 คำ (หรือเลือก 'ทุกข้อความ')" };
  }
  if (values.startStepId === "" || (values.startStepId && values.steps[0]?.id !== values.startStepId)) {
    return { ok: false, error: 'ยังไม่ได้เชื่อมการ์ด "เมื่อ…" กับข้อความแรกที่จะส่ง — ลากเส้นจากจุด "แล้ว" ไปที่การ์ดข้อความ' };
  }
  const steps = validateSteps(values.steps);
  if (!steps.ok) return { ok: false, error: steps.error, stepId: steps.stepId };
  const canvas = sanitizeCanvas(values.canvas, steps.steps.map((s) => s.id));
  return { ok: true, data: { ...data, steps: steps.steps, canvas } };
}
