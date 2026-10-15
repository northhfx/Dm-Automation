import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, MessageCircle, MessagesSquare, Rocket } from "lucide-react";
import type { Platform } from "@/db/schema";
import { Badge, ButtonLink, cx, PlatformIcon, ProgressBar, tableClass } from "@/components/ui";
import type { SetupStatus } from "@/lib/config";
import { createT, formatters, type Formatters, type Locale, type MessageKey, type TFunction } from "@/lib/i18n";
import { dashboardMessages } from "@/lib/i18n/messages/dashboard";
import { rate, type PlatformCounts, type RuleStats } from "@/lib/stats";
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

// ---------------- แถบตัวเลขสรุป ----------------

export interface Kpi {
  label: string;
  /** คำอธิบายเมื่อชี้เมาส์ที่ชื่อ */
  hint?: string;
  value: string;
  /** เปลี่ยนแปลงเป็น % เทียบช่วงก่อน — undefined = ไม่แสดง (เช่น อัตราการกด), null = ช่วงก่อนเป็น 0 */
  change?: number | null;
  /** บรรทัดเล็กใต้ตัวเลข (ใช้แทนตัวเลขเปลี่ยนแปลงเมื่อไม่มี) */
  note?: ReactNode;
  /** ข้อความเตือนสีแดง เช่น "ไม่สำเร็จ 2" */
  alert?: string;
  href?: string;
}

/** ตำแหน่งในตาราง: มือถือ 1 + 2×2 · แท็บเล็ต 3 + 2 · จอใหญ่ 5 ช่องเรียงกัน */
const KPI_SPANS = [
  "col-span-2 md:col-span-2 xl:col-span-1",
  "md:col-span-2 xl:col-span-1",
  "md:col-span-2 xl:col-span-1",
  "md:col-span-3 xl:col-span-1",
  "md:col-span-3 xl:col-span-1",
];

function ChangeLine({ change, compare, t, f }: { change: number | null; compare: string; t: T; f: Formatters }) {
  if (change === null) return <span className="text-fg-3">{t("noPrevious")}</span>;
  const rounded = Math.round(change);
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : null;
  const tone = rounded > 0 ? "text-good-text" : rounded < 0 ? "text-critical-text" : "text-fg-2";
  return (
    <>
      <span className={cx("inline-flex items-center font-medium tabular", tone)}>
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {`${rounded > 0 ? "+" : ""}${f.number(rounded)}%`}
      </span>
      <span className="text-fg-3">{compare}</span>
    </>
  );
}

/** ตัวเลขสรุปหลายช่องในกรอบเดียว คั่นด้วยเส้นบางๆ (ไม่มีไอคอนสี — ตัวเลขเป็นพระเอก) */
export function KpiStrip({ items, days, locale }: { items: Kpi[]; days: number; locale: Locale }) {
  const t = tOf(locale);
  const f = formatters(locale);
  const compare = t("compareTo", { days });
  return (
    <section aria-label={t("kpiAria")} className="overflow-hidden rounded-xl border border-line bg-line shadow-xs">
      <div className="grid grid-cols-2 gap-px md:grid-cols-6 xl:grid-cols-5">
        {items.map((k, i) => {
          const body = (
            <>
              <p className="truncate text-[13px] leading-5 font-medium text-fg-2" title={k.hint}>
                {k.label}
              </p>
              <p className="mt-1.5 text-[28px] leading-9 font-semibold tracking-tight text-fg">{k.value}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs leading-5">
                {k.change !== undefined ? <ChangeLine change={k.change} compare={compare} t={t} f={f} /> : <span className="text-fg-3">{k.note}</span>}
              </p>
              {k.alert && <p className="text-xs leading-5 font-medium text-critical-text">{k.alert}</p>}
            </>
          );
          const cls = cx("min-w-0 bg-surface px-4 py-4 sm:px-5", KPI_SPANS[i]);
          return k.href ? (
            <Link key={k.label} href={k.href} className={cx(cls, "transition-colors hover:bg-surface-2/60 focus-visible:z-10")}>
              {body}
            </Link>
          ) : (
            <div key={k.label} className={cls}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------- ตารางแยกตามแพลตฟอร์ม ----------------

/** ตาราง 3 แถว × Facebook / Instagram / รวม — hint = บรรทัดเล็กใต้ชื่อแถว (เช่น แยกคอมเมนต์ / แชท) */
export function PlatformTable({ rows, locale }: { rows: { label: string; hint?: string; counts: PlatformCounts }[]; locale: Locale }) {
  const t = tOf(locale);
  const f = formatters(locale);
  const th = "py-2 pl-3 text-right text-xs font-medium text-fg-3 first:pl-0 first:text-left";
  const td = "py-2.5 pl-3 text-right text-sm text-fg-2 tabular first:pl-0 first:text-left first:text-fg";
  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>
              <span className="sr-only">{t("platformTitle")}</span>
            </th>
            <th className={th}>
              <span className="inline-flex items-center gap-1">
                <PlatformIcon platform="facebook" size={12} />
                Facebook
              </span>
            </th>
            <th className={th}>
              <span className="inline-flex items-center gap-1">
                <PlatformIcon platform="instagram" size={12} />
                Instagram
              </span>
            </th>
            <th className={th}>{t("colTotal")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className={cx(td, "font-normal")}>
                {r.label}
                {r.hint && <span className="block text-xs leading-5 text-fg-3">{r.hint}</span>}
              </th>
              <td className={td}>{f.number(r.counts.facebook)}</td>
              <td className={td}>{f.number(r.counts.instagram)}</td>
              <td className={cx(td, "font-semibold text-fg")}>{f.number(r.counts.facebook + r.counts.instagram)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** รายการตัวเลขย่อย (ชื่อซ้าย ค่าขวา) */
export function FactList({ items }: { items: { label: ReactNode; value: ReactNode; href?: string; tone?: "critical" }[] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map((item, i) => {
        const value = (
          <dd className={cx("text-sm font-semibold tabular", item.tone === "critical" ? "text-critical-text" : "text-fg")}>{item.value}</dd>
        );
        return (
          <div key={i} className="flex min-h-10 items-center justify-between gap-3 py-2">
            <dt className="text-sm text-fg-2">{item.label}</dt>
            {item.href ? (
              <Link href={item.href} className="inline-flex items-center gap-1 rounded hover:underline">
                {value}
                <ArrowRight className="size-3.5 text-fg-3" aria-hidden />
              </Link>
            ) : (
              value
            )}
          </div>
        );
      })}
    </dl>
  );
}

// ---------------- ตารางกฎ ----------------

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

const ctrOf = (r: RuleStats, f: Formatters) => (r.hasButtons ? f.percent(rate(r.engaged, r.reached)) : "–");

/** แถวตาราง (จอใหญ่) */
function RuleRow({ rule: r, maxTriggers, t, f }: { rule: RuleStats; maxTriggers: number; t: T; f: Formatters }) {
  return (
    <tr className={tableClass.trHover}>
      <td className={cx(tableClass.td, "max-w-72")}>
        <Link href={`/rules/${r.id}`} className="block truncate font-medium text-fg hover:text-accent">
          {r.name}
        </Link>
        <RuleMeta rule={r} t={t} />
      </td>
      <td className={cx(tableClass.td, tableClass.num)}>
        <div className="flex items-center justify-end gap-2.5">
          <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-surface-3 lg:block" aria-hidden>
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.triggers / maxTriggers) * 100}%` }} />
          </span>
          <span className="min-w-6 font-medium">{f.number(r.triggers)}</span>
        </div>
      </td>
      <td className={cx(tableClass.td, tableClass.num)}>{f.number(r.sent)}</td>
      <td className={cx(tableClass.td, tableClass.num, r.failed > 0 ? "font-medium text-critical-text" : "text-fg-3")}>
        {f.number(r.failed)}
      </td>
      <td className={cx(tableClass.td, tableClass.num)}>{f.percent(rate(r.read, r.sent))}</td>
      <td className={cx(tableClass.td, tableClass.num, "font-medium")}>{ctrOf(r, f)}</td>
    </tr>
  );
}

/** รายการซ้อนกัน (จอมือถือ) */
function RuleListItem({ rule: r, t, f }: { rule: RuleStats; t: T; f: Formatters }) {
  return (
    <li>
      <Link href={`/rules/${r.id}`} className="block px-5 py-3.5 transition-colors active:bg-surface-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{r.name}</p>
            <RuleMeta rule={r} t={t} />
          </div>
          <span className="shrink-0 text-sm font-semibold text-fg tabular">
            {f.number(r.triggers)} <span className="text-xs font-normal text-fg-3">{t("runsUnit")}</span>
          </span>
        </div>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5">
          {[
            { label: t("colSent"), value: f.number(r.sent) },
            { label: t("colFailed"), value: f.number(r.failed), critical: r.failed > 0 },
            { label: t("colRead"), value: f.percent(rate(r.read, r.sent)) },
            { label: t("colCtr"), value: ctrOf(r, f) },
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

/** ตารางผลงานของแต่ละกฎ: จอใหญ่เป็นตาราง จอมือถือเป็นรายการซ้อนกัน */
export function RuleTable({ rules, locale }: { rules: RuleStats[]; locale: Locale }) {
  const t = tOf(locale);
  const f = formatters(locale);
  const maxTriggers = Math.max(1, ...rules.map((r) => r.triggers));
  // ซ่อนเฉพาะเมื่อเหลือมากกว่า 1 กฎ (ไม่ซ่อนแค่กฎเดียว)
  const cut = rules.length > VISIBLE_RULES + 1 ? VISIBLE_RULES : rules.length;
  const top = rules.slice(0, cut);
  const rest = rules.slice(cut);
  const showMore = { more: t("showMoreRules", { count: rest.length }), less: t("showLess") };
  return (
    <>
      <div className={cx(tableClass.wrap, "hidden md:block")}>
        <table className={tableClass.table}>
          <thead className={tableClass.thead}>
            <tr>
              <th className={tableClass.th}>{t("colRule")}</th>
              <th className={cx(tableClass.th, tableClass.num)} title={t("colRunsHint")}>
                {t("colRuns")}
              </th>
              <th className={cx(tableClass.th, tableClass.num)}>{t("colSent")}</th>
              <th className={cx(tableClass.th, tableClass.num)}>{t("colFailed")}</th>
              <th className={cx(tableClass.th, tableClass.num)} title={t("colReadHint")}>
                {t("colRead")}
              </th>
              <th className={cx(tableClass.th, tableClass.num)} title={t("ctrHint")}>
                {t("colCtr")}
              </th>
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <RuleRow key={r.id} rule={r} maxTriggers={maxTriggers} t={t} f={f} />
            ))}
          </tbody>
          {rest.length > 0 && (
            <ShowMore labels={showMore} table={{ colSpan: 6 }}>
              {rest.map((r) => (
                <RuleRow key={r.id} rule={r} maxTriggers={maxTriggers} t={t} f={f} />
              ))}
            </ShowMore>
          )}
        </table>
      </div>

      <div className="md:hidden">
        <ul className="divide-y divide-line">
          {top.map((r) => (
            <RuleListItem key={r.id} rule={r} t={t} f={f} />
          ))}
        </ul>
        {rest.length > 0 && (
          <ShowMore labels={showMore} listClassName="divide-y divide-line border-t border-line">
            {rest.map((r) => (
              <RuleListItem key={r.id} rule={r} t={t} f={f} />
            ))}
          </ShowMore>
        )}
      </div>
    </>
  );
}
