import { ArrowRight, ChartLine, Inbox, ListChecks, MousePointerClick, Plus, Send, UserPlus, Zap } from "lucide-react";
import { getDb } from "@/db/client";
import { LineChart } from "@/components/line-chart";
import { SegmentedControl } from "@/components/segmented-control";
import { ButtonLink, Card, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { getSetupStatus, setupProgress } from "@/lib/config";
import { getFormat, getT } from "@/lib/i18n/server";
import { getOverview, parseRange, RANGE_OPTIONS, rate, sum } from "@/lib/stats";
import { loadEvents } from "./activity/load-events";
import { TimelineItemCompact } from "./activity/timeline";
import { FactList, PlatformBreakdown, PlatformSplitInline, RuleTable, SetupBanner } from "./overview-parts";

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const days = parseRange((await searchParams).range);
  const now = new Date();
  const db = getDb();
  const [overview, setup, recent, f, tNav, tPage] = await Promise.all([
    getOverview(db, days),
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
  const comments = sum(totals.commentsReceived);
  const chats = sum(totals.dmsReceived);
  const clicks = totals.buttonTaps + totals.totalClicks;
  const dailySent = overview.daily.reduce((n, d) => n + d.sent, 0);
  const dailyClicks = overview.daily.reduce((n, d) => n + d.clicks, 0);
  const hasActivity = overview.daily.some((d) => d.sent || d.clicks || d.triggers) || comments + chats > 0;
  const noRules = overview.rules.length === 0;
  const since = overview.daily[0]?.date;

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

        {/* มือถือ 1 + 2×2 · แท็บเล็ต 3 + 2 · จอใหญ่ 5 ช่องเรียงกัน */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatTile
            className="col-span-2 md:col-span-1"
            label={tPage("statTriggers")}
            icon={<Zap />}
            tone="accent"
            value={f.number(sum(totals.triggers))}
            detail={
              <>
                <span className="block">{tPage("statTriggersDetail")}</span>
                <PlatformSplitInline counts={totals.triggers} locale={locale} />
              </>
            }
          />
          <StatTile
            label={tPage("statSent")}
            icon={<Send />}
            tone="good"
            href="/activity?filter=sent"
            value={f.number(sent)}
            detail={
              <>
                <PlatformSplitInline counts={totals.dmsSent} locale={locale} />
                {totals.dmsFailed > 0 && (
                  <span className="block text-critical-text">{tPage("statSentFailed", { count: totals.dmsFailed })}</span>
                )}
              </>
            }
          />
          <StatTile
            label={tPage("statCtr")}
            icon={<ChartLine />}
            tone="accent"
            value={f.percent(rate(totals.engagedContacts, totals.reachedContacts))}
            detail={tPage("statCtrDetail", { engaged: totals.engagedContacts, reached: totals.reachedContacts })}
          />
          <StatTile
            label={tPage("statClicks")}
            icon={<MousePointerClick />}
            tone="warning"
            href="/activity?filter=clicks"
            value={f.number(clicks)}
            detail={tPage("statClicksDetail", { taps: totals.buttonTaps, clicks: totals.totalClicks })}
          />
          <StatTile
            label={tPage("statNewContacts")}
            icon={<UserPlus />}
            tone="neutral"
            href="/contacts"
            value={f.number(totals.newContacts)}
            detail={tPage("statNewContactsDetail")}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={tPage("chartTitle")}
            description={
              hasActivity ? tPage("chartSummary", { days, sent: dailySent, clicks: dailyClicks }) : tPage("chartRangeOnly", { days })
            }
          >
            {hasActivity ? (
              <LineChart
                height={300}
                data={overview.daily}
                series={[
                  { key: "sent", label: tPage("chartSeriesSent"), color: "var(--series-1)" },
                  { key: "clicks", label: tPage("chartSeriesClicks"), color: "var(--series-2)" },
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

          <Card title={tPage("platformTitle")} description={tPage("platformDescription")}>
            <PlatformBreakdown
              incoming={{
                facebook: totals.commentsReceived.facebook + totals.dmsReceived.facebook,
                instagram: totals.commentsReceived.instagram + totals.dmsReceived.instagram,
              }}
              incomingHint={tPage("splitIncomingHint", { comments, chats })}
              triggers={totals.triggers}
              sent={totals.dmsSent}
              locale={locale}
            />
            <div className="mt-5 border-t border-line pt-2">
              <FactList
                items={[
                  { label: tPage("factPublicReplies"), value: tPage("factPublicRepliesValue", { count: totals.publicReplies }) },
                  {
                    label: tPage("factRead"),
                    value: `${f.percent(rate(totals.dmsRead, sent))} (${f.number(totals.dmsRead)})`,
                  },
                  { label: tPage("factLinks"), value: tPage("factLinksValue", { clicked: totals.linksClicked, sent: totals.linksSent }) },
                  {
                    label: tPage("factFailed"),
                    value: f.number(totals.dmsFailed),
                    tone: totals.dmsFailed > 0 ? "critical" : undefined,
                    href: totals.dmsFailed > 0 ? "/activity?filter=failed" : undefined,
                  },
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
              <RuleTable rules={overview.rules} locale={locale} />
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
