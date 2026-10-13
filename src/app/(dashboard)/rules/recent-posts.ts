import type { Db } from "@/db/client";
import { listInstagramAccounts } from "@/lib/instagram/accounts";
import { listRecentFacebookPosts, listRecentInstagramPosts, type RecentPost } from "@/lib/meta/graph";
import { listConnectedPages } from "@/lib/pages";

/**
 * ดึงโพสต์ล่าสุดของทุกเพจ/IG ที่เชื่อมต่อ ไว้ให้เลือกในฟอร์ม (ดึงไม่ได้ก็ยังใช้ฟอร์มได้)
 * บัญชี IG ที่เชื่อมผ่าน Instagram Login ดึงผ่าน graph.instagram.com และไม่ดึงซ้ำผ่านเพจ
 */
export async function loadRecentPosts(db: Db): Promise<{ posts: RecentPost[]; error: string | null }> {
  const [pages, igAccounts] = await Promise.all([listConnectedPages(db), listInstagramAccounts(db)]);
  const igLoginIds = new Set(igAccounts.flatMap((a) => (a.appScopedId ? [a.id, a.appScopedId] : [a.id])));
  const tasks = [
    ...pages.flatMap((page) =>
      page.token
        ? [
            listRecentFacebookPosts(page.id, page.token),
            ...(page.igUserId && !igLoginIds.has(page.igUserId)
              ? [listRecentInstagramPosts(page.igUserId, page.token)]
              : []),
          ]
        : [],
    ),
    ...igAccounts.flatMap((a) => (a.token ? [listRecentInstagramPosts(a.id, a.token, 12, "instagram")] : [])),
  ];
  const results = await Promise.allSettled(tasks);
  const seen = new Set<string>();
  const posts = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((p) => {
      // โพสต์เดียวกันอาจมาจากทั้งเพจและ Instagram Login (เช่น id บัญชีไม่ตรงกัน) → แสดงครั้งเดียว
      const key = `${p.platform}:${p.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  posts.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return { posts, error: failure ? String((failure.reason as Error)?.message ?? failure.reason) : null };
}
