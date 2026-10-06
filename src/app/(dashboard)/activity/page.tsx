import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { events, jobs, rules, webhookLogs } from "@/db/schema";
import { Badge, Card, cx, EmptyState, formatDateTime, PageHeader, PlatformBadge } from "@/components/ui";

const EVENT_LABELS: Record<string, { label: string; tone: "neutral" | "good" | "critical" | "accent" | "warning" }> = {
  comment_received: { label: "คอมเมนต์ใหม่", tone: "neutral" },
  dm_received: { label: "DM เข้ามา", tone: "neutral" },
  rule_triggered: { label: "ตรงกับกฎ", tone: "accent" },
  public_reply_sent: { label: "ตอบคอมเมนต์แล้ว", tone: "good" },
  public_reply_failed: { label: "✕ ตอบคอมเมนต์ไม่สำเร็จ", tone: "critical" },
  dm_sent: { label: "ส่ง DM แล้ว", tone: "good" },
  dm_failed: { label: "✕ ส่ง DM ไม่สำเร็จ", tone: "critical" },
  link_clicked: { label: "คลิกลิงก์", tone: "accent" },
  skipped: { label: "ข้าม (ตอบคนนี้ไปแล้ว)", tone: "warning" },
};

const FILTERS = [
  { key: "all", label: "ทั้งหมด", types: null },
  { key: "sent", label: "ส่งแล้ว", types: ["dm_sent", "public_reply_sent"] },
  { key: "failed", label: "ไม่สำเร็จ", types: ["dm_failed", "public_reply_failed"] },
  { key: "incoming", label: "ข้อความเข้า", types: ["comment_received", "dm_received"] },
  { key: "clicks", label: "คลิก", types: ["link_clicked"] },
] as const;

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const filterKey = String((await searchParams).filter ?? "all");
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const db = getDb();

  const [eventRows, failedJobs, logs, ruleRows] = await Promise.all([
    db
      .select()
      .from(events)
      .where(filter.types ? inArray(events.type, [...filter.types]) : undefined)
      .orderBy(desc(events.id))
      .limit(50),
    db.select().from(jobs).where(eq(jobs.status, "failed")).orderBy(desc(jobs.updatedAt)).limit(10),
    db.select().from(webhookLogs).orderBy(desc(webhookLogs.id)).limit(10),
    db.select({ id: rules.id, name: rules.name }).from(rules),
  ]);
  const ruleNames = new Map(ruleRows.map((r) => [r.id, r.name]));

  return (
    <>
      <PageHeader title="กิจกรรม" description="50 รายการล่าสุดที่ระบบได้รับและทำไป ใช้ตรวจสอบเวลาระบบไม่ตอบ" />

      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/activity" : `/activity?filter=${f.key}`}
            className={cx(
              "rounded-full border px-3 py-1",
              f.key === filter.key ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-fg-2 hover:text-fg",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {eventRows.length === 0 ? (
        <EmptyState title="ยังไม่มีกิจกรรม">
          ลองคอมเมนต์หรือทักแชทเพจของคุณดู ถ้าตั้งค่า webhook ถูกต้อง รายการจะขึ้นที่นี่ภายในไม่กี่วินาที
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <ul>
            {eventRows.map((e) => {
              const meta = EVENT_LABELS[e.type] ?? { label: e.type, tone: "neutral" as const };
              const error = (e.meta as { error?: { message?: string } } | null)?.error?.message;
              return (
                <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-line px-4 py-3 first:border-t-0">
                  <div className="w-28 shrink-0 text-xs text-fg-3">{formatDateTime(e.createdAt)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {e.platform && <PlatformBadge platform={e.platform} />}
                      {e.ruleId && ruleNames.has(e.ruleId) && (
                        <Link href={`/rules/${e.ruleId}`} className="text-xs text-fg-2 hover:text-accent">
                          กฎ: {ruleNames.get(e.ruleId)}
                        </Link>
                      )}
                    </div>
                    {e.text && <p className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-fg-2">{e.text}</p>}
                    {error && <p className="mt-1 text-sm text-critical-text">สาเหตุ: {error}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {failedJobs.length > 0 && (
        <Card title="งานที่ล้มเหลว" description="ระบบลองใหม่จนครบจำนวนครั้งแล้วยังไม่สำเร็จ" className="mt-6">
          <ul className="space-y-2 text-sm">
            {failedJobs.map((j) => (
              <li key={j.id} className="rounded-lg bg-critical-soft px-3 py-2">
                <span className="font-medium">#{j.id} {j.type}</span> · {formatDateTime(j.updatedAt)}
                <div className="text-critical-text">{j.lastError}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Webhook ล่าสุดที่ได้รับ" description="ข้อมูลดิบจาก Meta (เก็บไว้ 7 วัน) ถ้าว่างแปลว่า webhook ยังไม่เข้ามาที่ระบบ" className="mt-6">
        {logs.length === 0 ? (
          <p className="text-sm text-fg-2">ยังไม่เคยได้รับ webhook</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li key={log.id}>
                <details className="rounded-lg border border-line px-3 py-2 text-sm">
                  <summary className="cursor-pointer">
                    {formatDateTime(log.receivedAt)} · <span className="text-fg-2">{log.object ?? "unknown"}</span>
                  </summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded bg-surface-2 p-2 text-xs">{JSON.stringify(log.body, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
