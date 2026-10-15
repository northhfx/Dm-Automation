import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleAlert, CircleCheck, MessageCircle, MessagesSquare, Rocket, TriangleAlert } from "lucide-react";
import type { Platform } from "@/db/schema";
import { Badge, ButtonLink, cx, PlatformIcon, ProgressBar, tableClass } from "@/components/ui";
import type { SetupStatus } from "@/lib/config";
import { createT, formatters, type Formatters, type Locale, type MessageKey, type TFunction } from "@/lib/i18n";
import { dashboardMessages } from "@/lib/i18n/messages/dashboard";
import type { Problems } from "@/lib/funnel";
import { rate, type RuleStats } from "@/lib/stats";
import { ShowMore } from "./show-more";

/*
 * ส่วนประกอบเฉพาะหน้าภาพรวม (Server Component)
 * ไม่ใช่ async จึงอ่านคุกกี้ภาษาเองไม่ได้ → หน้าส่ง locale มาให้ (ได้จาก getT("dashboard").locale)
 */

type T = TFunction<MessageKey<typeof dashboardMessages>>;

const tOf = (locale: Locale): T => createT(dashboardMessages, locale);

// ---------------- แถบตั้งค่าให้เสร็จ ----------------

/** ขั้นตอนตั้งค่าตามลำดับในคู่มือ (เงื่อนไขเดียวกับ setupProgress) */
function setupSteps(s: SetupStatus, t: T): { done: boolean; label: string; href: string }[] {
  return [
    { done: Boolean(s.baseUrl), label: t("stepBaseUrl"), href: "/guide" },
    { done: Boolean(s.meta.appId && s.meta.appSecret), label: t("stepMetaApp"), href: "/guide" },
    { done: Boolean(s.webhookVerifiedAt), label: t("stepWebhook"), href: "/guide" },
    { done: s.pagesSubscribed > 0 || s.instagram.subscribed > 0, label: t("stepConnect"), href: "/guide" },
    { done: s.ruleCount > 0, label: t("stepFirstRule"), href: "/rules/new" },
    { done: Boolean(s.lastWebhookAt), label: t("stepTest"), href: "/guide" },
  ];
}

export function SetupBanner({ status, done, total, locale }: { status: SetupStatus; done: number; total: number; locale: Locale }) {
  const t = tOf(locale);
  const next = setupSteps(status, t).find((s) => !s.done);
  const left = total - done;
  return (
    <section
      aria-label={t("setupAria")}
      className="rounded-xl border border-accent/25 bg-accent-soft p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
          <Rocket className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-base leading-6 font-semibold text-fg">{t("setupStepsLeft", { count: left })}</p>
          {next && (
            <p className="mt-0.5 text-sm leading-6 text-fg-2">
              {t.rich("setupNext", { step: <span className="font-medium text-fg">{next.label}</span> })}
            </p>
          )}
          <div className="mt-3 flex max-w-md items-center gap-3">
            <ProgressBar value={done} max={total} label={t("setupProgressLabel", { done, total })} />
            <span className="shrink-0 text-xs font-medium text-fg-2 tabular">{t("setupProgressShort", { done, total })}</span>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {next && next.href !== "/guide" && (
            <ButtonLink href="/guide" variant="ghost" className="flex-1 sm:flex-none">
              {t("setupOpenGuide")}
            </ButtonLink>
          )}
          <ButtonLink href={next?.href ?? "/guide"} iconRight={<ArrowRight />} className="flex-1 sm:flex-none">
            {next?.href === "/rules/new" ? t("setupCreateRule") : t("setupGoToGuide")}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

// ---------------- ตัวเลขสรุป ----------------

export interface Kpi {
  label: string;
  /** คำอธิบายเมื่อชี้เมาส์ที่ชื่อ */
  hint?: string;
  value: string;
  /** แยก Facebook / Instagram ใต้ตัวเลข (จัดรูปแบบแล้ว เช่น "68" หรือ "20%") */
  split?: { facebook: string; instagram: string };
  /** บรรทัดเล็กใต้ split เช่น "Contact ใหม่ 85 · เดิม 35" */
  extra?: string;
  /** เปลี่ยนแปลงเทียบช่วงก่อน — null = ช่วงก่อนเป็น 0 / ไม่มีข้อมูล */
  change: number | null;
  /** percent = "+12%" (ตัวเลข), points = "+4.5 จุด" (อัตรา) */
  changeKind?: "percent" | "points";
  href?: string;
}

function ChangeLine({ kpi, compare, t, f }: { kpi: Kpi; compare: string; t: T; f: Formatters }) {
  if (kpi.change === null) return <span className="text-fg-3">{t("noPrevious")}</span>;
  const points = kpi.changeKind === "points";
  const rounded = points ? Math.round(kpi.change * 10) / 10 : Math.round(kpi.change);
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : null;
  const tone = rounded > 0 ? "text-good-text" : rounded < 0 ? "text-critical-text" : "text-fg-2";
  const sign = rounded > 0 ? "+" : "";
  return (
    <>
      <span className={cx("inline-flex items-center font-medium tabular", tone)}>
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {points ? t("points", { value: `${sign}${rounded.toFixed(1)}` }) : `${sign}${f.number(rounded)}%`}
      </span>
      <span className="text-fg-3">{compare}</span>
    </>
  );
}

/** "[f] 68  [ig] 103" */
function SplitLine({ split }: { split: { facebook: string; instagram: string } }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-fg-2">
      <span className="inline-flex items-center gap-1.5">
        <PlatformIcon platform="facebook" size={13} title="Facebook" />
        <span className="font-medium tabular">{split.facebook}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <PlatformIcon platform="instagram" size={13} title="Instagram" />
        <span className="font-medium tabular">{split.instagram}</span>
      </span>
    </span>
  );
}

/** การ์ดตัวเลขสรุป 3 ใบ: มือถือ 1 + 2 · จอกว้าง 3 ใบเรียงกัน */
export function KpiCards({ items, days, locale }: { items: Kpi[]; days: number; locale: Locale }) {
  const t = tOf(locale);
  const f = formatters(locale);
  const compare = t("compareTo", { days });
  return (
    <section aria-label={t("kpiAria")} className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {items.map((k, i) => {
        const body = (
          <>
            <p className="truncate text-sm leading-6 text-fg-2" title={k.hint}>
              {k.label}
            </p>
            <p className="mt-1 text-[30px] leading-9 font-semibold tracking-tight text-fg">{k.value}</p>
            <div className="mt-1.5 min-h-5 text-xs leading-5">{k.split && <SplitLine split={k.split} />}</div>
            {k.extra && <p className="text-xs leading-5 text-fg-3">{k.extra}</p>}
            {/* ล่างสุดของการ์ด: เทียบช่วงก่อน — เส้นคั่นของทุกการ์ดอยู่ระดับเดียวกัน */}
            <div className="min-h-3 flex-1" aria-hidden />
            <p className="flex flex-wrap items-center gap-x-1.5 border-t border-line pt-2.5 text-xs leading-5">
              <ChangeLine kpi={k} compare={compare} t={t} f={f} />
            </p>
          </>
        );
        const cls = cx("flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5", i === 0 && "col-span-2 md:col-span-1");
        return k.href ? (
          <Link key={k.label} href={k.href} className={cx(cls, "transition hover:border-line-strong hover:shadow-sm")}>
            {body}
          </Link>
        ) : (
          <div key={k.label} className={cls}>
            {body}
          </div>
        );
      })}
    </section>
  );
}

// ---------------- ปัญหาที่ต้องดู ----------------

function ProblemItem({
  tone,
  title,
  detail,
  action,
}: {
  tone: "critical" | "warning";
  title: ReactNode;
  detail?: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={cx("mt-0.5 shrink-0 [&_svg]:size-[18px]", tone === "critical" ? "text-critical" : "text-warning")}>
        {tone === "critical" ? <CircleAlert aria-hidden /> : <TriangleAlert aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-6 font-medium text-fg">{title}</p>
        {detail && <p className="text-xs leading-5 [overflow-wrap:anywhere] text-fg-3">{detail}</p>}
      </div>
      {action && (
        <Link href={action.href} className="inline-flex shrink-0 items-center gap-0.5 rounded-md py-0.5 text-[13px] font-medium text-accent hover:underline">
          {action.label}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </li>
  );
}

/** รายการปัญหา (ส่งไม่สำเร็จ / กดปุ่มแล้วไม่มีข้อความถัดไป / ลิงก์เสีย / การเชื่อมต่อ) — ไม่มีเลยขึ้น ✓ */
export function ProblemsList({ problems, locale }: { problems: Problems; locale: Locale }) {
  const t = tOf(locale);
  const f = formatters(locale);
  const count = problems.connections.length + problems.brokenLinks.length + (problems.failedSends > 0 ? 1 : 0) + (problems.deadTaps > 0 ? 1 : 0);
  if (count === 0) {
    return (
      <div className="flex items-start gap-3 py-1">
        <span className="mt-0.5 shrink-0 text-good [&_svg]:size-[18px]">
          <CircleCheck aria-hidden />
        </span>
        <div>
          <p className="text-sm leading-6 font-medium text-fg">{t("problemsNone")}</p>
          <p className="text-xs leading-5 text-fg-3">{t("problemsNoneBody")}</p>
        </div>
      </div>
    );
  }
  return (
    <ul className="-my-3 divide-y divide-line">
      {problems.connections.map((c) => (
        <ProblemItem
          key={`${c.platform}:${c.name}`}
          tone="critical"
          title={t("problemConnection", { name: c.name })}
          detail={t("problemConnectionHint")}
          action={{ href: "/settings", label: t("problemFix") }}
        />
      ))}
      {problems.failedSends > 0 && (
        <ProblemItem
          tone="critical"
          title={t("problemFailed", { count: f.number(problems.failedSends) })}
          detail={problems.failedAfterTap > 0 ? t("problemFailedAfterTap", { count: f.number(problems.failedAfterTap) }) : t("problemFailedHint")}
          action={{ href: "/activity?filter=failed", label: t("problemView") }}
        />
      )}
      {problems.deadTaps > 0 && (
        <ProblemItem
          tone="warning"
          title={t("problemDeadTaps", { count: f.number(problems.deadTaps) })}
          detail={t("problemDeadTapsHint")}
          action={{ href: "/activity", label: t("problemView") }}
        />
      )}
      {problems.brokenLinks.map((l) => (
        <ProblemItem
          key={l.url}
          tone="critical"
          title={t("problemBrokenLink")}
          detail={
            <>
              <span className="block truncate text-fg-2" title={l.url}>
                {l.url}
              </span>
              {t("problemBrokenLinkDetail", {
                reason: l.status !== null ? t("linkReasonStatus", { status: String(l.status) }) : t("linkReasonError", { error: l.error ?? "" }),
                rules: f.list(l.ruleNames),
              })}
            </>
          }
          action={{ href: "/rules", label: t("problemFix") }}
        />
      ))}
    </ul>
  );
}

/** รายการตัวเลขย่อย (ชื่อซ้าย ค่าขวา) */
export function FactList({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map((item, i) => (
        <div key={i} className="flex min-h-10 items-center justify-between gap-3 py-2">
          <dt className="text-sm text-fg-2">{item.label}</dt>
          <dd className="text-sm font-semibold text-fg tabular">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------- ตารางกฎ ----------------

export interface RuleRowData {
  rule: RuleStats;
  typed: number;
  clicked: number;
  /** กฎนี้มีปุ่มลิงก์ไหม (ไม่มี = คลิก / อัตราคลิกเป็น "–") */
  hasLinks: boolean;
}

function TriggerBadge({ trigger, t }: { trigger: RuleStats["trigger"]; t: T }) {
  return trigger === "comment" ? (
    <Badge tone="outline" icon={<MessageCircle />}>
      {t("triggerComment")}
    </Badge>
  ) : (
    <Badge tone="outline" icon={<MessagesSquare />}>
      {t("triggerDm")}
    </Badge>
  );
}

function PlatformIcons({ platforms }: { platforms: Platform[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {platforms.map((p) => (
        <PlatformIcon key={p} platform={p} size={16} title={p === "instagram" ? "Instagram" : "Facebook"} />
      ))}
    </span>
  );
}

function RuleMeta({ rule, t }: { rule: RuleStats; t: T }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <TriggerBadge trigger={rule.trigger} t={t} />
      <PlatformIcons platforms={rule.platforms} />
      {!rule.active && (
        <Badge tone="neutral" dot>
          {t("ruleOff")}
        </Badge>
      )}
    </div>
  );
}

const clickedOf = (r: RuleRowData, f: Formatters) => (r.hasLinks ? f.number(r.clicked) : "–");
const rateOf = (r: RuleRowData, f: Formatters) => (r.hasLinks ? f.percent(rate(r.clicked, r.typed)) : "–");

/** แถวตาราง (จอใหญ่) */
function RuleRow({ row: r, maxTyped, t, f }: { row: RuleRowData; maxTyped: number; t: T; f: Formatters }) {
  return (
    <tr className={tableClass.trHover}>
      <td className={cx(tableClass.td, "max-w-72")}>
        <Link href={`/rules/${r.rule.id}`} className="block truncate font-medium text-fg hover:text-accent">
          {r.rule.name}
        </Link>
        <RuleMeta rule={r.rule} t={t} />
      </td>
      <td className={cx(tableClass.td, tableClass.num)}>
        <div className="flex items-center justify-end gap-2.5">
          <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-surface-3 lg:block" aria-hidden>
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.typed / maxTyped) * 100}%` }} />
          </span>
          <span className="min-w-6 font-medium">{f.number(r.typed)}</span>
        </div>
      </td>
      <td className={cx(tableClass.td, tableClass.num)}>{clickedOf(r, f)}</td>
      <td className={cx(tableClass.td, tableClass.num, "font-medium")}>{rateOf(r, f)}</td>
      <td className={cx(tableClass.td, tableClass.num, r.rule.failed > 0 ? "font-medium text-critical-text" : "text-fg-3")}>
        {f.number(r.rule.failed)}
      </td>
    </tr>
  );
}

/** รายการซ้อนกัน (จอมือถือ) */
function RuleListItem({ row: r, t, f }: { row: RuleRowData; t: T; f: Formatters }) {
  return (
    <li>
      <Link href={`/rules/${r.rule.id}`} className="block px-5 py-3.5 transition-colors active:bg-surface-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{r.rule.name}</p>
            <RuleMeta rule={r.rule} t={t} />
          </div>
          <span className="shrink-0 text-sm font-semibold text-fg tabular">
            {f.number(r.typed)} <span className="text-xs font-normal text-fg-3">{t("peopleUnit")}</span>
          </span>
        </div>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5">
          {[
            { label: t("colClicked"), value: clickedOf(r, f) },
            { label: t("colClickRate"), value: rateOf(r, f) },
            { label: t("colFailed"), value: f.number(r.rule.failed), critical: r.rule.failed > 0 },
          ].map((s) => (
            <div key={s.label} className="flex gap-1">
              <dt className="text-fg-3">{s.label}</dt>
              <dd className={cx("font-medium tabular", s.critical ? "text-critical-text" : "text-fg-2")}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </Link>
    </li>
  );
}

/** แสดงกฎอันดับต้นๆ ก่อน ที่เหลือกด "แสดงอีก" */
const VISIBLE_RULES = 5;

/** ตารางผลของแต่ละกฎ (เรียงตามคนพิมพ์ keyword): จอใหญ่เป็นตาราง จอมือถือเป็นรายการซ้อนกัน */
export function RuleTable({ rows, locale }: { rows: RuleRowData[]; locale: Locale }) {
  const t = tOf(locale);
  const f = formatters(locale);
  const maxTyped = Math.max(1, ...rows.map((r) => r.typed));
  // ซ่อนเฉพาะเมื่อเหลือมากกว่า 1 กฎ (ไม่ซ่อนแค่กฎเดียว)
  const cut = rows.length > VISIBLE_RULES + 1 ? VISIBLE_RULES : rows.length;
  const top = rows.slice(0, cut);
  const rest = rows.slice(cut);
  const showMore = { more: t("showMoreRules", { count: rest.length }), less: t("showLess") };
  return (
    <>
      <div className={cx(tableClass.wrap, "hidden md:block")}>
        <table className={tableClass.table}>
          <thead className={tableClass.thead}>
            <tr>
              <th className={tableClass.th}>{t("colRule")}</th>
              <th className={cx(tableClass.th, tableClass.num)} title={t("statTypedHint")}>
                {t("colTyped")}
              </th>
              <th className={cx(tableClass.th, tableClass.num)} title={t("statClickedHint")}>
                {t("colClicked")}
              </th>
              <th className={cx(tableClass.th, tableClass.num)} title={t("colClickRateHint")}>
                {t("colClickRate")}
              </th>
              <th className={cx(tableClass.th, tableClass.num)} title={t("colFailedHint")}>
                {t("colFailed")}
              </th>
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <RuleRow key={r.rule.id} row={r} maxTyped={maxTyped} t={t} f={f} />
            ))}
          </tbody>
          {rest.length > 0 && (
            <ShowMore labels={showMore} table={{ colSpan: 5 }}>
              {rest.map((r) => (
                <RuleRow key={r.rule.id} row={r} maxTyped={maxTyped} t={t} f={f} />
              ))}
            </ShowMore>
          )}
        </table>
      </div>

      <div className="md:hidden">
        <ul className="divide-y divide-line">
          {top.map((r) => (
            <RuleListItem key={r.rule.id} row={r} t={t} f={f} />
          ))}
        </ul>
        {rest.length > 0 && (
          <ShowMore labels={showMore} listClassName="divide-y divide-line border-t border-line">
            {rest.map((r) => (
              <RuleListItem key={r.rule.id} row={r} t={t} f={f} />
            ))}
          </ShowMore>
        )}
      </div>
    </>
  );
}
