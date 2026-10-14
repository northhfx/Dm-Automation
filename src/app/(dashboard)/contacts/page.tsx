import { sql } from "drizzle-orm";
import { ArrowUpRight, ChevronLeft, ChevronRight, MessageCircle, MessagesSquare, Search, SearchX, Users, X } from "lucide-react";
import { getDb } from "@/db/client";
import type { Platform } from "@/db/schema";
import { NavTitle } from "@/components/localized";
import { SegmentedControl } from "@/components/segmented-control";
import {
  Avatar,
  Badge,
  buttonStyle,
  ButtonLink,
  Card,
  cx,
  EmptyState,
  inputClass,
  PageHeader,
  PlatformIcon,
  tableClass,
} from "@/components/ui";
import type { MessageKey, TFunction } from "@/lib/i18n";
import type { contactsMessages } from "@/lib/i18n/messages/contacts";
import { getFormat, getT } from "@/lib/i18n/server";
import { RelativeTime } from "../activity/timeline";
import { loadPreviews, type Preview } from "./load-previews";

const PAGE_SIZE = 50;

/** ตัวแปลของหน้านี้ — คอมโพเนนต์ย่อยไม่ใช่ async จึงรับ t จากหน้า */
type T = TFunction<MessageKey<typeof contactsMessages>>;

interface ContactRow {
  id: number;
  platform: Platform;
  page_id: string;
  platform_user_id: string;
  name: string | null;
  username: string | null;
  first_seen_at: Date | string;
  last_inbound_at: Date | string | null;
  sent: number;
  clicks: number;
}

const PLATFORM_LABEL: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram" };

function hasName(c: ContactRow): boolean {
  return Boolean(c.name || c.username);
}

/** Meta ไม่ส่งชื่อมาให้ (แอปยังไม่ผ่าน App Review) → เรียกว่า "ผู้ใช้ Facebook" แทน */
function displayName(c: ContactRow, t: T): string {
  return c.name ?? (c.username ? `@${c.username}` : t("unknownPerson", { platform: PLATFORM_LABEL[c.platform] }));
}

/**
 * ลิงก์ไปคุยต่อในแอปของ Meta: Facebook เปิดห้องแชทใน Meta Business Suite ได้ตรงๆ
 * Instagram ไม่มีลิงก์เข้าห้องแชท จึงเปิดหน้าโปรไฟล์ (ต้องรู้ username) ให้กดส่งข้อความต่อเอง
 */
function chatLink(c: ContactRow, t: T): { href: string; where: string; hint: string } | null {
  if (c.platform === "facebook") {
    const page = encodeURIComponent(c.page_id);
    const user = encodeURIComponent(c.platform_user_id);
    return {
      href: `https://business.facebook.com/latest/inbox/all?asset_id=${page}&mailbox_id=${page}&selected_item_id=${user}&thread_type=FB_MESSAGE`,
      where: "Meta Business Suite",
      hint: t("openChatHintMessenger"),
    };
  }
  if (c.username) {
    return {
      href: `https://www.instagram.com/${encodeURIComponent(c.username)}/`,
      where: "Instagram",
      hint: t("openChatHintInstagram"),
    };
  }
  return null;
}

/** ปุ่มเล็ก "เปิดแชท" (เปิดแท็บใหม่) — ไม่แสดงถ้าไม่มีที่ให้ลิงก์ไป */
function ChatLink({ contact, t, size = "md" }: { contact: ContactRow; t: T; size?: "sm" | "md" }) {
  const link = chatLink(contact, t);
  if (!link) return null;
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("openChatAria", { person: displayName(contact, t), where: link.where })}
      title={link.hint}
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-md font-medium whitespace-nowrap text-accent transition-colors hover:bg-accent-soft active:bg-accent-soft-hover",
        size === "sm" ? "-mr-1.5 h-6 px-1.5 text-xs [&_svg]:size-3.5" : "h-8 px-2.5 text-[13px] [&_svg]:size-4",
      )}
    >
      {t("openChat")}
      <ArrowUpRight aria-hidden />
    </a>
  );
}

/** ข้อความล่าสุดของลูกค้า บรรทัดเดียว */
function PreviewLine({ preview, t }: { preview: Preview; t: T }) {
  const Icon = preview.via === "comment" ? MessageCircle : MessagesSquare;
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-fg-2" title={preview.text}>
      <Icon className="size-3.5 shrink-0 text-fg-3" aria-hidden />
      <span className="sr-only">{preview.via === "comment" ? t("previewComment") : t("previewChat")}</span>
      <span className="truncate">{preview.text}</span>
    </p>
  );
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

function NameText({ contact: c, t }: { contact: ContactRow; t: T }) {
  return <p className={cx("truncate", hasName(c) ? "font-medium text-fg" : "text-fg-3")}>{displayName(c, t)}</p>;
}

function NameCell({ contact: c, preview, t }: { contact: ContactRow; preview?: Preview; t: T }) {
  return (
    <div className="min-w-0">
      <NameText contact={c} t={t} />
      {c.name && c.username && <p className="truncate text-xs text-fg-3">@{c.username}</p>}
      {!hasName(c) && preview && <PreviewLine preview={preview} t={t} />}
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
  const [t, f] = await Promise.all([getT("contacts"), getFormat()]);
  const locale = t.locale;

  const search = q ? sql`(c.name ILIKE ${like} OR c.username ILIKE ${like} OR c.platform_user_id = ${q})` : sql`true`;
  const platformFilter = platform ? sql`c.platform = ${platform}` : sql`true`;
  const [rows, countRows] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      SELECT c.id, c.platform, c.page_id, c.platform_user_id, c.name, c.username, c.first_seen_at, c.last_inbound_at,
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
  // ข้อความล่าสุดใช้แทนชื่อ จึงดึงเฉพาะคนที่ Meta ไม่ให้ชื่อมา
  const previews = await loadPreviews(db, contacts.filter((c) => !hasName(c)).map((c) => c.id));
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
    const label = dir === "prev" ? t("prev") : t("next");
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
        title={<NavTitle name="contacts" />}
        badge={all > 0 && !q ? <Badge size="md">{t("badgeTotal", { count: all })}</Badge> : undefined}
        description={t("description")}
      />

      {all === 0 && !q ? (
        <EmptyState
          title={t("emptyTitle")}
          icon={<Users />}
          action={
            <ButtonLink href="/rules" variant="secondary">
              {t("emptyAction")}
            </ButtonLink>
          }
        >
          {t("emptyBody")}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <form action="/contacts" role="search" className="flex min-w-0 flex-1 basis-72 gap-2">
              {platform && <input type="hidden" name="platform" value={platform} />}
              <label htmlFor="contact-search" className="sr-only">
                {t("searchLabel")}
              </label>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
                <input
                  id="contact-search"
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder={t("searchPlaceholder")}
                  className={cx(inputClass, "pl-9")}
                />
              </div>
              <button type="submit" className={buttonStyle("secondary", "md")}>
                {t("searchButton")}
              </button>
            </form>
            <SegmentedControl
              label={t("platformLabel")}
              value={platform ?? "all"}
              options={[
                { value: "all", label: t("filterAll"), count: all, href: href({ platform: null, page: 1 }) },
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
              <span>{t.rich("searchResult", { query: <span className="font-medium text-fg">{q}</span>, count: total })}</span>
              <ButtonLink href={href({ q: "", page: 1 })} variant="ghost" size="sm" icon={<X />}>
                {t("clearSearch")}
              </ButtonLink>
            </div>
          )}

          {contacts.length === 0 ? (
            <EmptyState
              title={
                q
                  ? t("notFoundTitle", { query: q })
                  : total > 0
                    ? t("pageEmptyTitle")
                    : t("platformEmptyTitle", { platform: platform ? PLATFORM_LABEL[platform] : t("platformFallback") })
              }
              icon={q ? <SearchX /> : <Users />}
              compact
              action={
                <ButtonLink href={total > 0 ? href({ page: 1 }) : "/contacts"} variant="secondary">
                  {total > 0 ? t("backToFirstPage") : t("viewAll")}
                </ButtonLink>
              }
            >
              {q ? t("notFoundBody") : undefined}
            </EmptyState>
          ) : (
            <Card
              padding="none"
              footer={
                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                  <span className="text-fg-2 tabular">{t("showing", { from, to, total })}</span>
                  {pages > 1 && (
                    <nav aria-label={t("pagerLabel")} className="flex items-center gap-2">
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
                      <th className={tableClass.th}>{t("colContact")}</th>
                      <th className={tableClass.th}>{t("colPlatform")}</th>
                      <th className={tableClass.th}>{t("colFirstSeen")}</th>
                      <th className={tableClass.th}>{t("colLastInbound")}</th>
                      <th className={cx(tableClass.th, tableClass.num)}>{t("colSent")}</th>
                      <th className={cx(tableClass.th, tableClass.num)} title={t("colClicksHint")}>
                        {t("colClicks")}
                      </th>
                      <th className={tableClass.th}>
                        <span className="sr-only">{t("openChat")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id} className={tableClass.trHover}>
                        <td className={cx(tableClass.td, "max-w-80")}>
                          <div className="flex items-center gap-3">
                            <ContactAvatar contact={c} badge={false} />
                            <NameCell contact={c} preview={previews.get(c.id)} t={t} />
                          </div>
                        </td>
                        <td className={cx(tableClass.td, "text-fg-2")}>
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <PlatformIcon platform={c.platform} size={14} />
                            {PLATFORM_LABEL[c.platform]}
                          </span>
                        </td>
                        <td className={cx(tableClass.td, "text-fg-2")}>
                          <RelativeTime date={c.first_seen_at} now={now} locale={locale} />
                        </td>
                        <td className={cx(tableClass.td, "text-fg-2")}>
                          {c.last_inbound_at ? (
                            <RelativeTime date={c.last_inbound_at} now={now} locale={locale} />
                          ) : (
                            <span className="text-fg-3">{t("neverMessaged")}</span>
                          )}
                        </td>
                        <td className={cx(tableClass.td, tableClass.num)}>{f.number(c.sent)}</td>
                        <td className={cx(tableClass.td, tableClass.num, c.clicks > 0 ? "font-medium text-fg" : "text-fg-3")}>
                          {f.number(c.clicks)}
                        </td>
                        <td className={cx(tableClass.td, "text-right")}>
                          <ChatLink contact={c} t={t} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* มือถือ: รายการ */}
              <ul className="divide-y divide-line md:hidden">
                {contacts.map((c) => {
                  const preview = hasName(c) ? undefined : previews.get(c.id);
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <ContactAvatar contact={c} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <NameText contact={c} t={t} />
                          <RelativeTime date={c.last_inbound_at ?? c.first_seen_at} now={now} locale={locale} className="shrink-0 text-xs text-fg-3" />
                        </div>
                        {preview && <PreviewLine preview={preview} t={t} />}
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs leading-5 text-fg-3">
                            {c.name && c.username ? `@${c.username} · ` : ""}
                            {t("mobileStats", { sent: c.sent, clicks: c.clicks })}
                          </p>
                          <ChatLink contact={c} t={t} size="sm" />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
