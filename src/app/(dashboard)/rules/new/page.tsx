import { getDb } from "@/db/client";
import { loadRecentPosts } from "../recent-posts";
import { RuleBuilder } from "../builder/rule-builder";
import { parseTemplateId, ruleTemplate } from "../templates";

export default async function NewRulePage({ searchParams }: PageProps<"/rules/new">) {
  const template = parseTemplateId((await searchParams).template);
  const { posts, error } = await loadRecentPosts(getDb());
  // key = แม่แบบ: เปลี่ยนแม่แบบแล้วเริ่มใหม่ทั้งหมด
  return <RuleBuilder key={template} initial={ruleTemplate(template)} recentPosts={posts} postsError={error} />;
}
