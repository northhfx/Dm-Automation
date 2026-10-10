import type { BoundPosts, Platform, PostScope } from "@/db/schema";

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

/** ID ของโพสต์/รีลมีแค่ตัวเลข ตัวอักษร _ และ - (ลิงก์ เช่น https://www.instagram.com/reel/… ใช้แทนไม่ได้) */
export function isPostId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,100}$/.test(id);
}

export const INVALID_POST_ID_MESSAGE = "ใส่ ID ของโพสต์ ไม่ใช่ลิงก์ — เลือกจากรายการโพสต์ล่าสุดด้านบนแทนได้";

export const POST_SCOPES: readonly PostScope[] = ["specific", "next", "any"];

export function isPostScope(value: unknown): value is PostScope {
  return value === "any" || value === "specific" || value === "next";
}

interface PostScopeState {
  postScope: PostScope;
  nextPostSince: Date | null;
  boundPosts: BoundPosts;
}

/**
 * สถานะ "โพสต์ถัดไป" หลังบันทึกกฎ:
 * - เพิ่งเปลี่ยนมาใช้ "โพสต์ถัดไป" (หรือกฎใหม่ หรือกด "เริ่มรอใหม่") → เริ่มรอโพสต์ที่ลงตั้งแต่ตอนนี้
 * - ใช้ "โพสต์ถัดไป" อยู่แล้ว → คงเวลาเริ่มรอและโพสต์ที่ผูกไว้ (แก้ข้อความทีหลังไม่ทำให้เริ่มนับใหม่)
 *   คืน {} = ไม่ต้องเขียนสองช่องนี้เลย (worker อาจเพิ่งผูกโพสต์ระหว่างที่อ่านกับบันทึก → ห้ามเขียนค่าเก่าทับ)
 * - แบบอื่น → ล้างทิ้ง
 */
export function nextPostState(
  previous: PostScopeState | null,
  postScope: PostScope,
  rearm: boolean,
  now: Date,
): Partial<Pick<PostScopeState, "nextPostSince" | "boundPosts">> {
  if (postScope !== "next") return { nextPostSince: null, boundPosts: {} };
  if (!previous || previous.postScope !== "next" || rearm || !previous.nextPostSince) {
    return { nextPostSince: now, boundPosts: {} };
  }
  return {};
}

export interface ScopedRule {
  postScope: PostScope;
  postIds: string[];
  boundPosts: BoundPosts;
}

/**
 * คอมเมนต์ใต้โพสต์นี้เข้ากฎได้ไหม
 * "resolve" = กฎแบบ "โพสต์ถัดไป" ที่ยังไม่ได้ผูกโพสต์ของแพลตฟอร์มนี้ → ต้องถาม Meta ว่าโพสต์นี้ลงหลังเริ่มรอหรือเปล่า
 */
export function postScopeMatches(rule: ScopedRule, platform: Platform, postId: string | null | undefined): boolean | "resolve" {
  if (rule.postScope === "any") return true;
  if (rule.postScope === "specific") return rule.postIds.length > 0 && postIdMatches(rule.postIds, postId);
  const bound = rule.boundPosts?.[platform];
  if (bound) return postIdMatches([bound.id], postId);
  return postId ? "resolve" : false;
}
