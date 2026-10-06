import Link from "next/link";
import { getDb } from "@/db/client";
import { LineChart } from "@/components/line-chart";
import {
  Badge,
  buttonClass,
  Card,
  cx,
  EmptyState,
  formatNumber,
  formatPercent,
  Notice,
  PageHeader,
  StatTile,
} from "@/components/ui";
import { getSetupStatus, setupProgress } from "@/lib/config";
import { getOverview, parseRange, RANGE_OPTIONS, rate, sum } from "@/lib/stats";

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const days = parseRange((await searchParams).range);
  const db = getDb();
  const [overview, setup] = await Promise.all([getOverview(db, days), getSetupStatus(db)]);
  const progress = setupProgress(setup);
  const t = overview.totals;
  const sent = sum(t.dmsSent);

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        description="ผลงานของระบบตอบอัตโนมัติ"
        actions={
          <div className="flex rounded-lg border border-line bg-surface p-0.5 text-sm" role="group" aria-label="ช่วงเวลา">
            {RANGE_OPTIONS.map((r) => (
              <Link
                key={r}
                href={`/?range=${r}`}
                className={cx(
                  "rounded-md px-3 py-1.5",
                  r === days ? "bg-accent-soft font-medium text-accent" : "text-fg-2 hover:text-fg",
                )}
              >
                {r} วัน
              </Link>
            ))}
          </div>
        }
      />

      {progress.done < progress.total && (
        <div className="mb-6">
          <Notice tone="warning">
            ตั้งค่าเสร็จแล้ว {progress.done} จาก {progress.total} ขั้น —{" "}
            <Link href="/guide" className="font-medium underline">
              ไปที่คู่มือตั้งค่า
            </Link>{" "}
            เพื่อทำต่อ
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="ข้อความเข้า"
          value={formatNumber(sum(t.commentsReceived) + sum(t.dmsReceived))}
          detail={`คอมเมนต์ ${formatNumber(sum(t.commentsReceived))} · DM ${formatNumber(sum(t.dmsReceived))}`}
        />
        <StatTile
          label="ตรงกับกฎ"
          value={formatNumber(sum(t.triggers))}
          detail={`FB ${formatNumber(t.triggers.facebook)} · IG ${formatNumber(t.triggers.instagram)}`}
        />
        <StatTile
          label="ส่ง DM สำเร็จ"
          value={formatNumber(sent)}
          detail={t.dmsFailed > 0 ? `ส่งไม่สำเร็จ ${formatNumber(t.dmsFailed)}` : "ไม่มีรายการล้มเหลว"}
        />
        <StatTile label="อัตราการอ่าน" value={formatPercent(rate(t.dmsRead, sent))} detail={`อ่านแล้ว ${formatNumber(t.dmsRead)} ข้อความ`} />
        <StatTile
          label="อัตราการคลิก"
          value={formatPercent(rate(t.linksClicked, t.linksSent))}
          detail={`${formatNumber(t.linksClicked)} จาก ${formatNumber(t.linksSent)} ลิงก์ · ${formatNumber(t.totalClicks)} คลิก`}
        />
        <StatTile label="ลูกค้าใหม่" value={formatNumber(t.newContacts)} detail={`ตอบคอมเมนต์ ${formatNumber(t.publicReplies)} ครั้ง`} />
      </div>

      <Card title="DM ที่ส่งและการคลิกลิงก์ รายวัน" className="mt-6">
        <LineChart
          data={overview.daily}
          series={[
            { key: "sent", label: "DM ที่ส่งสำเร็จ", color: "var(--series-1)" },
            { key: "clicks", label: "คลิกลิงก์", color: "var(--series-2)" },
          ]}
        />
      </Card>

      <Card title="ผลงานแยกตามกฎ" className="mt-6">
        {overview.rules.length === 0 ? (
          <EmptyState title="ยังไม่มีกฎอัตโนมัติ">
            <Link href="/rules/new" className={buttonClass.primary}>
              สร้างกฎแรก
            </Link>
          </EmptyState>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-fg-3">
                <tr>
                  <th className="py-2 pr-4 font-medium">กฎ</th>
                  <th className="py-2 pr-4 text-right font-medium">ทำงาน</th>
                  <th className="py-2 pr-4 text-right font-medium">ส่งสำเร็จ</th>
                  <th className="py-2 pr-4 text-right font-medium">ล้มเหลว</th>
                  <th className="py-2 pr-4 text-right font-medium">อ่าน</th>
                  <th className="py-2 text-right font-medium">คลิก</th>
                </tr>
              </thead>
              <tbody>
                {overview.rules.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-2.5 pr-4">
                      <Link href={`/rules/${r.id}`} className="font-medium hover:text-accent">
                        {r.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        <Badge>{r.trigger === "comment" ? "คอมเมนต์" : "DM"}</Badge>
                        {r.platforms.map((p) => (
                          <Badge key={p}>{p === "instagram" ? "IG" : "FB"}</Badge>
                        ))}
                        {!r.active && <Badge tone="warning">ปิดอยู่</Badge>}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular">{formatNumber(r.triggers)}</td>
                    <td className="py-2.5 pr-4 text-right tabular">{formatNumber(r.sent)}</td>
                    <td className={cx("py-2.5 pr-4 text-right tabular", r.failed > 0 && "text-critical-text")}>
                      {formatNumber(r.failed)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular">{formatPercent(rate(r.read, r.sent))}</td>
                    <td className="py-2.5 text-right tabular">
                      {r.linksSent > 0 ? formatPercent(rate(r.linksClicked, r.linksSent)) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
