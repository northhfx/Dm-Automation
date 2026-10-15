import { ArrowRight, ChartLine, Inbox, ListChecks, Plus } from "lucide-react";
import { getDb } from "@/db/client";
import { PlatformBarChart } from "@/components/platform-bar-chart";
import { SegmentedControl } from "@/components/segmented-control";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { getSetupStatus, setupProgress } from "@/lib/config";
import { getFormat, getT } from "@/lib/i18n/server";
import { change, getOverview, getPreviousTotals, parseRange, RANGE_OPTIONS, rate, sum } from "@/lib/stats";
import { loadEvents } from "./activity/load-events";
import { TimelineItemCompact } from "./activity/timeline";
import { FactList, KpiCards, PlatformTable, RuleTable, SetupBanner } from "./overview-parts";

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const days = parseRange((await searchParams).range);
  const now = new Date();
  const db = getDb();
  const [overview, previous, setup, recent, f, tNav, tPage] = await Promise.all([
    getOverview(db, days),
    getPreviousTotals(db, days),
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
  const hasActivity = overview.daily.some((d) => sum(d.sent) + sum(d.clicks) + sum(d.triggers) > 0) || comments + chats > 0;
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

        <KpiCards
          days={days}
          locale={locale}
          items={[
            {
              label: tPage("statTriggers"),
              hint: tPage("statTriggersHint"),
              value: f.number(sum(totals.triggers)),
              split: totals.triggers,
              change: change(sum(totals.triggers), previous.triggers),
            },
            {
              label: tPage("statSent"),
              value: f.number(sent),
              split: totals.dmsSent,
              change: change(sent, previous.sent),
              alert: totals.dmsFailed > 0 ? tPage("statSentFailed", { count: totals.dmsFailed }) : undefined,
              href: "/activity?filter=sent",
            },
            {
              label: tPage("statCtr"),
              hint: tPage("statCtrHint"),
              value: f.percent(rate(totals.engagedContacts, totals.reachedContacts)),
              note: tPage("statCtrDetail", { engaged: totals.engagedContacts, reached: totals.reachedContacts }),
            },
            {
              label: tPage("statClicks"),
              hint: tPage("statClicksDetail", { taps: totals.buttonTaps, clicks: totals.totalClicks }),
              value: f.number(clicks),
              split: totals.clicksByPlatform,
              change: change(clicks, previous.clicks),
              href: "/activity?filter=clicks",
            },
            {
              label: tPage("statNewContacts"),
              hint: tPage("statNewContactsHint"),
              value: f.number(totals.newContacts),
              split: totals.newContactsByPlatform,
              change: change(totals.newContacts, previous.newContacts),
              href: "/contacts",
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
                  { key: "sent", label: tPage("statSent"), data: overview.daily.map((d) => ({ date: d.date, ...d.sent })) },
                  { key: "triggers", label: tPage("statTriggers"), data: overview.daily.map((d) => ({ date: d.date, ...d.triggers })) },
                  { key: "clicks", label: tPage("statClicks"), data: overview.daily.map((d) => ({ date: d.date, ...d.clicks })) },
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

          <Card title={tPage("platformTitle")}>
            <PlatformTable
              locale={locale}
              rows={[
                {
                  label: tPage("splitIncoming"),
                  hint: tPage("splitIncomingHint", { comments, chats }),
                  counts: {
                    facebook: totals.commentsReceived.facebook + totals.dmsReceived.facebook,
                    instagram: totals.commentsReceived.instagram + totals.dmsReceived.instagram,
                  },
                },
                { label: tPage("splitTriggers"), counts: totals.triggers },
                { label: tPage("splitSent"), counts: totals.dmsSent },
              ]}
            />
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="text-xs font-medium text-fg-3">{tPage("resultsHeading")}</h3>
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
