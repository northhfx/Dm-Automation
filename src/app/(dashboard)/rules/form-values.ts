import { z } from "zod";
import type { MatchType, Platform, Rule, TriggerType } from "@/db/schema";

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
  dmText: string;
  linkUrl: string;
  oncePerUser: boolean;
  priority: number;
  active: boolean;
}

export interface RuleFormState {
  error?: string;
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
  dmText: "สวัสดีค่ะคุณ {name} 😊 ขอบคุณที่สนใจนะคะ\nรายละเอียดทั้งหมดอยู่ที่ลิงก์นี้เลยค่ะ 👉 {link}",
  linkUrl: "",
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
    dmText: rule.dmText,
    linkUrl: rule.linkUrl ?? "",
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

export function formDataToValues(formData: FormData): RuleFormValues {
  const id = Number(formData.get("id"));
  const manualPostIds = splitList(String(formData.get("postIdsManual") ?? "")).flatMap((s) => s.split(/\s+/));
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
    dmText: String(formData.get("dmText") ?? "").trim(),
    linkUrl: String(formData.get("linkUrl") ?? "").trim(),
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
  dmText: z.string().min(1, "กรุณาใส่ข้อความ DM").max(1000, "ข้อความ DM ยาวเกิน 1,000 ตัวอักษร (ลิมิตของ Instagram)"),
  linkUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/, error: "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://" })]),
  oncePerUser: z.boolean(),
  priority: z.number().int().min(1).max(1000),
  active: z.boolean(),
});

export type ValidRule = Omit<z.infer<typeof ruleSchema>, "linkUrl"> & { linkUrl: string | null };

export function validateRule(values: RuleFormValues): { ok: true; data: ValidRule } | { ok: false; error: string } {
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
  return { ok: true, data: { ...data, linkUrl: data.linkUrl || null } };
}
