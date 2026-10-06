import type { Db } from "@/db/client";
import { listRecentFacebookPosts, listRecentInstagramPosts, type RecentPost } from "@/lib/meta/graph";
import { listConnectedPages } from "@/lib/pages";

/** ดึงโพสต์ล่าสุดของทุกเพจ/IG ที่เชื่อมต่อ ไว้ให้เลือกในฟอร์ม (ดึงไม่ได้ก็ยังใช้ฟอร์มได้) */
export async function loadRecentPosts(db: Db): Promise<{ posts: RecentPost[]; error: string | null }> {
  const pages = await listConnectedPages(db);
  const tasks = pages.flatMap((page) => [
    listRecentFacebookPosts(page.id, page.token),
    ...(page.igUserId ? [listRecentInstagramPosts(page.igUserId, page.token)] : []),
  ]);
  const results = await Promise.allSettled(tasks);
  const posts = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  posts.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return { posts, error: failure ? String((failure.reason as Error)?.message ?? failure.reason) : null };
}
