import type { RuleFormValues } from "./form-values";

/**
 * แม่แบบตอนสร้างกฎใหม่ (/rules/new?template=comment|dm|blank)
 * ตำแหน่งการ์ดเว้นว่างไว้ → หน้าสร้างกฎจัดวางให้อัตโนมัติตามขนาดการ์ดจริง
 */

export type RuleTemplateId = "comment" | "dm" | "blank";

export const RULE_TEMPLATE_IDS: RuleTemplateId[] = ["comment", "dm", "blank"];

/** แบบเดียวกับที่ ManyChat นิยมใช้: ถามก่อนแล้วให้กดปุ่ม → ค่อยส่งลิงก์ (ลูกค้ามีส่วนร่วมมากกว่าส่งลิงก์ทันที) */
export const DEFAULT_RULE: RuleFormValues = {
  name: "",
  trigger: "comment",
  platforms: ["facebook", "instagram"],
  matchType: "contains",
  keywords: "",
  postScope: "any",
  postIds: [],
  nextPostSince: null,
  boundPosts: {},
  publicReplies: "ส่งรายละเอียดให้ทาง DM แล้วนะคะ 💌\nเช็คกล่องข้อความได้เลยค่ะ ✨\nส่งให้แล้วค่ะ ดูใน DM นะคะ 🙏",
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

const DM_RULE: RuleFormValues = {
  ...DEFAULT_RULE,
  trigger: "dm",
  publicReplies: "",
  steps: [
    {
      id: "s1",
      text: "สวัสดีค่ะคุณ {name} 😊\nขอบคุณที่ทักมานะคะ ดูรายละเอียดและราคาทั้งหมดได้ที่ปุ่มด้านล่างเลยค่ะ 👇",
      buttons: [{ id: "b1", title: "ดูรายละเอียด", type: "link", url: "" }],
    },
  ],
};

const BLANK_RULE: RuleFormValues = {
  ...DEFAULT_RULE,
  publicReplies: "",
  steps: [{ id: "s1", text: "", buttons: [] }],
};

const TEMPLATES: Record<RuleTemplateId, RuleFormValues> = {
  comment: DEFAULT_RULE,
  dm: DM_RULE,
  blank: BLANK_RULE,
};

export function parseTemplateId(value: string | string[] | undefined): RuleTemplateId {
  const v = Array.isArray(value) ? value[0] : value;
  return RULE_TEMPLATE_IDS.includes(v as RuleTemplateId) ? (v as RuleTemplateId) : "comment";
}

/** ค่าเริ่มต้นของกฎใหม่ตามแม่แบบ (คัดลอกใหม่ทุกครั้ง กันแก้ค่ากลางโดยไม่ตั้งใจ) */
export function ruleTemplate(id: RuleTemplateId): RuleFormValues {
  return structuredClone(TEMPLATES[id]);
}
