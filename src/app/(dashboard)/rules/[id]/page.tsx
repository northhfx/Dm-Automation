import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { ruleFolders, rules } from "@/db/schema";
import { ToastOnMount } from "@/components/toast";
import { getT } from "@/lib/i18n/server";
import { getAllTimeRuleStats, getStepStats, rate } from "@/lib/stats";
import { ruleToFormValues } from "../form-values";
import { loadRecentPosts } from "../recent-posts";
import { RuleBuilder } from "../builder/rule-builder";

export default async function EditRulePage({ params }: PageProps<"/rules/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = getDb();
  const rule = await db.query.rules.findFirst({ where: eq(rules.id, id) });
  if (!rule) notFound();
  const [t, { posts, error }, stepStats, allStats, folder] = await Promise.all([
    getT("rules"),
    loadRecentPosts(db),
    getStepStats(db, rule.id),
    getAllTimeRuleStats(db),
    rule.folderId !== null
      ? db.query.ruleFolders.findFirst({ where: eq(ruleFolders.id, rule.folderId), columns: { id: true, name: true } })
      : undefined,
  ]);
  const s = allStats.get(rule.id);
  const ruleStats = s ? { triggers: s.triggers, sent: s.sent, ctr: s.hasButtons ? rate(s.engaged, s.reached) : null } : undefined;

  return (
    <>
      <ToastOnMount param="saved" message={t("savedToast")} />
      {/* key = id: ทำสำเนาแล้วย้ายไปกฎใหม่ ต้องเริ่ม state ใหม่ */}
      <RuleBuilder key={rule.id} initial={ruleToFormValues(rule)} recentPosts={posts} postsError={error} stepStats={stepStats} ruleStats={ruleStats}
        folder={folder ?? null}
      />
    </>
  );
}
