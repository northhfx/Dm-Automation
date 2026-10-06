import type { MatchType, Platform, TriggerType } from "@/db/schema";

export interface MatchableRule {
  id: number;
  active: boolean;
  trigger: TriggerType;
  platforms: Platform[];
  matchType: MatchType;
  keywords: string[];
  postIds: string[];
  priority: number;
}

export interface IncomingText {
  trigger: TriggerType;
  platform: Platform;
  text: string;
  postId?: string | null;
}

/** ทำข้อความให้อยู่ในรูปเดียวกันก่อนเทียบ: ตัวพิมพ์เล็ก, ตัดช่องว่างซ้ำ, Unicode NFC */
export function normalizeText(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** ตัดเครื่องหมาย/อีโมจิที่หัวท้าย ใช้กับโหมด "ตรงทั้งข้อความ" เช่น "สนใจ!!" = "สนใจ" */
function stripEdgePunctuation(text: string): string {
  return text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}\p{M}]+$/gu, "");
}

export function textMatches(matchType: MatchType, keywords: string[], text: string): boolean {
  if (matchType === "any") return true;
  const normalized = normalizeText(text);
  const words = keywords.map(normalizeText).filter(Boolean);
  if (words.length === 0) return false;
  if (matchType === "exact") {
    const bare = stripEdgePunctuation(normalized);
    return words.some((w) => w === normalized || stripEdgePunctuation(w) === bare);
  }
  // ภาษาไทยไม่มีช่องว่างระหว่างคำ จึงใช้การค้นหาแบบ "มีคำนี้อยู่ในข้อความ"
  return words.some((w) => normalized.includes(w));
}

/** Facebook ส่ง post_id มาเป็น "<pageId>_<postId>" ส่วนผู้ใช้อาจกรอกแค่ "<postId>" */
export function postIdMatches(ruleIds: string[], postId: string | null | undefined): boolean {
  if (ruleIds.length === 0) return true;
  if (!postId) return false;
  const short = postId.includes("_") ? postId.split("_").pop()! : postId;
  return ruleIds.some((id) => {
    const trimmed = id.trim();
    return trimmed === postId || trimmed === short;
  });
}

/** หากฎแรกที่ตรงเงื่อนไข (เรียงตาม priority น้อยไปมาก แล้วตาม id) */
export function findMatchingRule<R extends MatchableRule>(rules: R[], incoming: IncomingText): R | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority || a.id - b.id);
  for (const rule of sorted) {
    if (!rule.active) continue;
    if (rule.trigger !== incoming.trigger) continue;
    if (!rule.platforms.includes(incoming.platform)) continue;
    if (incoming.trigger === "comment" && !postIdMatches(rule.postIds, incoming.postId)) continue;
    if (!textMatches(rule.matchType, rule.keywords, incoming.text)) continue;
    return rule;
  }
  return null;
}
