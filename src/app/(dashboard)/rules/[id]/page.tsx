import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { rules } from "@/db/schema";
import { buttonClass, PageHeader } from "@/components/ui";
import { deleteRule } from "../actions";
import { ruleToFormValues } from "../form-values";
import { loadRecentPosts } from "../recent-posts";
import { RuleForm } from "../rule-form";

export default async function EditRulePage({ params }: PageProps<"/rules/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = getDb();
  const rule = await db.query.rules.findFirst({ where: eq(rules.id, id) });
  if (!rule) notFound();
  const { posts, error } = await loadRecentPosts(db);

  return (
    <>
      <PageHeader
        title="แก้ไขกฎ"
        description={rule.name}
        actions={
          <form action={deleteRule}>
            <input type="hidden" name="id" value={rule.id} />
            <button className={buttonClass.danger}>ลบกฎนี้</button>
          </form>
        }
      />
      <RuleForm initial={ruleToFormValues(rule)} recentPosts={posts} postsError={error} />
    </>
  );
}
