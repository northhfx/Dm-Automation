import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CheckCheck, ChevronLeft, ChevronRight, Inbox, ListFilter } from "lucide-react";
import { getDb } from "@/db/client";
import { pages, type InboxKind, type Platform } from "@/db/schema";
import { SegmentedControl } from "@/components/segmented-control";
import { Badge, buttonStyle, ButtonLink, EmptyState, PageHeader, PlatformIcon } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { inboxPostUrl, inboxReplyLink } from "@/lib/inbox/links";
import { countInboxRows, loadInboxRows, parseInboxPage, sumCounts } from "@/lib/inbox/list";
import { INBOX_RETENTION_DAYS } from "@/lib/inbox/retention";
import { InboxList, ShowDoneSwitch, type InboxRowView } from "./inbox-list";

/*
 * ข้อความรอตอบ: คนที่ทักแชท/คอมเมนต์โดยไม่ตรง keyword ของกฎไหน (ระบบไม่ได้ตอบ) — กดไปตอบเองในแอปของ Meta
 * ข้อมูลมาจาก inbox_items (lib/inbox/*) ลบเองเมื่อครบ INBOX_RETENTION_DAYS วัน
 */

const PAGE_SIZE = 30;

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getT("nav"))("inbox")} · DM Automation` };
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

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const params = await searchParams;
  const kind: InboxKind | null = params.kind === "dm" || params.kind === "comment" ? params.kind : null;
  const platform: Platform | null = params.platform === "facebook" || params.platform === "instagram" ? params.platform : null;
  const showDone = params.done === "1";
  const page = parseInboxPage(params.page);
  const now = new Date();
  const db = getDb();

  const [t, tNav, counts, rows, pageRows] = await Promise.all([
    getT("inbox"),
    getT("nav"),
    countInboxRows(db, showDone, now),
    loadInboxRows(db, { kind, platform, showDone, page, pageSize: PAGE_SIZE }, now),
    db.select({ id: pages.id }).from(pages),
  ]);
  const facebookPageIds = new Set(pageRows.map((p) => p.id));
  const total = sumCounts(counts, kind, platform);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(kind || platform);

  const href = (o: { kind?: InboxKind | null; platform?: Platform | null; done?: boolean; page?: number }) => {
    const next = new URLSearchParams();
    const k = o.kind === undefined ? kind : o.kind;
    const p = o.platform === undefined ? platform : o.platform;
    const d = o.done ?? showDone;
    if (k) next.set("kind", k);
    if (p) next.set("platform", p);
    if (d) next.set("done", "1");
    if (o.page && o.page > 1) next.set("page", String(o.page));
    const s = next.toString();
    return s ? `/inbox?${s}` : "/inbox";
  };

  const views: InboxRowView[] = rows.map((r) => ({
    key: r.key,
    ids: r.ids,
    kind: r.kind,
    platform: r.platform,
    senderName: r.senderName,
    senderUsername: r.senderUsername,
    text: r.text,
    createdAt: r.createdAt.toISOString(),
    handledAt: r.handledAt?.toISOString() ?? null,
    messageCount: r.messageCount,
    reply: inboxReplyLink(r, facebookPageIds),
    postUrl: inboxPostUrl(r),
  }));
  const detailsIds = rows.flatMap((r) => (r.detailsId ? [r.detailsId] : []));

  const header = (
    <PageHeader
      title={tNav("inbox")}
      badge={counts.open > 0 ? <Badge size="md" tone="accent">{t("badgeWaiting", { count: counts.open })}</Badge> : undefined}
      description={t("description", { days: INBOX_RETENTION_DAYS })}
    />
  );

  // ยังไม่เคยมีรายการเลย (ภายใน 30 วัน) → หน้าว่างอธิบายว่าหน้านี้คืออะไร (ไม่ต้องมีคำอธิบายใต้ชื่อหน้าซ้ำ)
  if (counts.open + counts.done === 0) {
    return (
      <>
        <PageHeader title={tNav("inbox")} />
        <EmptyState
          title={t("emptyTitle")}
          icon={<Inbox />}
          action={
            <ButtonLink href="/rules" variant="secondary">
              {t("emptyAction")}
            </ButtonLink>
          }
        >
          {t("emptyBody", { days: INBOX_RETENTION_DAYS })}
        </EmptyState>
      </>
    );
  }

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const pager = (dir: "prev" | "next") => {
    const target = dir === "prev" ? page - 1 : page + 1;
    const enabled = dir === "prev" ? page > 1 : page < pageCount;
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

  let empty: ReactNode = null;
  if (total === 0 && !filtered && !showDone) {
    // ตอบครบทุกคนแล้ว (มีแต่รายการที่เสร็จแล้ว)
    empty = (
      <EmptyState
        title={t("caughtUpTitle")}
        icon={<CheckCheck />}
        compact
        action={
          <ButtonLink href={href({ done: true, page: 1 })} variant="secondary">
            {t("showDoneAction")}
          </ButtonLink>
        }
      >
        {t("caughtUpBody")}
      </EmptyState>
    );
  } else if (total === 0) {
    empty = (
      <EmptyState
        title={t("filteredEmptyTitle")}
        icon={<ListFilter />}
        compact
        action={
          filtered ? (
            <ButtonLink href={href({ kind: null, platform: null, page: 1 })} variant="secondary">
              {t("clearFilters")}
            </ButtonLink>
          ) : undefined
        }
      />
    );
  } else if (rows.length === 0) {
    empty = (
      <EmptyState
        title={t("pageEmptyTitle")}
        icon={<Inbox />}
        compact
        action={
          <ButtonLink href={href({ page: 1 })} variant="secondary">
            {t("backToFirstPage")}
          </ButtonLink>
        }
      />
    );
  }

  return (
    <>
      {header}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label={t("filterKindLabel")}
            value={kind ?? "all"}
            options={[
              { value: "all", label: t("filterAll"), count: sumCounts(counts, null, platform), href: href({ kind: null, page: 1 }) },
              { value: "dm", label: t("filterChats"), count: sumCounts(counts, "dm", platform), href: href({ kind: "dm", page: 1 }) },
              {
                value: "comment",
                label: t("filterComments"),
                count: sumCounts(counts, "comment", platform),
                href: href({ kind: "comment", page: 1 }),
              },
            ]}
          />
          <SegmentedControl
            label={t("filterPlatformLabel")}
            value={platform ?? "all"}
            options={[
              { value: "all", label: t("filterAll"), href: href({ platform: null, page: 1 }) },
              {
                value: "facebook",
                label: <ShortLabel short="FB" full="Facebook" />,
                icon: <PlatformIcon platform="facebook" size={14} />,
                count: sumCounts(counts, kind, "facebook"),
                href: href({ platform: "facebook", page: 1 }),
              },
              {
                value: "instagram",
                label: <ShortLabel short="IG" full="Instagram" />,
                icon: <PlatformIcon platform="instagram" size={14} />,
                count: sumCounts(counts, kind, "instagram"),
                href: href({ platform: "instagram", page: 1 }),
              },
            ]}
          />
          <ShowDoneSwitch checked={showDone} href={href({ done: !showDone, page: 1 })} className="sm:ml-auto" />
        </div>

        {empty ?? (
          <InboxList
            rows={views}
            now={now.toISOString()}
            showDone={showDone}
            detailsIds={detailsIds}
            footer={
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <span className="text-fg-2 tabular">
                  {t("showing", { from, to, total })}
                </span>
                {pageCount > 1 && (
                  <nav aria-label={t("pagerLabel")} className="flex items-center gap-2">
                    {pager("prev")}
                    <span className="px-1 text-fg-3 tabular">
                      {page}/{pageCount}
                    </span>
                    {pager("next")}
                  </nav>
                )}
              </div>
            }
          />
        )}
      </div>
    </>
  );
}
