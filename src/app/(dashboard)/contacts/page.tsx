import { sql } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Search, SearchX, Users, X } from "lucide-react";
import { getDb } from "@/db/client";
import type { Platform } from "@/db/schema";
import { SegmentedControl } from "@/components/segmented-control";
import {
  Avatar,
  Badge,
  buttonStyle,
  ButtonLink,
  Card,
  cx,
  EmptyState,
  formatNumber,
  inputClass,
  PageHeader,
  PlatformIcon,
  tableClass,
} from "@/components/ui";
import { RelativeTime } from "../activity/timeline";

const PAGE_SIZE = 50;

interface ContactRow {
  id: number;
  platform: Platform;
  name: string | null;
  username: string | null;
  first_seen_at: Date | string;
  last_inbound_at: Date | string | null;
  sent: number;
  clicks: number;
}

const PLATFORM_LABEL: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram" };

function displayName(c: ContactRow): string {
  return c.name ?? (c.username ? `@${c.username}` : "ไม่ทราบชื่อ");
}

/** รูปโปรไฟล์ตัวอักษรย่อ + ไอคอนแพลตฟอร์มที่มุม */
function ContactAvatar({ contact, badge = true }: { contact: ContactRow; badge?: boolean }) {
  return (
    <span className="relative shrink-0">
      <Avatar name={contact.name ?? contact.username} size="lg" />
      {badge && (
        <PlatformIcon
          platform={contact.platform}
          size={14}
          title={PLATFORM_LABEL[contact.platform]}
          className="absolute -right-0.5 -bottom-0.5 ring-2 ring-surface"
        />
      )}
    </span>
  );
}

/** ชื่อย่อบนมือถือ ชื่อเต็มบนจอใหญ่ */
function ShortLabel({ short, full }: { short: string; full: string }) {
  return (
    <>
      <span className="sm:hidden" aria-hidden>
        {short}
      </span>
      <span className="max-sm:sr-only">{full}</span>
    </>
  );
}

function NameCell({ contact: c }: { contact: ContactRow }) {
  return (
    <div className="min-w-0">
      <p className={cx("truncate font-medium", c.name || c.username ? "text-fg" : "text-fg-3")}>{displayName(c)}</p>
      {c.name && c.username && <p className="truncate text-xs text-fg-3">@{c.username}</p>}
    </div>
  );
}

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const platform: Platform | null = params.platform === "facebook" || params.platform === "instagram" ? params.platform : null;
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const like = `%${q}%`;
  const now = new Date();
  const db = getDb();

  const search = q ? sql`(c.name ILIKE ${like} OR c.username ILIKE ${like} OR c.platform_user_id = ${q})` : sql`true`;
  const platformFilter = platform ? sql`c.platform = ${platform}` : sql`true`;
  const [rows, countRows] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      SELECT c.id, c.platform, c.name, c.username, c.first_seen_at, c.last_inbound_at,
        (SELECT count(*)::int FROM messages m WHERE m.contact_id = c.id AND m.status = 'sent') AS sent,
        (SELECT coalesce(sum(l.clicks), 0)::int FROM links l WHERE l.contact_id = c.id) AS clicks
      FROM contacts c WHERE ${search} AND ${platformFilter}
      ORDER BY coalesce(c.last_inbound_at, c.first_seen_at) DESC
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `),
    // จำนวนแยกแพลตฟอร์ม (ตามคำค้น) ใช้ทั้งตัวเลขในตัวกรองและนับจำนวนหน้า
    db.execute<Record<string, unknown>>(sql`SELECT c.platform, count(*)::int AS n FROM contacts c WHERE ${search} GROUP BY c.platform`),
  ]);
  const contacts = rows.rows as unknown as ContactRow[];
  const counts: Record<Platform, number> = { facebook: 0, instagram: 0 };
  for (const r of countRows.rows) {
    if (r.platform === "facebook" || r.platform === "instagram") counts[r.platform] = Number(r.n ?? 0);
  }
  const all = counts.facebook + counts.instagram;
  const total = platform ? counts[platform] : all;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (opts: { page?: number; platform?: Platform | null; q?: string }) => {
    const next = new URLSearchParams();
    const nq = opts.q ?? q;
    const np = opts.platform === undefined ? platform : opts.platform;
    if (nq) next.set("q", nq);
    if (np) next.set("platform", np);
    if (opts.page && opts.page > 1) next.set("page", String(opts.page));
    const s = next.toString();
    return s ? `/contacts?${s}` : "/contacts";
  };
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  const pager = (dir: "prev" | "next") => {
    const target = dir === "prev" ? page - 1 : page + 1;
    const enabled = dir === "prev" ? page > 1 : page < pages;
    const icon = dir === "prev" ? <ChevronLeft /> : <ChevronRight />;
    const label = dir === "prev" ? "ก่อนหน้า" : "ถัดไป";
    if (!enabled) {
      return (
        <span aria-disabled className={buttonStyle("secondary", "md")}>
          {dir === "prev" && icon}
          {label}
          {dir === "next" && icon}
        </span>
      );
    }
    return (
      <ButtonLink
        href={href({ page: target })}
        variant="secondary"
        icon={dir === "prev" ? icon : undefined}
        iconRight={dir === "next" ? icon : undefined}
      >
        {label}
      </ButtonLink>
    );
  };

  return (
    <>
      <PageHeader
        title="รายชื่อลูกค้า"
        badge={all > 0 && !q ? <Badge size="md">{formatNumber(all)} คน</Badge> : undefined}
        description="คนที่เคยคุยกับเพจ หรือได้รับ DM จากระบบ เรียงตามคนที่ทักมาล่าสุด"
      />

      {all === 0 && !q ? (
        <EmptyState
          title="ยังไม่มีลูกค้า"
          icon={<Users />}
          action={
            <ButtonLink href="/rules" variant="secondary">
              ดูกฎอัตโนมัติ
            </ButtonLink>
          }
        >
          เมื่อระบบส่ง DM หรือมีคนทักแชทเพจ รายชื่อจะแสดงที่นี่โดยอัตโนมัติ
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <form action="/contacts" role="search" className="flex min-w-0 flex-1 basis-72 gap-2">
              {platform && <input type="hidden" name="platform" value={platform} />}
              <label htmlFor="contact-search" className="sr-only">
                ค้นหาลูกค้า
              </label>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
                <input
                  id="contact-search"
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="ค้นหาชื่อ หรือ username"
                  className={cx(inputClass, "pl-9")}
                />
              </div>
              <button type="submit" className={buttonStyle("secondary", "md")}>
                ค้นหา
              </button>
            </form>
            <SegmentedControl
              label="แพลตฟอร์ม"
              value={platform ?? "all"}
              options={[
                { value: "all", label: "ทั้งหมด", count: all, href: href({ platform: null, page: 1 }) },
                {
                  value: "facebook",
                  label: <ShortLabel short="FB" full="Facebook" />,
                  icon: <PlatformIcon platform="facebook" size={14} />,
                  count: counts.facebook,
                  href: href({ platform: "facebook", page: 1 }),
                },
                {
                  value: "instagram",
                  label: <ShortLabel short="IG" full="Instagram" />,
                  icon: <PlatformIcon platform="instagram" size={14} />,
                  count: counts.instagram,
                  href: href({ platform: "instagram", page: 1 }),
                },
              ]}
            />
          </div>

          {q && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-fg-2">
              <span>
                ผลการค้นหา “<span className="font-medium text-fg">{q}</span>” · {formatNumber(total)} คน
              </span>
              <ButtonLink href={href({ q: "", page: 1 })} variant="ghost" size="sm" icon={<X />}>
                ล้างการค้นหา
              </ButtonLink>
            </div>
          )}

          {contacts.length === 0 ? (
            <EmptyState
              title={
                q
                  ? `ไม่พบ “${q}”`
                  : total > 0
                    ? "ไม่มีรายการในหน้านี้"
                    : `ยังไม่มีลูกค้าจาก ${platform ? PLATFORM_LABEL[platform] : "แพลตฟอร์มนี้"}`
              }
              icon={q ? <SearchX /> : <Users />}
              compact
              action={
                <ButtonLink href={total > 0 ? href({ page: 1 }) : "/contacts"} variant="secondary">
                  {total > 0 ? "กลับไปหน้าแรก" : "ดูรายชื่อทั้งหมด"}
                </ButtonLink>
              }
            >
              {q ? "ลองค้นด้วยชื่ออื่น หรือ username ของลูกค้า" : undefined}
            </EmptyState>
          ) : (
            <Card
              padding="none"
              footer={
                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                  <span className="text-fg-2 tabular">
                    แสดง {formatNumber(from)}–{formatNumber(to)} จาก {formatNumber(total)} คน
                  </span>
                  {pages > 1 && (
                    <nav aria-label="เปลี่ยนหน้า" className="flex items-center gap-2">
                      {pager("prev")}
                      <span className="px-1 text-fg-3 tabular">
                        {page}/{pages}
                      </span>
                      {pager("next")}
                    </nav>
                  )}
                </div>
              }
            >
              {/* จอใหญ่: ตาราง */}
              <div className={cx(tableClass.wrap, "hidden md:block")}>
                <table className={tableClass.table}>
                  <thead className={tableClass.thead}>
                    <tr>
                      <th className={tableClass.th}>ลูกค้า</th>
                      <th className={tableClass.th}>ช่องทาง</th>
                      <th className={tableClass.th}>เจอครั้งแรก</th>
                      <th className={tableClass.th}>ทักมาล่าสุด</th>
                      <th className={cx(tableClass.th, tableClass.num)}>DM ที่ได้รับ</th>
                      <th className={cx(tableClass.th, tableClass.num)} title="จำนวนครั้งที่คลิกลิงก์ในข้อความ (ไม่รวมการกดปุ่มที่ส่งข้อความถัดไป)">
                        คลิกลิงก์
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id} className={tableClass.trHover}>
                        <td className={cx(tableClass.td, "max-w-80")}>
                          <div className="flex items-center gap-3">
                            <ContactAvatar contact={c} badge={false} />
                            <NameCell contact={c} />
                          </div>
                        </td>
                        <td className={cx(tableClass.td, "text-fg-2")}>
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <PlatformIcon platform={c.platform} size={14} />
                            {PLATFORM_LABEL[c.platform]}
                          </span>
                        </td>
                        <td className={cx(tableClass.td, "text-fg-2")}>
                          <RelativeTime date={c.first_seen_at} now={now} />
                        </td>
                        <td className={cx(tableClass.td, "text-fg-2")}>
                          {c.last_inbound_at ? <RelativeTime date={c.last_inbound_at} now={now} /> : <span className="text-fg-3">ยังไม่เคยทัก</span>}
                        </td>
                        <td className={cx(tableClass.td, tableClass.num)}>{formatNumber(c.sent)}</td>
                        <td className={cx(tableClass.td, tableClass.num, c.clicks > 0 ? "font-medium text-fg" : "text-fg-3")}>
                          {formatNumber(c.clicks)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* มือถือ: รายการ */}
              <ul className="divide-y divide-line md:hidden">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <ContactAvatar contact={c} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cx("truncate font-medium", c.name || c.username ? "text-fg" : "text-fg-3")}>{displayName(c)}</p>
                        <RelativeTime date={c.last_inbound_at ?? c.first_seen_at} now={now} className="shrink-0 text-xs text-fg-3" />
                      </div>
                      <p className="truncate text-xs leading-5 text-fg-3">
                        {c.name && c.username ? `@${c.username} · ` : ""}
                        DM {formatNumber(c.sent)} · คลิกลิงก์ {formatNumber(c.clicks)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
