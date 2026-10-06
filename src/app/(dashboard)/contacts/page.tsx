import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { buttonClass, EmptyState, formatDateTime, formatNumber, inputClass, PageHeader, PlatformBadge } from "@/components/ui";

const PAGE_SIZE = 50;

interface ContactRow {
  id: number;
  platform: string;
  name: string | null;
  username: string | null;
  first_seen_at: string;
  last_inbound_at: string | null;
  sent: number;
  clicks: number;
}

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const like = `%${q}%`;
  const db = getDb();

  const where = q ? sql`WHERE c.name ILIKE ${like} OR c.username ILIKE ${like} OR c.platform_user_id = ${q}` : sql``;
  const [rows, count] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      SELECT c.id, c.platform, c.name, c.username, c.first_seen_at, c.last_inbound_at,
        (SELECT count(*)::int FROM messages m WHERE m.contact_id = c.id AND m.status = 'sent') AS sent,
        (SELECT coalesce(sum(l.clicks), 0)::int FROM links l WHERE l.contact_id = c.id) AS clicks
      FROM contacts c ${where}
      ORDER BY coalesce(c.last_inbound_at, c.first_seen_at) DESC
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `),
    db.execute<Record<string, unknown>>(sql`SELECT count(*)::int AS n FROM contacts c ${where}`),
  ]);
  const contacts = rows.rows as unknown as ContactRow[];
  const total = Number(count.rows[0]?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `/contacts?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="รายชื่อลูกค้า" description={`ทั้งหมด ${formatNumber(total)} คน · คนที่คุยกับเพจหรือได้รับ DM จากระบบ`} />

      <form className="mb-4 flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="ค้นหาชื่อหรือ username" className={inputClass} />
        <button className={buttonClass.secondary}>ค้นหา</button>
      </form>

      {contacts.length === 0 ? (
        <EmptyState title={q ? "ไม่พบรายชื่อที่ค้นหา" : "ยังไม่มีลูกค้า"}>
          {!q && "เมื่อระบบส่ง DM หรือมีคนทักแชทมา รายชื่อจะแสดงที่นี่"}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-fg-3">
              <tr>
                <th className="px-4 py-2.5 font-medium">ชื่อ</th>
                <th className="px-4 py-2.5 font-medium">แพลตฟอร์ม</th>
                <th className="px-4 py-2.5 font-medium">เจอครั้งแรก</th>
                <th className="px-4 py-2.5 font-medium">ทักมาล่าสุด</th>
                <th className="px-4 py-2.5 text-right font-medium">DM ที่ได้รับ</th>
                <th className="px-4 py-2.5 text-right font-medium">คลิก</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{c.name ?? (c.username ? `@${c.username}` : "ไม่ทราบชื่อ")}</div>
                    {c.name && c.username && <div className="text-xs text-fg-3">@{c.username}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <PlatformBadge platform={c.platform} />
                  </td>
                  <td className="px-4 py-2.5 text-fg-2">{formatDateTime(c.first_seen_at)}</td>
                  <td className="px-4 py-2.5 text-fg-2">{formatDateTime(c.last_inbound_at)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{formatNumber(c.sent)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{formatNumber(c.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={href(page - 1)} className={buttonClass.secondary}>
              ก่อนหน้า
            </Link>
          )}
          <span className="text-fg-2">
            หน้า {page} / {pages}
          </span>
          {page < pages && (
            <Link href={href(page + 1)} className={buttonClass.secondary}>
              ถัดไป
            </Link>
          )}
        </div>
      )}
    </>
  );
}
