import type { BoundPosts, MatchType, Platform, PostScope, TriggerType } from "@/db/schema";
import { postScopeMatches } from "./post-scope";

export { postIdMatches } from "./post-scope";

export interface MatchableRule {
  id: number;
  active: boolean;
  trigger: TriggerType;
  platforms: Platform[];
  matchType: MatchType;
  keywords: string[];
  postScope: PostScope;
  postIds: string[];
  boundPosts: BoundPosts;
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

/**
 * หากฎแรกที่ตรงเงื่อนไข (เรียงตาม priority น้อยไปมาก แล้วตาม id)
 * กฎแบบ "โพสต์ถัดไป" ที่ยังไม่ได้ผูกโพสต์จะถูกข้าม — ตัวจัดการคอมเมนต์ต้องเช็คกับ Meta เอง
 */
export function findMatchingRule<R extends MatchableRule>(rules: R[], incoming: IncomingText): R | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority || a.id - b.id);
  for (const rule of sorted) {
    if (!rule.active) continue;
    if (rule.trigger !== incoming.trigger) continue;
    if (!rule.platforms.includes(incoming.platform)) continue;
    if (incoming.trigger === "comment" && postScopeMatches(rule, incoming.platform, incoming.postId) !== true) continue;
    if (!textMatches(rule.matchType, rule.keywords, incoming.text)) continue;
    return rule;
  }
  return null;
}
