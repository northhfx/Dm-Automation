import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { events, rules, type Platform, type Rule } from "@/db/schema";
import {
  errorInfo,
  getPostInfo,
  listRecentFacebookPosts,
  listRecentInstagramPosts,
  parseGraphTime,
} from "@/lib/meta/graph";
import { postIdMatches } from "./post-scope";

/*
 * กฎแบบ "โพสต์/รีลถัดไป": รอโพสต์แรกที่ลงตั้งแต่ rules.nextPostSince แล้วผูกไว้ใน rules.boundPosts
 * แยกกันระหว่าง Facebook กับ Instagram (เจ้าของร้านลงเนื้อหาเดียวกันทั้งสองที่)
 * - ผูกตอนมีคนคอมเมนต์ครั้งแรก (ถาม Meta ว่าโพสต์ลงเมื่อไหร่) — ใช้ได้ทั้งสองแพลตฟอร์ม
 * - Facebook ผูกได้ทันทีที่เพจลงโพสต์ด้วย (webhook feed ของเพจเอง) — Instagram ไม่มี webhook นี้
 */

/** เวลาลงโพสต์ไม่เปลี่ยน จำไว้สักพักจะได้ไม่ต้องถาม Meta ทุกคอมเมนต์ */
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 500;
/** ดึงโพสต์ล่าสุดกี่รายการ เพื่อหาโพสต์แรกที่ลงหลังเริ่มรอ */
const RECENT_LIMIT = 25;

interface KnownPost {
  id: string;
  createdMs: number;
  caption: string;
  permalink: string | null;
  /** Facebook: id ของคนที่ลงโพสต์ (null = ไม่รู้) */
  fromId: string | null;
}

const postCache = new Map<string, { post: KnownPost; expires: number }>();

/** ล้างแคช (ใช้ในเทส) */
export function clearNextPostCache(): void {
  postCache.clear();
}

function cacheKey(platform: Platform, postId: string): string {
  return `${platform}:${postId}`;
}

function remember(platform: Platform, post: KnownPost): void {
  if (postCache.size >= CACHE_MAX) {
    const oldest = postCache.keys().next().value;
    if (oldest !== undefined) postCache.delete(oldest);
  }
  postCache.set(cacheKey(platform, post.id), { post, expires: Date.now() + CACHE_TTL_MS });
}

function cached(platform: Platform, postId: string): KnownPost | null {
  const hit = postCache.get(cacheKey(platform, postId));
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    postCache.delete(cacheKey(platform, postId));
    return null;
  }
  return hit.post;
}

/** Meta บอกเวลาละเอียดแค่วินาที → ปัดเวลาเริ่มรอลงเป็นวินาทีด้วย (โพสต์ที่ลงวินาทีเดียวกับตอนบันทึกกฎยังนับ) */
function sinceFloor(since: Date): number {
  return Math.floor(since.getTime() / 1000) * 1000;
}

async function lookupPost(platform: Platform, postId: string, token: string): Promise<KnownPost> {
  const hit = cached(platform, postId);
  if (hit) return hit;
  const info = await getPostInfo(platform, postId, token);
  const createdMs = parseGraphTime(info.createdAt);
  if (createdMs === null) throw new Error("Meta ไม่ได้บอกเวลาที่ลงโพสต์นี้");
  // เก็บด้วย id ที่ได้จาก webhook เพื่อให้คอมเมนต์ถัดไปเจอในแคช
  const post: KnownPost = { id: postId, createdMs, caption: info.caption, permalink: info.permalink, fromId: info.fromId };
  remember(platform, post);
  return post;
}

async function listRecent(platform: Platform, accountId: string, token: string): Promise<KnownPost[]> {
  const list =
    platform === "instagram"
      ? await listRecentInstagramPosts(accountId, token, RECENT_LIMIT)
      : await listRecentFacebookPosts(accountId, token, RECENT_LIMIT);
  return list.flatMap((p) => {
    const createdMs = parseGraphTime(p.createdAt);
    if (createdMs === null) return [];
    // รายการนี้มีแต่โพสต์ที่บัญชีลงเอง
    const post: KnownPost = { id: p.id, createdMs, caption: p.caption, permalink: p.permalink, fromId: accountId };
    remember(platform, post);
    return [post];
  });
}

export interface NextPostRule {
  id: number;
  postScope: Rule["postScope"];
  nextPostSince: Date | null;
  boundPosts: Rule["boundPosts"];
}

export interface NextPostPage {
  id: string;
  igUserId: string | null;
  token: string | null;
}

/** ข้อมูลคอมเมนต์ที่ทำให้ต้องเช็ค (ใช้บันทึกในหน้ากิจกรรมเมื่อเช็คไม่สำเร็จ) */
export interface CommentContext {
  commentId?: string;
  actorId?: string | null;
  text?: string | null;
}

/**
 * คอมเมนต์ใต้โพสต์ postId เข้ากฎ "โพสต์ถัดไป" ที่ยังไม่ได้ผูกโพสต์ของแพลตฟอร์มนี้หรือเปล่า
 * 1) โพสต์นี้ลงก่อนเริ่มรอ → ไม่ใช่
 * 2) ลงหลังเริ่มรอ → หาโพสต์แรกสุดที่ลงหลังเริ่มรอ แล้วผูกกฎกับโพสต์นั้น (อาจไม่ใช่โพสต์ที่คอมเมนต์)
 * 3) ตอบว่าโพสต์ที่ผูกไว้คือโพสต์ที่คอมเมนต์หรือเปล่า
 * ถาม Meta ไม่สำเร็จ → ไม่ผูก ไม่ตอบ และบันทึก "ข้าม" พร้อมสาเหตุให้เห็นในหน้ากิจกรรม
 */
export async function resolveNextPost(
  db: Db,
  rule: NextPostRule,
  platform: Platform,
  page: NextPostPage,
  postId: string | null | undefined,
  ctx: CommentContext = {},
): Promise<boolean> {
  const since = rule.nextPostSince;
  if (rule.postScope !== "next" || !since || !postId) return false;
  const already = rule.boundPosts?.[platform];
  if (already) return postIdMatches([already.id], postId);

  let target: KnownPost;
  try {
    if (!page.token) throw new Error("token ของเพจใช้ไม่ได้ — ไปที่หน้าตั้งค่าแล้วเชื่อมต่อเพจใหม่");
    const commented = await lookupPost(platform, postId, page.token);
    if (commented.createdMs < sinceFloor(since)) return false; // โพสต์เก่า ลงก่อนเริ่มรอ

    const accountId = platform === "instagram" ? page.igUserId : page.id;
    const recent = accountId ? await listRecent(platform, accountId, page.token) : [];
    // Facebook: คนอื่นโพสต์บนหน้าเพจได้ (visitor post) → ห้ามผูกกับโพสต์ที่เพจไม่ได้ลงเอง
    // (ไม่งั้นใครก็แย่งกฎไปได้ด้วยการโพสต์บนหน้าเพจแล้วคอมเมนต์คำที่ตั้งไว้)
    // Instagram ส่งคอมเมนต์มาเฉพาะโพสต์ของบัญชีเองอยู่แล้ว
    const ownPost =
      platform === "instagram" || commented.fromId === page.id || recent.some((p) => postIdMatches([p.id], postId));
    if (!ownPost) return false;
    // โพสต์ที่เพิ่งลงอาจยังไม่โผล่ในรายการ จึงนับโพสต์ที่คอมเมนต์เป็นตัวเลือกด้วยเสมอ
    const candidates = [commented, ...recent.filter((p) => !postIdMatches([p.id], postId))].filter(
      (p) => p.createdMs >= sinceFloor(since),
    );
    target = candidates.reduce((earliest, p) => (p.createdMs < earliest.createdMs ? p : earliest));
  } catch (err) {
    await db.insert(events).values({
      type: "skipped",
      platform,
      pageId: page.id,
      ruleId: rule.id,
      actorId: ctx.actorId ?? null,
      postId,
      text: ctx.text ?? null,
      meta: { reason: "next_post_lookup_failed", commentId: ctx.commentId, error: errorInfo(err) },
    });
    return false;
  }

  const boundId = await bindNextPost(db, {
    ruleId: rule.id,
    since,
    platform,
    pageId: page.id,
    post: target,
    via: "comment",
    commentId: ctx.commentId,
  });
  return boundId !== null && postIdMatches([boundId], postId);
}

/**
 * ผูกกฎกับโพสต์แบบ atomic: สำเร็จเฉพาะเมื่อแพลตฟอร์มนี้ยังไม่ได้ผูก และกฎยังรอโพสต์ถัดไปจากเวลาเดิมอยู่
 * (ถ้า worker อื่นผูกไปก่อน → ใช้โพสต์ที่เขาผูก, ถ้าเจ้าของแก้กฎ/เริ่มรอใหม่ระหว่างนั้น → ไม่ผูก)
 * คืน id ของโพสต์ที่ผูกอยู่ตอนนี้ หรือ null
 */
async function bindNextPost(
  db: Db,
  b: {
    ruleId: number;
    since: Date;
    platform: Platform;
    pageId: string;
    post: KnownPost;
    via: "comment" | "publish";
    commentId?: string;
  },
): Promise<string | null> {
  const patch = JSON.stringify({ [b.platform]: { id: b.post.id, boundAt: new Date().toISOString() } });
  const updated = await db
    .update(rules)
    .set({ boundPosts: sql`${rules.boundPosts} || ${patch}::jsonb` })
    .where(
      and(
        eq(rules.id, b.ruleId),
        eq(rules.postScope, "next"),
        sql`date_trunc('milliseconds', ${rules.nextPostSince}) = ${b.since.toISOString()}::timestamptz`,
        sql`(${rules.boundPosts} -> ${b.platform}::text) IS NULL`,
      ),
    )
    .returning({ id: rules.id });

  if (updated.length > 0) {
    await db.insert(events).values({
      type: "post_bound",
      platform: b.platform,
      pageId: b.pageId,
      ruleId: b.ruleId,
      postId: b.post.id,
      text: b.post.caption.trim().slice(0, 300) || null,
      meta: {
        since: b.since.toISOString(),
        via: b.via,
        permalink: b.post.permalink,
        ...(b.commentId ? { commentId: b.commentId } : {}),
      },
    });
    return b.post.id;
  }

  // ไม่ได้ผูก → อ่านใหม่ว่าตอนนี้กฎผูกกับโพสต์ไหน
  const fresh = await db.query.rules.findFirst({
    where: eq(rules.id, b.ruleId),
    columns: { postScope: true, nextPostSince: true, boundPosts: true },
  });
  if (!fresh || fresh.postScope !== "next" || fresh.nextPostSince?.getTime() !== b.since.getTime()) return null;
  return fresh.boundPosts?.[b.platform]?.id ?? null;
}

/**
 * เพจลงโพสต์ใหม่บน Facebook (รู้จาก webhook) → ผูกกฎ "โพสต์ถัดไป" ที่ยังรอโพสต์ Facebook อยู่ทันที
 * ผูกทุกกฎที่รออยู่ (รวมกฎที่ปิดไว้) ให้ผลเหมือนการผูกตอนมีคอมเมนต์: "โพสต์แรกที่ลงหลังเริ่มรอ"
 */
export async function bindPublishedFacebookPost(
  db: Db,
  pageId: string,
  post: { id: string; createdMs: number | null; caption: string },
): Promise<number> {
  const createdMs = post.createdMs ?? Date.now();
  const known: KnownPost = { id: post.id, createdMs, caption: post.caption, permalink: null, fromId: pageId };
  remember("facebook", known);

  const waiting = await db.query.rules.findMany({
    where: and(eq(rules.trigger, "comment"), eq(rules.postScope, "next"), isNotNull(rules.nextPostSince)),
    columns: { id: true, platforms: true, nextPostSince: true, boundPosts: true },
    orderBy: (r, { asc }) => [asc(r.priority), asc(r.id)],
  });
  let bound = 0;
  for (const rule of waiting) {
    const since = rule.nextPostSince;
    if (!since || !rule.platforms.includes("facebook") || rule.boundPosts?.facebook) continue;
    if (createdMs < sinceFloor(since)) continue;
    const id = await bindNextPost(db, { ruleId: rule.id, since, platform: "facebook", pageId, post: known, via: "publish" });
    if (id === post.id) bound++;
  }
  return bound;
}
