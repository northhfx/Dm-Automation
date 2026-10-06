import { getDb } from "@/db/client";
import { PageHeader } from "@/components/ui";
import { DEFAULT_RULE } from "../form-values";
import { loadRecentPosts } from "../recent-posts";
import { RuleForm } from "../rule-form";

export default async function NewRulePage() {
  const { posts, error } = await loadRecentPosts(getDb());
  return (
    <>
      <PageHeader title="สร้างกฎใหม่" description="ตั้งว่าเมื่อเจอคำไหน ให้ระบบตอบอะไร" />
      <RuleForm initial={DEFAULT_RULE} recentPosts={posts} postsError={error} />
    </>
  );
}
