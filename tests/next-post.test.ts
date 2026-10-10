import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { events, rules, type BoundPosts } from "@/db/schema";
import { loadEvents } from "@/app/(dashboard)/activity/load-events";
import { ingestWebhook } from "@/lib/automation/ingest";
import { parseWebhook } from "@/lib/meta/webhook";
import { drainQueue } from "@/lib/queue/worker";
import { clearNextPostCache, resolveNextPost } from "@/lib/rules/next-post";
import { nextPostState } from "@/lib/rules/post-scope";
import { createRule, resetDatabase, singleStep, startMockGraph, type GraphCall, type MockPost } from "./helpers";
import { fbComment, igComment } from "./fixtures";

let graph: Awaited<ReturnType<typeof startMockGraph>>;
let db: Db;

const MIN = 60_000;
/** เวลาที่กฎเริ่มรอโพสต์ถัดไป */
let since: Date;

beforeAll(async () => {
  graph = await startMockGraph();
});
afterAll(async () => {
  await graph.close();
});
beforeEach(async () => {
  db = await resetDatabase();
  graph.resetAll();
  clearNextPostCache();
  since = new Date(Date.now() - 60 * MIN);
});

function at(offsetMin: number): string {
  return new Date(since.getTime() + offsetMin * MIN).toISOString();
}

/** โพสต์ในเพจ: เก่า 1 โพสต์ (ก่อนเริ่มรอ) + ใหม่ 2 โพสต์ ทั้ง Facebook และ Instagram */
const POSTS = (): MockPost[] => [
  { id: "PAGE1_OLD", platform: "facebook", createdAt: at(-24 * 60), caption: "โพสต์เก่า" },
  { id: "PAGE1_NEW1", platform: "facebook", createdAt: at(10), caption: "โพสต์ใหม่ล่าสุด!" },
  { id: "PAGE1_NEW2", platform: "facebook", createdAt: at(20), caption: "โพสต์ที่สอง" },
  { id: "IGOLD", platform: "instagram", createdAt: at(-60), caption: "รีลเก่า" },
  { id: "IGNEW1", platform: "instagram", createdAt: at(5), caption: "รีลใหม่" },
  { id: "IGNEW2", platform: "instagram", createdAt: at(30), caption: "รีลที่สอง" },
];

function nextRule(overrides: Parameters<typeof createRule>[0] = {}) {
  return createRule({ name: "โพสต์ถัดไป", postScope: "next", nextPostSince: since, boundPosts: {}, publicReplies: [], ...overrides });
}

async function deliver(...payloads: unknown[]) {
  for (const p of payloads) await ingestWebhook(db, p);
  await drainQueue(db);
}

function sentMessages(): GraphCall[] {
  return graph.calls.filter((c) => c.path === "/PAGE1/messages");
}

function postLookups(): GraphCall[] {
  return graph.calls.filter((c) => c.method === "GET" && c.query.fields !== undefined && /created_time|timestamp/.test(c.query.fields));
}

async function eventsOf(type: string) {
  return db.select().from(events).where(eq(events.type, type)).orderBy(events.id);
}

async function boundOf(ruleId: number): Promise<BoundPosts> {
  const row = await db.query.rules.findFirst({ where: eq(rules.id, ruleId) });
  return row!.boundPosts;
}

/** เพจลงโพสต์ใหม่บน Facebook (webhook feed ที่ from = เพจเอง) */
function fbPagePost(o: { postId: string; createdTime?: number; item?: string; verb?: string; fromId?: string; published?: number; message?: string }) {
  return {
    object: "page",
    entry: [
      {
        id: "PAGE1",
        time: 1700000000,
        changes: [
          {
            field: "feed",
            value: {
              from: { id: o.fromId ?? "PAGE1", name: "ร้านทดสอบ" },
              item: o.item ?? "status",
              verb: o.verb ?? "add",
              post_id: o.postId,
              published: o.published ?? 1,
              created_time: o.createdTime ?? Math.floor(Date.now() / 1000),
              message: o.message ?? "โพสต์ใหม่จากเพจ",
            },
          },
        ],
      },
    ],
  };
}

describe("กฎแบบ 'โพสต์/รีลถัดไป' — ผูกตอนมีคอมเมนต์", () => {
  it("คอมเมนต์ใต้โพสต์เก่า (ลงก่อนเริ่มรอ) → ไม่ส่ง ไม่ผูก และจำเวลาโพสต์ไว้ไม่ถามซ้ำ", async () => {
    graph.setPosts(POSTS());
    const rule = await nextRule();
    await deliver(fbComment({ postId: "PAGE1_OLD", commentId: "C1" }));
    await deliver(fbComment({ postId: "PAGE1_OLD", commentId: "C2", fromId: "USER2" }));

    expect(sentMessages()).toHaveLength(0);
    expect(await boundOf(rule.id)).toEqual({});
    expect(await eventsOf("post_bound")).toHaveLength(0);
    expect(await eventsOf("rule_triggered")).toHaveLength(0);
    // ถาม Meta ครั้งเดียว ครั้งที่สองใช้แคช และไม่ต้องดึงรายการโพสต์เลย
    expect(postLookups().map((c) => c.path)).toEqual(["/PAGE1_OLD"]);
    expect(graph.calls.some((c) => c.path === "/PAGE1/posts")).toBe(false);
  });

  it("คอมเมนต์แรกใต้โพสต์ใหม่ → ผูกโพสต์ + ส่ง DM + บันทึก post_bound", async () => {
    graph.setPosts(POSTS());
    const rule = await nextRule({ publicReplies: ["ส่งให้ทาง DM แล้วค่ะ"] });
    await deliver(fbComment({ postId: "PAGE1_NEW1", commentId: "C1" }));

    expect(sentMessages()).toHaveLength(1);
    expect(sentMessages()[0].body).toMatchObject({ recipient: { comment_id: "C1" } });
    expect(graph.calls.some((c) => c.path === "/C1/comments")).toBe(true);
    const bound = await boundOf(rule.id);
    expect(bound.facebook?.id).toBe("PAGE1_NEW1");
    expect(bound.instagram).toBeUndefined();

    const [ev] = await eventsOf("post_bound");
    expect(ev).toMatchObject({ platform: "facebook", pageId: "PAGE1", ruleId: rule.id, postId: "PAGE1_NEW1", text: "โพสต์ใหม่ล่าสุด!" });
    expect(ev.meta).toMatchObject({ since: since.toISOString(), via: "comment", commentId: "C1" });
    const types = (await db.select({ type: events.type }).from(events).orderBy(events.id)).map((r) => r.type);
    expect(types).toEqual(["comment_received", "post_bound", "rule_triggered", "public_reply_sent", "dm_sent"]);
  });

  it("ผูกแล้ว → คอมเมนต์ใต้โพสต์ใหม่กว่าโพสต์อื่นไม่ส่ง และไม่ต้องถาม Meta อีก", async () => {
    graph.setPosts(POSTS());
    const rule = await nextRule();
    await deliver(fbComment({ postId: "PAGE1_NEW1", commentId: "C1" }));
    graph.reset();

    await deliver(fbComment({ postId: "PAGE1_NEW2", commentId: "C2", fromId: "USER2" }));
    await deliver(fbComment({ postId: "PAGE1_NEW1", commentId: "C3", fromId: "USER3" }));

    expect(graph.calls.filter((c) => c.method === "GET")).toHaveLength(0);
    expect(sentMessages().map((c) => c.body!.recipient)).toEqual([{ comment_id: "C3" }]);
    expect((await boundOf(rule.id)).facebook?.id).toBe("PAGE1_NEW1");
    expect(await eventsOf("post_bound")).toHaveLength(1);
  });

  it("Facebook กับ Instagram ผูกแยกกัน", async () => {
    graph.setPosts(POSTS());
    const rule = await nextRule();
    await deliver(fbComment({ postId: "PAGE1_NEW1", commentId: "C1" }));
    await deliver(igComment({ mediaId: "IGOLD", commentId: "IGC1" }));
    expect((await boundOf(rule.id)).instagram).toBeUndefined();

    await deliver(igComment({ mediaId: "IGNEW1", commentId: "IGC2" }));
    const bound = await boundOf(rule.id);
    expect(bound.facebook?.id).toBe("PAGE1_NEW1");
    expect(bound.instagram?.id).toBe("IGNEW1");
    expect(sentMessages().map((c) => c.body!.recipient)).toEqual([{ comment_id: "C1" }, { comment_id: "IGC2" }]);
    expect(graph.calls.some((c) => c.path === "/IG1/media")).toBe(true);
    const bindings = await eventsOf("post_bound");
    expect(bindings.map((e) => [e.platform, e.postId])).toEqual([
      ["facebook", "PAGE1_NEW1"],
      ["instagram", "IGNEW1"],
    ]);
  });

  it("มีโพสต์ใหม่ 2 โพสต์ แต่คอมเมนต์มาที่โพสต์ที่สองก่อน → ผูกโพสต์แรกสุด และไม่ส่งให้โพสต์ที่สอง", async () => {
    graph.setPosts(POSTS());
    const rule = await nextRule();
    await deliver(igComment({ mediaId: "IGNEW2", commentId: "IGC1" }));
    expect(sentMessages()).toHaveLength(0);
    expect((await boundOf(rule.id)).instagram?.id).toBe("IGNEW1");
    const [ev] = await eventsOf("post_bound");
    expect(ev).toMatchObject({ postId: "IGNEW1", text: "รีลใหม่" });

    await deliver(igComment({ mediaId: "IGNEW1", commentId: "IGC2" }));
    expect(sentMessages().map((c) => c.body!.recipient)).toEqual([{ comment_id: "IGC2" }]);
  });

  it("โพสต์ที่เพิ่งลงยังไม่โผล่ในรายการโพสต์ล่าสุด → ผูกโพสต์ที่คอมเมนต์", async () => {
    graph.setPosts([...POSTS().filter((p) => p.platform === "instagram" && p.id === "IGOLD"), { id: "IGFRESH", platform: "instagram", createdAt: at(1), hidden: true }]);
    const rule = await nextRule();
    await deliver(igComment({ mediaId: "IGFRESH", commentId: "IGC1" }));
    expect((await boundOf(rule.id)).instagram?.id).toBe("IGFRESH");
    expect(sentMessages()).toHaveLength(1);
  });

  it("ถาม Meta ไม่สำเร็จ → ไม่ผูก ไม่ส่ง และบันทึก 'ข้าม' พร้อมสาเหตุให้เห็นในหน้ากิจกรรม", async () => {
    graph.setPosts(POSTS());
    graph.failWhen((c) => c.path === "/PAGE1_NEW1");
    const rule = await nextRule();
    await deliver(fbComment({ postId: "PAGE1_NEW1", commentId: "C1", text: "สนใจค่ะ" }));

    expect(sentMessages()).toHaveLength(0);
    expect(await boundOf(rule.id)).toEqual({});
    const [skip] = await eventsOf("skipped");
    expect(skip).toMatchObject({ ruleId: rule.id, platform: "facebook", postId: "PAGE1_NEW1", actorId: "USER1", text: "สนใจค่ะ" });
    expect(skip.meta).toMatchObject({ reason: "next_post_lookup_failed", commentId: "C1", error: { message: "mock: Graph API ล่ม", code: 1 } });

    const { items } = await loadEvents(db, { limit: 10 });
    const shown = items.find((i) => i.type === "skipped")!;
    expect(shown.skipReason).toBe("next_post_lookup_failed");
    expect(shown.error).toEqual({ message: "mock: Graph API ล่ม", code: "1" });

    // Meta กลับมาใช้ได้ → คอมเมนต์ถัดไปเช็คใหม่และผูกได้ตามปกติ
    graph.failWhen(null);
    await deliver(fbComment({ postId: "PAGE1_NEW1", commentId: "C2", fromId: "USER2" }));
    expect((await boundOf(rule.id)).facebook?.id).toBe("PAGE1_NEW1");
    expect(sentMessages()).toHaveLength(1);
  });

  it("ดึงรายการโพสต์ไม่สำเร็จ → ไม่ผูกเช่นกัน", async () => {
    graph.setPosts(POSTS());
    graph.failWhen((c) => c.path === "/PAGE1/posts");
    const rule = await nextRule();
    await deliver(fbComment({ postId: "PAGE1_NEW2", commentId: "C1" }));
    expect(await boundOf(rule.id)).toEqual({});
    expect(sentMessages()).toHaveLength(0);
    expect((await eventsOf("skipped"))[0].meta).toMatchObject({ reason: "next_post_lookup_failed" });
  });

  it("คอมเมนต์ไม่ตรง keyword → ไม่เรียก Graph API เลย", async () => {
    graph.setPosts(POSTS());
    const rule = await nextRule();
    await deliver(fbComment({ postId: "PAGE1_NEW1", text: "สวยจัง" }));
    expect(graph.calls).toHaveLength(0);
    expect(await boundOf(rule.id)).toEqual({});
  });

  it("กฎที่ปิดอยู่ หรือยังไม่ได้เริ่มรอ (nextPostSince ว่าง) → ไม่เรียก Graph API และไม่ส่ง", async () => {
    graph.setPosts(POSTS());
    await nextRule({ active: false });
    await nextRule({ nextPostSince: null });
    await deliver(fbComment({ postId: "PAGE1_NEW1" }));
    expect(graph.calls).toHaveLength(0);
  });

  it("กฎแบบทุกโพสต์ / เฉพาะโพสต์ที่เลือก ทำงานเหมือนเดิม (ไม่ต้องถามเวลาโพสต์)", async () => {
    graph.setPosts(POSTS());
    const any = await createRule({ name: "ทุกโพสต์", keywords: ["ราคา"], publicReplies: [] });
    const specific = await createRule({ name: "เฉพาะ", postScope: "specific", postIds: ["OLD"], keywords: ["สนใจ"], publicReplies: [] });
    await deliver(fbComment({ postId: "PAGE1_OLD", commentId: "C1", text: "ราคาเท่าไหร่" }));
    await deliver(fbComment({ postId: "PAGE1_OLD", commentId: "C2", text: "สนใจ", fromId: "USER2" }));
    await deliver(fbComment({ postId: "PAGE1_NEW1", commentId: "C3", text: "สนใจ", fromId: "USER3" }));

    expect(postLookups()).toHaveLength(0);
    const triggered = await eventsOf("rule_triggered");
    expect(triggered.map((e) => [e.ruleId, e.meta?.commentId])).toEqual([
      [any.id, "C1"],
      [specific.id, "C2"],
    ]);
  });

  it("ลำดับความสำคัญ: กฎโพสต์ถัดไปมาก่อน → ชนะบนโพสต์ใหม่ ส่วนโพสต์เก่าตกไปที่กฎทุกโพสต์", async () => {
    graph.setPosts(POSTS());
    const next = await nextRule({ priority: 10, steps: singleStep("จากกฎโพสต์ถัดไป") });
    const any = await createRule({ name: "ทุกโพสต์", priority: 20, publicReplies: [], steps: singleStep("จากกฎทุกโพสต์") });
    await deliver(fbComment({ postId: "PAGE1_NEW1", commentId: "C1" }));
    await deliver(fbComment({ postId: "PAGE1_OLD", commentId: "C2", fromId: "USER2" }));

    const triggered = await eventsOf("rule_triggered");
    expect(triggered.map((e) => e.ruleId)).toEqual([next.id, any.id]);
    expect(sentMessages().map((c) => (c.body!.message as { text: string }).text)).toEqual(["จากกฎโพสต์ถัดไป", "จากกฎทุกโพสต์"]);
  });

  it("ลำดับความสำคัญ: กฎทุกโพสต์มาก่อน → ชนะเลย ไม่ต้องเช็คกฎโพสต์ถัดไป", async () => {
    graph.setPosts(POSTS());
    const any = await createRule({ name: "ทุกโพสต์", priority: 5, publicReplies: [] });
    const next = await nextRule({ priority: 10 });
    await deliver(fbComment({ postId: "PAGE1_NEW1", commentId: "C1" }));
    expect((await eventsOf("rule_triggered")).map((e) => e.ruleId)).toEqual([any.id]);
    expect(postLookups()).toHaveLength(0);
    expect(await boundOf(next.id)).toEqual({});
  });

  it("เริ่มรอใหม่ (nextPostState แบบ rearm) → ล้างโพสต์ที่ผูกไว้ แล้วโพสต์ที่ลงก่อนหน้านั้นไม่นับ", async () => {
    graph.setPosts(POSTS());
    const rule = await nextRule();
    await deliver(fbComment({ postId: "PAGE1_NEW1", commentId: "C1" }));
    const before = (await db.query.rules.findFirst({ where: eq(rules.id, rule.id) }))!;
    expect(before.boundPosts.facebook?.id).toBe("PAGE1_NEW1");

    // แก้ข้อความโดยไม่ได้กดเริ่มรอใหม่ → คงการผูกไว้
    expect(nextPostState(before, "next", false, new Date())).toEqual({ nextPostSince: before.nextPostSince, boundPosts: before.boundPosts });

    const rearmed = nextPostState(before, "next", true, new Date());
    expect(rearmed.boundPosts).toEqual({});
    await db.update(rules).set(rearmed).where(eq(rules.id, rule.id));
    graph.reset();

    await deliver(fbComment({ postId: "PAGE1_NEW2", commentId: "C2", fromId: "USER2" }));
    expect(sentMessages()).toHaveLength(0);
    expect(await boundOf(rule.id)).toEqual({});

    // ลงโพสต์ใหม่หลังเริ่มรอใหม่ → ผูกโพสต์นั้น
    graph.setPosts([...POSTS(), { id: "PAGE1_NEW3", platform: "facebook", createdAt: new Date(Date.now() + 1000).toISOString() }]);
    await deliver(fbComment({ postId: "PAGE1_NEW3", commentId: "C3", fromId: "USER3" }));
    expect((await boundOf(rule.id)).facebook?.id).toBe("PAGE1_NEW3");
    expect(sentMessages()).toHaveLength(1);
  });

  it("คอมเมนต์หลายอันเข้ามาพร้อมกัน → ผูกครั้งเดียว ทุกงานเห็นโพสต์เดียวกัน", async () => {
    graph.setPosts(POSTS());
    const rule = await nextRule({ oncePerUser: false });
    await deliver(
      fbComment({ postId: "PAGE1_NEW2", commentId: "C1" }),
      fbComment({ postId: "PAGE1_NEW1", commentId: "C2", fromId: "USER2" }),
      fbComment({ postId: "PAGE1_NEW2", commentId: "C3", fromId: "USER3" }),
      fbComment({ postId: "PAGE1_NEW1", commentId: "C4", fromId: "USER4" }),
    );
    expect(await eventsOf("post_bound")).toHaveLength(1);
    expect((await boundOf(rule.id)).facebook?.id).toBe("PAGE1_NEW1");
    expect(sentMessages().map((c) => (c.body!.recipient as { comment_id: string }).comment_id).sort()).toEqual(["C2", "C4"]);
  });

  it("worker อื่นผูกไปก่อนระหว่างเช็ค → ไม่เขียนทับ และใช้โพสต์ที่เขาผูก", async () => {
    graph.setPosts([...POSTS(), { id: "PAGE1_OTHER", platform: "facebook", createdAt: at(15), hidden: true }]);
    const stale = await nextRule();
    // อีกงานหนึ่ง (เช่น webhook ตอนเพจลงโพสต์) ผูกโพสต์ที่ไม่อยู่ในรายการไปก่อนแล้ว
    const other = { facebook: { id: "PAGE1_OTHER", boundAt: new Date().toISOString() } };
    await db.update(rules).set({ boundPosts: other }).where(eq(rules.id, stale.id));
    const page = { id: "PAGE1", igUserId: "IG1", token: "PAGE_TOKEN" };

    expect(await resolveNextPost(db, stale, "facebook", page, "PAGE1_NEW1")).toBe(false);
    expect(await boundOf(stale.id)).toEqual(other);
    expect(await eventsOf("post_bound")).toHaveLength(0);
    expect(await resolveNextPost(db, stale, "facebook", page, "PAGE1_OTHER")).toBe(true);
  });

  it("ระหว่างเช็คกับ Meta เจ้าของกดเริ่มรอใหม่ → ไม่ผูกด้วยเวลาเริ่มรอเก่า", async () => {
    graph.setPosts(POSTS());
    const stale = await nextRule();
    // worker อ่านกฎไปแล้ว (since เดิม) แต่เจ้าของเริ่มรอใหม่ก่อนที่จะผูก
    const rearmedAt = new Date();
    await db.update(rules).set({ nextPostSince: rearmedAt, boundPosts: {} }).where(eq(rules.id, stale.id));
    const page = { id: "PAGE1", igUserId: "IG1", token: "PAGE_TOKEN" };
    expect(await resolveNextPost(db, stale, "facebook", page, "PAGE1_NEW1")).toBe(false);
    expect(await boundOf(stale.id)).toEqual({});
    expect(await eventsOf("post_bound")).toHaveLength(0);

    // กฎที่เปลี่ยนเป็น "ทุกโพสต์" ไปแล้วก็ไม่ถูกผูกเช่นกัน
    await db.update(rules).set({ postScope: "any", nextPostSince: null }).where(eq(rules.id, stale.id));
    expect(await resolveNextPost(db, stale, "facebook", page, "PAGE1_NEW1")).toBe(false);
    expect(await boundOf(stale.id)).toEqual({});
  });
});

describe("กฎแบบ 'โพสต์ถัดไป' — Facebook ผูกทันทีที่เพจลงโพสต์", () => {
  it("แปลง webhook โพสต์ใหม่ของเพจ และข้ามโพสต์ของคนอื่น/ที่ยังไม่เผยแพร่/ที่ถูกแก้ไข", () => {
    expect(parseWebhook(fbPagePost({ postId: "PAGE1_P9", createdTime: 1700000000, message: "ลดราคา" }))).toEqual([
      { type: "page_post", platform: "facebook", accountId: "PAGE1", postId: "PAGE1_P9", createdTime: 1700000000000, caption: "ลดราคา" },
    ]);
    expect(parseWebhook(fbPagePost({ postId: "PAGE1_P9", item: "video" }))[0]).toMatchObject({ type: "page_post" });
    expect(parseWebhook(fbPagePost({ postId: "PAGE1_P9", fromId: "USER1" }))).toEqual([]);
    expect(parseWebhook(fbPagePost({ postId: "PAGE1_P9", published: 0 }))).toEqual([]);
    expect(parseWebhook(fbPagePost({ postId: "PAGE1_P9", verb: "edited" }))).toEqual([]);
    expect(parseWebhook(fbPagePost({ postId: "PAGE1_P9", item: "like" }))).toEqual([]);
    // คอมเมนต์ยังแปลงเหมือนเดิม
    expect(parseWebhook(fbComment())[0]).toMatchObject({ type: "comment" });
  });

  it("เพจลงโพสต์ → ผูกกฎ Facebook ทันที แล้วคอมเมนต์แรกส่ง DM ได้โดยไม่ต้องถาม Meta", async () => {
    const rule = await nextRule();
    const igOnly = await nextRule({ name: "IG เท่านั้น", platforms: ["instagram"] });
    await deliver(fbPagePost({ postId: "PAGE1_LIVE", message: "สินค้าใหม่มาแล้ว" }));

    expect((await boundOf(rule.id)).facebook?.id).toBe("PAGE1_LIVE");
    expect(await boundOf(igOnly.id)).toEqual({});
    const [ev] = await eventsOf("post_bound");
    expect(ev).toMatchObject({ ruleId: rule.id, postId: "PAGE1_LIVE", platform: "facebook", text: "สินค้าใหม่มาแล้ว" });
    expect(ev.meta).toMatchObject({ via: "publish" });

    // webhook ซ้ำ (โพสต์หลายรูป) ไม่ผูกซ้ำ
    await deliver(fbPagePost({ postId: "PAGE1_LIVE", item: "photo" }));
    expect(await eventsOf("post_bound")).toHaveLength(1);

    await deliver(fbComment({ postId: "PAGE1_LIVE", commentId: "C1" }));
    expect(graph.calls.filter((c) => c.method === "GET")).toHaveLength(0);
    expect(sentMessages()).toHaveLength(1);
    // โพสต์ถัดมาไม่ได้ผูกแทน
    await deliver(fbPagePost({ postId: "PAGE1_LATER" }));
    expect((await boundOf(rule.id)).facebook?.id).toBe("PAGE1_LIVE");
  });

  it("โพสต์ที่ลงก่อนเริ่มรอ ไม่ถูกผูก", async () => {
    const rule = await nextRule();
    await deliver(fbPagePost({ postId: "PAGE1_EARLY", createdTime: Math.floor((since.getTime() - 5 * MIN) / 1000) }));
    expect(await boundOf(rule.id)).toEqual({});
    expect(await eventsOf("post_bound")).toHaveLength(0);
  });
});
