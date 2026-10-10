import { ArrowRight, ChartLine, Inbox, ListChecks, MousePointerClick, Plus, Send, UserPlus, Zap } from "lucide-react";
import { getDb } from "@/db/client";
import { LineChart } from "@/components/line-chart";
import { SegmentedControl } from "@/components/segmented-control";
import { ButtonLink, Card, EmptyState, formatNumber, formatPercent, PageHeader, StatTile } from "@/components/ui";
import { getSetupStatus, setupProgress } from "@/lib/config";
import { getOverview, parseRange, RANGE_OPTIONS, rate, sum } from "@/lib/stats";
import { loadEvents } from "./activity/load-events";
import { TimelineItemCompact } from "./activity/timeline";
import { FactList, PlatformBreakdown, PlatformSplitInline, RuleTable, SetupBanner } from "./overview-parts";

const shortDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const days = parseRange((await searchParams).range);
  const now = new Date();
  const db = getDb();
  const [overview, setup, recent] = await Promise.all([getOverview(db, days), getSetupStatus(db), loadEvents(db, { limit: 6 })]);
  const progress = setupProgress(setup);
  const t = overview.totals;
  const sent = sum(t.dmsSent);
  const comments = sum(t.commentsReceived);
  const chats = sum(t.dmsReceived);
  const clicks = t.buttonTaps + t.totalClicks;
  const dailySent = overview.daily.reduce((n, d) => n + d.sent, 0);
  const dailyClicks = overview.daily.reduce((n, d) => n + d.clicks, 0);
  const hasActivity = overview.daily.some((d) => d.sent || d.clicks || d.triggers) || comments + chats > 0;
  const noRules = overview.rules.length === 0;
  const since = overview.daily[0]?.date;

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        description={
          since
            ? `ผลงานของระบบตอบอัตโนมัติ ${days} วันล่าสุด (${shortDate.format(new Date(`${since}T00:00:00Z`))} – วันนี้)`
            : "ผลงานของระบบตอบอัตโนมัติ"
        }
        actions={
          <SegmentedControl
            label="ช่วงเวลา"
            value={String(days)}
            options={RANGE_OPTIONS.map((r) => ({ value: String(r), label: `${r} วัน`, href: `/?range=${r}` }))}
          />
        }
      />

      <div className="space-y-6">
        {progress.done < progress.total && <SetupBanner status={setup} done={progress.done} total={progress.total} />}

        {/* มือถือ 1 + 2×2 · แท็บเล็ต 3 + 2 · จอใหญ่ 5 ช่องเรียงกัน */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatTile
            className="col-span-2 md:col-span-1"
            label="ตรงกับกฎ"
            icon={<Zap />}
            tone="accent"
            value={formatNumber(sum(t.triggers))}
            detail={
              <>
                <span className="block">คอมเมนต์/แชทที่ระบบตอบให้</span>
                <PlatformSplitInline counts={t.triggers} />
              </>
            }
          />
          <StatTile
            label="DM ที่ส่งสำเร็จ"
            icon={<Send />}
            tone="good"
            href="/activity?filter=sent"
            value={formatNumber(sent)}
            detail={
              <>
                <PlatformSplitInline counts={t.dmsSent} />
                {t.dmsFailed > 0 && <span className="block text-critical-text">ไม่สำเร็จ {formatNumber(t.dmsFailed)}</span>}
              </>
            }
          />
          <StatTile
            label="อัตราการกด"
            icon={<ChartLine />}
            tone="accent"
            value={formatPercent(rate(t.engagedContacts, t.reachedContacts))}
            detail={`${formatNumber(t.engagedContacts)} จาก ${formatNumber(t.reachedContacts)} คนที่ได้รับ DM กดปุ่มหรือลิงก์`}
          />
          <StatTile
            label="กดปุ่ม / คลิกลิงก์"
            icon={<MousePointerClick />}
            tone="warning"
            href="/activity?filter=clicks"
            value={formatNumber(clicks)}
            detail={`กดปุ่ม ${formatNumber(t.buttonTaps)} · คลิกลิงก์ ${formatNumber(t.totalClicks)}`}
          />
          <StatTile
            label="ลูกค้าใหม่"
            icon={<UserPlus />}
            tone="neutral"
            href="/contacts"
            value={formatNumber(t.newContacts)}
            detail="คนที่เพิ่งคุยกับเพจครั้งแรก"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title="DM ที่ส่ง และการกดปุ่ม/คลิกลิงก์ รายวัน"
            description={
              hasActivity
                ? `รวม ${days} วัน: ส่ง ${formatNumber(dailySent)} ข้อความ · กด/คลิก ${formatNumber(dailyClicks)} ครั้ง`
                : `${days} วันล่าสุด`
            }
          >
            {hasActivity ? (
              <LineChart
                height={300}
                data={overview.daily}
                series={[
                  { key: "sent", label: "DM ที่ส่งสำเร็จ", color: "var(--series-1)" },
                  { key: "clicks", label: "กดปุ่ม/คลิกลิงก์", color: "var(--series-2)" },
                ]}
              />
            ) : (
              <EmptyState
                title={`ยังไม่มีข้อมูลใน ${days} วันนี้`}
                icon={<ChartLine />}
                action={
                  noRules ? (
                    <ButtonLink href="/rules/new" icon={<Plus />}>
                      สร้างกฎแรก
                    </ButtonLink>
                  ) : days < 90 ? (
                    <ButtonLink href="/?range=90" variant="secondary">
                      ดูช่วง 90 วัน
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/rules" variant="secondary">
                      ดูกฎอัตโนมัติ
                    </ButtonLink>
                  )
                }
              >
                {noRules
                  ? "สร้างกฎอัตโนมัติก่อน แล้วเมื่อมีคนคอมเมนต์คำที่ตั้งไว้ กราฟจะแสดงที่นี่"
                  : "เมื่อมีคนคอมเมนต์หรือทักแชทตรงกับกฎ กราฟจะแสดงที่นี่"}
              </EmptyState>
            )}
          </Card>

          <Card title="Facebook กับ Instagram" description="เทียบสองแพลตฟอร์มในช่วงเดียวกัน">
            <PlatformBreakdown
              incoming={{
                facebook: t.commentsReceived.facebook + t.dmsReceived.facebook,
                instagram: t.commentsReceived.instagram + t.dmsReceived.instagram,
              }}
              incomingHint={`คอมเมนต์ ${formatNumber(comments)} · แชท ${formatNumber(chats)}`}
              triggers={t.triggers}
              sent={t.dmsSent}
            />
            <div className="mt-5 border-t border-line pt-2">
              <FactList
                items={[
                  { label: "ตอบใต้คอมเมนต์", value: `${formatNumber(t.publicReplies)} ครั้ง` },
                  {
                    label: "ลูกค้าเปิดอ่าน DM",
                    value: `${formatPercent(rate(t.dmsRead, sent))} (${formatNumber(t.dmsRead)})`,
                  },
                  { label: "ลิงก์ที่ถูกเปิด", value: `${formatNumber(t.linksClicked)} จาก ${formatNumber(t.linksSent)}` },
                  {
                    label: "ส่งไม่สำเร็จ",
                    value: formatNumber(t.dmsFailed),
                    tone: t.dmsFailed > 0 ? "critical" : undefined,
                    href: t.dmsFailed > 0 ? "/activity?filter=failed" : undefined,
                  },
                ]}
              />
            </div>
          </Card>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title="กฎที่ทำงานมากที่สุด"
            description={`เรียงตามครั้งที่ทำงานใน ${days} วัน`}
            padding="none"
            actions={
              !noRules && (
                <ButtonLink href="/rules" variant="ghost" size="sm" iconRight={<ArrowRight />}>
                  กฎทั้งหมด
                </ButtonLink>
              )
            }
          >
            {noRules ? (
              <div className="p-5">
                <EmptyState
                  title="ยังไม่มีกฎอัตโนมัติ"
                  icon={<ListChecks />}
                  compact
                  action={
                    <ButtonLink href="/rules/new" icon={<Plus />}>
                      สร้างกฎแรก
                    </ButtonLink>
                  }
                >
                  ตั้งคำที่ลูกค้ามักพิมพ์ เช่น “ราคา” แล้วให้ระบบตอบและส่ง DM ให้อัตโนมัติ
                </EmptyState>
              </div>
            ) : (
              <RuleTable rules={overview.rules} />
            )}
          </Card>

          <Card
            title="กิจกรรมล่าสุด"
            padding="none"
            actions={
              recent.items.length > 0 && (
                <ButtonLink href="/activity" variant="ghost" size="sm" iconRight={<ArrowRight />}>
                  ดูทั้งหมด
                </ButtonLink>
              )
            }
          >
            {recent.items.length === 0 ? (
              <div className="p-5">
                <EmptyState title="ยังไม่มีกิจกรรม" icon={<Inbox />} compact>
                  ลองคอมเมนต์ที่โพสต์ของเพจ รายการจะขึ้นที่นี่ภายในไม่กี่วินาที
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {recent.items.map((e) => (
                  <TimelineItemCompact key={e.id} event={e} now={now} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
