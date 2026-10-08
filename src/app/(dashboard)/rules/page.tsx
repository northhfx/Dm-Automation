import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rules } from "@/db/schema";
import { Badge, buttonClass, EmptyState, formatNumber, formatPercent, PageHeader } from "@/components/ui";
import { getAllTimeRuleStats, rate } from "@/lib/stats";
import { toggleRule } from "./actions";

const MATCH_LABEL = { contains: "มีคำว่า", exact: "ตรงกับ", any: "ทุกข้อความ" } as const;

export default async function RulesPage() {
  const db = getDb();
  const [list, stats] = await Promise.all([
    db.select().from(rules).orderBy(asc(rules.priority), asc(rules.id)),
    getAllTimeRuleStats(db),
  ]);

  return (
    <>
      <PageHeader
        title="กฎอัตโนมัติ"
        description="ถ้าข้อความตรงหลายกฎ ระบบจะใช้กฎที่อยู่บนสุด (ลำดับความสำคัญน้อยกว่า)"
        actions={
          <Link href="/rules/new" className={buttonClass.primary}>
            + สร้างกฎใหม่
          </Link>
        }
      />

      {list.length === 0 ? (
        <EmptyState title="ยังไม่มีกฎ">
          <p>ตัวอย่าง: ใครคอมเมนต์ว่า &quot;สนใจ&quot; → ส่ง DM พร้อมปุ่ม &quot;ใช่ ฉันสนใจ!&quot; → กดแล้วส่งลิงก์สินค้า</p>
          <Link href="/rules/new" className={`${buttonClass.primary} mt-4`}>
            สร้างกฎแรก
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {list.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/rules/${rule.id}`} className="font-medium hover:text-accent">
                    {rule.name}
                  </Link>
                  {rule.active ? <Badge tone="good">● เปิดอยู่</Badge> : <Badge tone="warning">○ ปิดอยู่</Badge>}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                  <Badge tone="accent">{rule.trigger === "comment" ? "คอมเมนต์" : "DM"}</Badge>
                  {rule.platforms.map((p) => (
                    <Badge key={p}>{p === "instagram" ? "Instagram" : "Facebook"}</Badge>
                  ))}
                  <Badge>
                    {MATCH_LABEL[rule.matchType]}
                    {rule.matchType !== "any" && ` ${rule.keywords.join(", ")}`}
                  </Badge>
                  {rule.trigger === "comment" && (
                    <Badge>{rule.postIds.length === 0 ? "ทุกโพสต์" : `${rule.postIds.length} โพสต์`}</Badge>
                  )}
                  <Badge>{rule.steps.length} ข้อความ</Badge>
                </div>
                <p className="mt-2 line-clamp-1 text-sm text-fg-2">{rule.steps[0]?.text}</p>
                <RuleNumbers
                  runs={stats.get(rule.id)?.triggers ?? 0}
                  reached={stats.get(rule.id)?.reached ?? 0}
                  engaged={stats.get(rule.id)?.engaged ?? 0}
                  hasButtons={rule.steps.some((s) => s.buttons.length > 0)}
                />
              </div>
              <div className="flex gap-2">
                <form action={toggleRule}>
                  <input type="hidden" name="id" value={rule.id} />
                  <button className={buttonClass.secondary}>{rule.active ? "ปิด" : "เปิด"}</button>
                </form>
                <Link href={`/rules/${rule.id}`} className={buttonClass.secondary}>
                  แก้ไข
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** สถิติย่อแบบ ManyChat: ทำงานกี่ครั้ง · CTR (คนที่กดปุ่ม/ลิงก์ ÷ คนที่ได้รับข้อความ) */
function RuleNumbers({ runs, reached, engaged, hasButtons }: { runs: number; reached: number; engaged: number; hasButtons: boolean }) {
  return (
    <p className="mt-1 text-xs text-fg-3 tabular">
      ทำงาน {formatNumber(runs)} ครั้ง · CTR {hasButtons ? formatPercent(rate(engaged, reached)) : "– (ไม่มีปุ่ม)"}
    </p>
  );
}
