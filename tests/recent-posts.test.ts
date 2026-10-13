import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { instagramAccounts } from "@/db/schema";
import { loadRecentPosts } from "@/app/(dashboard)/rules/recent-posts";
import { resetDatabase, seedInstagramAccount, startMockGraph, type MockPost } from "./helpers";

let graph: Awaited<ReturnType<typeof startMockGraph>>;
let db: Db;

beforeAll(async () => {
  graph = await startMockGraph();
});
afterAll(async () => {
  await graph.close();
});
beforeEach(async () => {
  db = await resetDatabase();
  graph.resetAll();
  graph.setPosts(POSTS());
});

const MIN = 60_000;
function minutesAgo(n: number): string {
  return new Date(Date.now() - n * MIN).toISOString();
}

const POSTS = (): MockPost[] => [
  { id: "PAGE1_P1", platform: "facebook", createdAt: minutesAgo(30), caption: "โพสต์ Facebook" },
  { id: "IGM1", platform: "instagram", createdAt: minutesAgo(10), caption: "รีลล่าสุด" },
  { id: "IGM2", platform: "instagram", createdAt: minutesAgo(60), caption: "รีลเก่า" },
];

function mediaCalls() {
  return graph.calls.filter((c) => c.path.endsWith("/media"));
}

function keys(posts: { platform: string; id: string }[]): string[] {
  return posts.map((p) => `${p.platform}:${p.id}`);
}

describe("loadRecentPosts", () => {
  it("ไม่มี Instagram Login → ดึง IG ผ่านเพจ (graph.facebook.com) เหมือนเดิม", async () => {
    const { posts, error } = await loadRecentPosts(db);
    expect(error).toBeNull();
    expect(keys(posts)).toEqual(["instagram:IGM1", "facebook:PAGE1_P1", "instagram:IGM2"]);
    expect(mediaCalls().map((c) => [c.api, c.path])).toEqual([["facebook", "/IG1/media"]]);
    expect(mediaCalls()[0].authorization).toBe("Bearer PAGE_TOKEN");
  });

  it("IG ที่ผูกกับเพจ เชื่อม Instagram Login ด้วย → ดึงรีลครั้งเดียวผ่าน graph.instagram.com ไม่มีโพสต์ซ้ำ", async () => {
    await seedInstagramAccount(db);
    const { posts, error } = await loadRecentPosts(db);
    expect(error).toBeNull();
    expect(keys(posts)).toEqual(["instagram:IGM1", "facebook:PAGE1_P1", "instagram:IGM2"]);
    expect(mediaCalls().map((c) => [c.api, c.path])).toEqual([["instagram", "/IG1/media"]]);
    expect(mediaCalls()[0].query.access_token).toBe("IG_TOKEN");
    expect(mediaCalls()[0].query.limit).toBe("12");
    // Facebook ยังดึงผ่านเพจ
    expect(graph.calls.filter((c) => c.path === "/PAGE1/posts").map((c) => c.api)).toEqual(["facebook"]);
  });

  it("เพจผูก IG ด้วย app-scoped id ของบัญชี Instagram Login → ถือว่าเป็นบัญชีเดียวกัน", async () => {
    await seedInstagramAccount(db, { id: "IG_LOGIN_ID", appScopedId: "IG1" });
    await loadRecentPosts(db);
    expect(mediaCalls().map((c) => [c.api, c.path])).toEqual([["instagram", "/IG_LOGIN_ID/media"]]);
  });

  it("ID ไม่ตรงกัน (ดึงทั้งผ่านเพจและ Instagram Login) → โพสต์เดียวกันแสดงครั้งเดียว", async () => {
    await seedInstagramAccount(db, { id: "IG9", appScopedId: null });
    const { posts } = await loadRecentPosts(db);
    expect(mediaCalls().map((c) => c.api).sort()).toEqual(["facebook", "instagram"]);
    expect(keys(posts)).toEqual(["instagram:IGM1", "facebook:PAGE1_P1", "instagram:IGM2"]);
  });

  it("token ของ Instagram Login ถอดรหัสไม่ได้ → ข้ามบัญชีนั้น (หน้าเลือกโพสต์ยังใช้ได้)", async () => {
    await seedInstagramAccount(db);
    await db.update(instagramAccounts).set({ accessToken: "broken" }).where(eq(instagramAccounts.id, "IG1"));
    const { posts, error } = await loadRecentPosts(db);
    expect(error).toBeNull();
    expect(keys(posts)).toEqual(["facebook:PAGE1_P1"]);
    expect(mediaCalls()).toHaveLength(0);
  });

  it("ดึงจาก Instagram Login ไม่สำเร็จ → ยังได้โพสต์ Facebook พร้อมบอก error", async () => {
    await seedInstagramAccount(db);
    graph.failWhen((c) => c.api === "instagram");
    const { posts, error } = await loadRecentPosts(db);
    expect(keys(posts)).toEqual(["facebook:PAGE1_P1"]);
    expect(error).toBe("mock: Graph API ล่ม");
  });
});
