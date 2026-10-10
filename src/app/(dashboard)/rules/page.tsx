import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rules } from "@/db/schema";
import { Badge, PageHeader } from "@/components/ui";
import { getAllTimeRuleStats, rate } from "@/lib/stats";
import { RuleList, RulesEmptyState, type RuleListItem } from "./rule-list";
import { NewRuleButton } from "./template-chooser";

export default async function RulesPage() {
  const db = getDb();
  const [list, stats] = await Promise.all([
    db
      .select({
        id: rules.id,
        name: rules.name,
        active: rules.active,
        trigger: rules.trigger,
        platforms: rules.platforms,
        matchType: rules.matchType,
        keywords: rules.keywords,
        postScope: rules.postScope,
        postIds: rules.postIds,
        boundPosts: rules.boundPosts,
        publicReplies: rules.publicReplies,
        steps: rules.steps,
      })
      .from(rules)
      .orderBy(asc(rules.priority), asc(rules.id)),
    getAllTimeRuleStats(db),
  ]);

  // เตรียมข้อมูลที่การ์ดต้องใช้ (ส่งไปฝั่ง Client เท่าที่จำเป็น)
  const items: RuleListItem[] = list.map((rule) => {
    const s = stats.get(rule.id);
    const buttons = rule.steps.flatMap((step) => step.buttons);
    const hasButtons = buttons.length > 0;
    return {
      id: rule.id,
      name: rule.name,
      active: rule.active,
      trigger: rule.trigger,
      platforms: rule.platforms,
      matchType: rule.matchType,
      keywords: rule.keywords,
      postScope: rule.postScope,
      postCount: rule.postIds.length,
      boundPlatforms: rule.platforms.filter((p) => rule.boundPosts?.[p]),
      publicReply: rule.publicReplies.some((r) => r.trim() !== ""),
      stepCount: rule.steps.length,
      buttonCount: buttons.length,
      firstText: rule.steps[0]?.text ?? "",
      runs: s?.triggers ?? 0,
      hasButtons,
      // แบบเดียวกับเดิม: CTR = คนกดปุ่ม/ลิงก์ ÷ คนที่ได้รับข้อความ (ไม่มีปุ่ม = ไม่มี CTR)
      ctr: hasButtons ? rate(s?.engaged ?? 0, s?.reached ?? 0) : null,
    };
  });
  const activeCount = items.filter((r) => r.active).length;

  return (
    <>
      <PageHeader
        title="กฎอัตโนมัติ"
        description="ตอบคอมเมนต์และแชทให้อัตโนมัติ เมื่อลูกค้าพิมพ์คำที่คุณตั้งไว้"
        badge={
          items.length > 0 && (
            <Badge tone={activeCount > 0 ? "good" : "neutral"} dot>
              เปิดอยู่ {activeCount} จาก {items.length} กฎ
            </Badge>
          )
        }
        actions={<NewRuleButton />}
      />

      {items.length === 0 ? <RulesEmptyState /> : <RuleList rules={items} />}
    </>
  );
}
