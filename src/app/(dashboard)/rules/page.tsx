import { asc } from "drizzle-orm";
import { FolderOpen } from "lucide-react";
import { getDb } from "@/db/client";
import { ruleFolders, rules } from "@/db/schema";
import { NavTitle } from "@/components/localized";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { inFolder, parseFolderFilter } from "@/lib/rules/folders";
import { effectiveSchedule, scheduleState } from "@/lib/rules/schedule";
import { getAllTimeRuleStats, rate } from "@/lib/stats";
import { FolderTabs, NewFolderButton, type FolderSummary } from "./folder-controls";
import { RuleList, RulesEmptyState, type RuleListItem } from "./rule-list";
import { NewRuleButton } from "./template-chooser";

/** ป้ายตั้งเวลาบนการ์ด (รวมเวลาของโฟลเดอร์): สถานะ + วันเวลาที่จะแสดง */
function scheduleOf(
  rule: { startsAt: Date | null; endsAt: Date | null },
  folder: { startsAt: Date | null; endsAt: Date | null } | undefined,
  now: Date,
): Pick<RuleListItem, "scheduleState" | "scheduleAt"> {
  const s = effectiveSchedule({ startsAt: rule.startsAt ?? null, endsAt: rule.endsAt ?? null }, folder);
  const state = scheduleState(s, now);
  const at = state === "upcoming" ? s.startsAt : s.endsAt;
  return { scheduleState: state, scheduleAt: at ? at.toISOString() : null };
}

export default async function RulesPage({ searchParams }: PageProps<"/rules">) {
  const db = getDb();
  const [params, t, folderRows, list, stats] = await Promise.all([
    searchParams,
    getT("rules"),
    db
      .select({
        id: ruleFolders.id,
        name: ruleFolders.name,
        startsAt: ruleFolders.startsAt,
        endsAt: ruleFolders.endsAt,
        closedReply: ruleFolders.closedReply,
      })
      .from(ruleFolders)
      .orderBy(asc(ruleFolders.name), asc(ruleFolders.id)),
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
        folderId: rules.folderId,
        startsAt: rules.startsAt,
        endsAt: rules.endsAt,
      })
      .from(rules)
      .orderBy(asc(rules.priority), asc(rules.id)),
    getAllTimeRuleStats(db),
  ]);

  const folderById = new Map(folderRows.map((f) => [f.id, f]));
  const folderName = new Map(folderRows.map((f) => [f.id, f.name]));
  const now = new Date();
  // โฟลเดอร์ที่ไม่มีแล้ว (เช่น ลิงก์เก่า) → ดูทั้งหมด
  const parsed = parseFolderFilter(params.folder);
  const filter = typeof parsed === "number" && !folderName.has(parsed) ? "all" : parsed;
  const rankIn = { comment: 0, dm: 0 };

  // เตรียมข้อมูลที่การ์ดต้องใช้ (ส่งไปฝั่ง Client เท่าที่จำเป็น)
  const items: RuleListItem[] = list.map((rule) => {
    const s = stats.get(rule.id);
    const buttons = rule.steps.flatMap((step) => step.buttons);
    const hasButtons = buttons.length > 0;
    return {
      id: rule.id,
      name: rule.name,
      rank: ++rankIn[rule.trigger],
      folderId: rule.folderId,
      folderName: rule.folderId !== null ? (folderName.get(rule.folderId) ?? null) : null,
      ...scheduleOf(rule, rule.folderId !== null ? folderById.get(rule.folderId) : undefined, now),
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
  const folders: FolderSummary[] = folderRows.map((f) => ({
    ...f,
    startsAt: f.startsAt?.toISOString() ?? null,
    endsAt: f.endsAt?.toISOString() ?? null,
    count: items.filter((r) => r.folderId === f.id).length,
  }));
  const shown = items.filter((r) => inFolder(r.folderId, filter));
  const folderId = typeof filter === "number" ? filter : undefined;

  return (
    <>
      <PageHeader
        title={<NavTitle name="automation" />}
        description={t("pageDescription")}
        badge={
          items.length > 0 && (
            <Badge tone={activeCount > 0 ? "good" : "neutral"} dot>
              {t("activeBadge", { active: activeCount, total: items.length })}
            </Badge>
          )
        }
        actions={
          <>
            {(items.length > 0 || folders.length > 0) && <NewFolderButton />}
            <NewRuleButton folderId={folderId} />
          </>
        }
      />

      {items.length === 0 && folders.length === 0 ? (
        <RulesEmptyState />
      ) : (
        <div className="space-y-6">
          {folders.length > 0 && <FolderTabs folders={folders} filter={filter} total={items.length} noneCount={items.filter((r) => r.folderId === null).length} />}
          {shown.length > 0 ? (
            <RuleList rules={shown} folders={folders} filter={filter} />
          ) : filter === "all" ? (
            <RulesEmptyState />
          ) : filter === "none" ? (
            <EmptyState icon={<FolderOpen />} title={t("folderNoneEmptyTitle")}>
              {t("folderNoneEmptyBody")}
            </EmptyState>
          ) : (
            <EmptyState
              icon={<FolderOpen />}
              title={t("folderEmptyTitle")}
              action={<NewRuleButton folderId={folderId}>{t("newRuleInFolder")}</NewRuleButton>}
            >
              {t("folderEmptyBody")}
            </EmptyState>
          )}
        </div>
      )}
    </>
  );
}
