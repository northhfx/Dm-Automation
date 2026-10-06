import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rules } from "@/db/schema";
import { Badge, buttonClass, EmptyState, PageHeader } from "@/components/ui";
import { toggleRule } from "./actions";

const MATCH_LABEL = { contains: "มีคำว่า", exact: "ตรงกับ", any: "ทุกข้อความ" } as const;

export default async function RulesPage() {
  const list = await getDb().select().from(rules).orderBy(asc(rules.priority), asc(rules.id));

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
          <p>ตัวอย่าง: ใครคอมเมนต์ว่า &quot;สนใจ&quot; → ตอบคอมเมนต์ + ส่งลิงก์สินค้าทาง DM</p>
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
                  {rule.linkUrl && <Badge>มีลิงก์</Badge>}
                </div>
                <p className="mt-2 line-clamp-1 text-sm text-fg-2">{rule.dmText}</p>
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
