import { ArrowRight, ChartLine, Inbox, ListChecks, Plus } from "lucide-react";
import { getDb } from "@/db/client";
import { PlatformBarChart } from "@/components/platform-bar-chart";
import { SegmentedControl } from "@/components/segmented-control";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { getSetupStatus, setupProgress } from "@/lib/config";
import { getFunnel, getPreviousFunnel, getProblems, rulesWithLinks } from "@/lib/funnel";
import { getFormat, getT } from "@/lib/i18n/server";
import { change, getOverview, parseRange, RANGE_OPTIONS, rate, sum, type PlatformCounts } from "@/lib/stats";
import { loadEvents } from "./activity/load-events";
import { TimelineItemCompact } from "./activity/timeline";
import { FactList, KpiCards, ProblemsList, RuleTable, SetupBanner, type RuleRowData } from "./overview-parts";

/** อัตราคลิกช่วงนี้ − ช่วงก่อน (หน่วย "จุด") — null ถ้าช่วงใดช่วงหนึ่งไม่มีคนพิมพ์ keyword */
function pointsChange(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : current - previous;
}

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const days = parseRange((await searchParams).range);
  const now = new Date();
  const db = getDb();
  const overviewP = getOverview(db, days);
  const [overview, funnel, previous, problems, linkRules, setup, recent, f, tNav, tPage] = await Promise.all([
    overviewP,
    // วันที่ของกราฟชุดเดียวกับ getOverview
    overviewP.then((o) => getFunnel(db, days, o.daily.map((d) => d.date))),
    getPreviousFunnel(db, days),
    getProblems(db, days),
    rulesWithLinks(db),
    getSetupStatus(db),
    loadEvents(db, { limit: 6 }),
    getFormat(),
    getT("nav"),
    getT("dashboard"),
  ]);
  const locale = tPage.locale;
  const progress = setupProgress(setup);
  const totals = overview.totals;
  const sent = sum(totals.dmsSent);
  const { typed, clicked } = funnel.totals;
  const typedAll = sum(typed);
  const clickedAll = sum(clicked);
  const clickRate = rate(clickedAll, typedAll);
  const counts = (c: PlatformCounts) => ({ facebook: f.number(c.facebook), instagram: f.number(c.instagram) });
  const hasActivity = typedAll + clickedAll > 0 || sent > 0;
  const noRules = overview.rules.length === 0;
  const since = overview.daily[0]?.date;
  const ruleRows: RuleRowData[] = overview.rules
    .map((rule) => ({
      rule,
      ...(funnel.byRule.get(rule.id) ?? { typed: 0, clicked: 0 }),
      hasLinks: linkRules.has(rule.id),
      failed: problems.failedByRule.get(rule.id) ?? 0,
    }))
    .sort((a, b) => b.typed - a.typed || b.failed - a.failed);
  const previousTyped = sum(previous.typed);

  return (
    <>
      <PageHeader
        title={tNav("dashboard")}
        description={
          since
            ? tPage("descriptionRange", {
                days,
                since: f.date(`${since}T00:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" }),
              })
            : tPage("description")
        }
        actions={
          <SegmentedControl
            label={tPage("rangeLabel")}
            value={String(days)}
            options={RANGE_OPTIONS.map((r) => ({ value: String(r), label: tPage("rangeDays", { days: r }), href: `/?range=${r}` }))}
          />
        }
      />

      <div className="space-y-6">
        {progress.done < progress.total && <SetupBanner status={setup} done={progress.done} total={progress.total} locale={locale} />}

        <KpiCards
          days={days}
          locale={locale}
          items={[
            {
              label: tPage("statTyped"),
              hint: tPage("statTypedHint"),
              value: f.number(typedAll),
              split: counts(typed),
              people: { newCount: f.number(funnel.totals.newPeople), returning: f.number(funnel.totals.returningPeople) },
              change: change(typedAll, previousTyped),
              href: "/contacts",
            },
            {
              label: tPage("statClicked"),
              hint: tPage("statClickedHint"),
              value: f.number(clickedAll),
              split: counts(clicked),
              change: change(clickedAll, sum(previous.clicked)),
              changeNote: previousTyped > 0 ? tPage("previousZero", { days }) : undefined,
              href: "/activity?filter=clicks",
            },
            {
              label: tPage("statClickRate"),
              hint: tPage("statClickRateHint"),
              value: f.percent(clickRate),
              split: {
                facebook: f.percent(rate(clicked.facebook, typed.facebook)),
                instagram: f.percent(rate(clicked.instagram, typed.instagram)),
              },
              change: pointsChange(clickRate, rate(sum(previous.clicked), previousTyped)),
              changeNote: previousTyped > 0 && typedAll === 0 ? tPage("noTypedYet") : undefined,
              changeKind: "points",
            },
          ]}
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2" title={tPage("chartTitle")}>
            {hasActivity ? (
              <PlatformBarChart
                height={300}
                ariaLabel={tPage("chartTitle")}
                metrics={[
                  { key: "typed", label: tPage("statTyped"), data: funnel.daily.map((d) => ({ date: d.date, ...d.typed })) },
                  { key: "clicked", label: tPage("statClicked"), data: funnel.daily.map((d) => ({ date: d.date, ...d.clicked })) },
                ]}
              />
            ) : (
              <EmptyState
                title={tPage("chartEmptyTitle", { days })}
                icon={<ChartLine />}
                action={
                  noRules ? (
                    <ButtonLink href="/rules/new" icon={<Plus />}>
                      {tPage("createFirstRule")}
                    </ButtonLink>
                  ) : days < 90 ? (
                    <ButtonLink href="/?range=90" variant="secondary">
                      {tPage("chartEmptyTry90")}
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/rules" variant="secondary">
                      {tPage("viewRules")}
                    </ButtonLink>
                  )
                }
              >
                {noRules ? tPage("chartEmptyNoRules") : tPage("chartEmptyBody")}
              </EmptyState>
            )}
          </Card>

          <Card title={tPage("problemsTitle")}>
            <ProblemsList problems={problems} locale={locale} />
            <p className="mt-3 text-xs leading-5 text-fg-3">{tPage("linkCheckNote")}</p>
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="text-xs font-medium text-fg-3">{tPage("systemHeading")}</h3>
              <FactList
                items={[
                  { label: tPage("factSent"), value: tPage("factSentValue", { count: f.number(sent) }) },
                  { label: tPage("factRead"), value: f.percent(rate(totals.dmsRead, sent)) },
                  { label: tPage("factPublicReplies"), value: tPage("factPublicRepliesValue", { count: f.number(totals.publicReplies) }) },
                ]}
              />
            </div>
          </Card>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={tPage("topRulesTitle")}
            description={tPage("topRulesDescription", { days })}
            padding="none"
            actions={
              !noRules && (
                <ButtonLink href="/rules" variant="ghost" size="sm" iconRight={<ArrowRight />}>
                  {tPage("allRules")}
                </ButtonLink>
              )
            }
          >
            {noRules ? (
              <div className="p-5">
                <EmptyState
                  title={tPage("rulesEmptyTitle")}
                  icon={<ListChecks />}
                  compact
                  action={
                    <ButtonLink href="/rules/new" icon={<Plus />}>
                      {tPage("createFirstRule")}
                    </ButtonLink>
                  }
                >
                  {tPage("rulesEmptyBody")}
                </EmptyState>
              </div>
            ) : (
              <RuleTable rows={ruleRows} locale={locale} />
            )}
          </Card>

          <Card
            title={tPage("recentTitle")}
            padding="none"
            actions={
              recent.items.length > 0 && (
                <ButtonLink href="/activity" variant="ghost" size="sm" iconRight={<ArrowRight />}>
                  {tPage("recentViewAll")}
                </ButtonLink>
              )
            }
          >
            {recent.items.length === 0 ? (
              <div className="p-5">
                <EmptyState title={tPage("recentEmptyTitle")} icon={<Inbox />} compact>
                  {tPage("recentEmptyBody")}
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {recent.items.map((e) => (
                  <TimelineItemCompact key={e.id} event={e} now={now} locale={locale} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
