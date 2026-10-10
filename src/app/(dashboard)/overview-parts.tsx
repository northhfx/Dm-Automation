import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, MessageCircle, MessagesSquare, Rocket, Zap } from "lucide-react";
import type { Platform } from "@/db/schema";
import { Badge, ButtonLink, cx, formatNumber, formatPercent, PlatformIcon, ProgressBar, tableClass } from "@/components/ui";
import type { SetupStatus } from "@/lib/config";
import { rate, type PlatformCounts, type RuleStats } from "@/lib/stats";
import { ShowMore } from "./show-more";

/*
 * ส่วนประกอบเฉพาะหน้าภาพรวม (Server Component)
 */

// ---------------- แถบตั้งค่าให้เสร็จ ----------------

/** ขั้นตอนตั้งค่าตามลำดับในคู่มือ (เงื่อนไขเดียวกับ setupProgress) */
function setupSteps(s: SetupStatus): { done: boolean; label: string; href: string }[] {
  return [
    { done: Boolean(s.baseUrl), label: "ยืนยันที่อยู่เว็บของระบบ", href: "/guide" },
    { done: Boolean(s.meta.appId && s.meta.appSecret), label: "ใส่ข้อมูลแอปจาก Meta for Developers", href: "/guide" },
    { done: Boolean(s.webhookVerifiedAt), label: "ตั้งค่าให้ Meta ส่งคอมเมนต์และแชทเข้าระบบ", href: "/guide" },
    { done: s.pagesSubscribed > 0, label: "เชื่อมต่อเพจ Facebook และ Instagram", href: "/guide" },
    { done: s.ruleCount > 0, label: "สร้างกฎอัตโนมัติอันแรก", href: "/rules/new" },
    { done: Boolean(s.lastWebhookAt), label: "ทดสอบโดยคอมเมนต์ที่โพสต์ของเพจ", href: "/guide" },
  ];
}

export function SetupBanner({ status, done, total }: { status: SetupStatus; done: number; total: number }) {
  const next = setupSteps(status).find((s) => !s.done);
  const left = total - done;
  return (
    <section
      aria-label="ความคืบหน้าการตั้งค่า"
      className="rounded-xl border border-accent/25 bg-accent-soft p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
          <Rocket className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-base leading-6 font-semibold text-fg">อีก {left} ขั้นก็พร้อมตอบลูกค้าอัตโนมัติ</p>
          {next && (
            <p className="mt-0.5 text-sm leading-6 text-fg-2">
              ขั้นต่อไป: <span className="font-medium text-fg">{next.label}</span>
            </p>
          )}
          <div className="mt-3 flex max-w-md items-center gap-3">
            <ProgressBar value={done} max={total} label={`ตั้งค่าเสร็จ ${done} จาก ${total} ขั้น`} />
            <span className="shrink-0 text-xs font-medium text-fg-2 tabular">
              {done}/{total} ขั้น
            </span>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {next && next.href !== "/guide" && (
            <ButtonLink href="/guide" variant="ghost" className="flex-1 sm:flex-none">
              ดูคู่มือ
            </ButtonLink>
          )}
          <ButtonLink href={next?.href ?? "/guide"} iconRight={<ArrowRight />} className="flex-1 sm:flex-none">
            {next?.href === "/rules/new" ? "สร้างกฎ" : "ไปที่คู่มือตั้งค่า"}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

// ---------------- ตัวเลขแยก Facebook / Instagram ----------------

/** "FB 3 · IG 5" พร้อมไอคอน (ใช้ใต้ตัวเลขสรุป) */
export function PlatformSplitInline({ counts }: { counts: PlatformCounts }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
      <span className="inline-flex items-center gap-1">
        <PlatformIcon platform="facebook" size={12} title="Facebook" />
        <span className="tabular">{formatNumber(counts.facebook)}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <PlatformIcon platform="instagram" size={12} title="Instagram" />
        <span className="tabular">{formatNumber(counts.instagram)}</span>
      </span>
    </span>
  );
}

/** แถวเปรียบเทียบ FB/IG: ชื่อ + ยอดรวม + แท่งสัดส่วน 2 สี */
function SplitRow({ label, hint, counts }: { label: string; hint?: string; counts: PlatformCounts }) {
  const total = counts.facebook + counts.instagram;
  const fbPct = total > 0 ? (counts.facebook / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-fg">
          {label}
          {hint && <span className="ml-1.5 text-xs text-fg-3">{hint}</span>}
        </span>
        <span className="text-sm font-semibold text-fg tabular">{formatNumber(total)}</span>
      </div>
      <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        {counts.facebook > 0 && <div className="h-full rounded-full bg-brand-facebook" style={{ width: `${fbPct}%` }} />}
        {counts.instagram > 0 && <div className="h-full flex-1 rounded-full bg-brand-instagram" />}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-fg-3">
        <span className="inline-flex items-center gap-1">
          <PlatformIcon platform="facebook" size={12} />
          Facebook <span className="font-medium text-fg-2 tabular">{formatNumber(counts.facebook)}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          Instagram <span className="font-medium text-fg-2 tabular">{formatNumber(counts.instagram)}</span>
          <PlatformIcon platform="instagram" size={12} />
        </span>
      </div>
    </div>
  );
}

export function PlatformBreakdown({
  incoming,
  incomingHint,
  triggers,
  sent,
}: {
  incoming: PlatformCounts;
  incomingHint: string;
  triggers: PlatformCounts;
  sent: PlatformCounts;
}) {
  return (
    <div className="space-y-5">
      <SplitRow label="ข้อความเข้า" hint={incomingHint} counts={incoming} />
      <SplitRow label="ตรงกับกฎ" counts={triggers} />
      <SplitRow label="ส่ง DM สำเร็จ" counts={sent} />
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

function TriggerBadge({ trigger }: { trigger: RuleStats["trigger"] }) {
  return trigger === "comment" ? (
    <Badge tone="outline" icon={<MessageCircle />}>
      คอมเมนต์
    </Badge>
  ) : (
    <Badge tone="outline" icon={<MessagesSquare />}>
      แชท DM
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

function RuleMeta({ rule }: { rule: RuleStats }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <TriggerBadge trigger={rule.trigger} />
      <PlatformIcons platforms={rule.platforms} />
      {!rule.active && (
        <Badge tone="neutral" dot>
          ปิดอยู่
        </Badge>
      )}
    </div>
  );
}

const ctrOf = (r: RuleStats) => (r.hasButtons ? formatPercent(rate(r.engaged, r.reached)) : "–");
const CTR_HINT = "สัดส่วนคนที่กดปุ่มหรือลิงก์ จากคนที่ได้รับ DM (กฎที่ไม่มีปุ่มแสดง –)";

/** แถวตาราง (จอใหญ่) */
function RuleRow({ rule: r, maxTriggers }: { rule: RuleStats; maxTriggers: number }) {
  return (
    <tr className={tableClass.trHover}>
      <td className={cx(tableClass.td, "max-w-72")}>
        <Link href={`/rules/${r.id}`} className="block truncate font-medium text-fg hover:text-accent">
          {r.name}
        </Link>
        <RuleMeta rule={r} />
      </td>
      <td className={cx(tableClass.td, tableClass.num)}>
        <div className="flex items-center justify-end gap-2.5">
          <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-surface-3 lg:block" aria-hidden>
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.triggers / maxTriggers) * 100}%` }} />
          </span>
          <span className="min-w-6 font-medium">{formatNumber(r.triggers)}</span>
        </div>
      </td>
      <td className={cx(tableClass.td, tableClass.num)}>{formatNumber(r.sent)}</td>
      <td className={cx(tableClass.td, tableClass.num, r.failed > 0 ? "font-medium text-critical-text" : "text-fg-3")}>
        {formatNumber(r.failed)}
      </td>
      <td className={cx(tableClass.td, tableClass.num)}>{formatPercent(rate(r.read, r.sent))}</td>
      <td className={cx(tableClass.td, tableClass.num, "font-medium")}>{ctrOf(r)}</td>
    </tr>
  );
}

/** รายการซ้อนกัน (จอมือถือ) */
function RuleListItem({ rule: r }: { rule: RuleStats }) {
  return (
    <li>
      <Link href={`/rules/${r.id}`} className="block px-5 py-3.5 transition-colors active:bg-surface-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{r.name}</p>
            <RuleMeta rule={r} />
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-fg tabular">
            <Zap className="size-3.5 text-accent" aria-hidden />
            {formatNumber(r.triggers)}
            <span className="text-xs font-normal text-fg-3">ครั้ง</span>
          </span>
        </div>
        <dl className="mt-2.5 grid grid-cols-4 gap-2 text-center">
          {[
            { label: "ส่งสำเร็จ", value: formatNumber(r.sent) },
            { label: "ไม่สำเร็จ", value: formatNumber(r.failed), critical: r.failed > 0 },
            { label: "อ่าน", value: formatPercent(rate(r.read, r.sent)) },
            { label: "CTR", value: ctrOf(r) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-surface-2 px-1 py-1.5">
              <dt className="text-[11px] leading-4 text-fg-3">{s.label}</dt>
              <dd className={cx("text-sm font-semibold tabular", s.critical ? "text-critical-text" : "text-fg")}>{s.value}</dd>
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
export function RuleTable({ rules }: { rules: RuleStats[] }) {
  const maxTriggers = Math.max(1, ...rules.map((r) => r.triggers));
  // ซ่อนเฉพาะเมื่อเหลือมากกว่า 1 กฎ (ไม่ซ่อนแค่กฎเดียว)
  const cut = rules.length > VISIBLE_RULES + 1 ? VISIBLE_RULES : rules.length;
  const top = rules.slice(0, cut);
  const rest = rules.slice(cut);
  return (
    <>
      <div className={cx(tableClass.wrap, "hidden md:block")}>
        <table className={tableClass.table}>
          <thead className={tableClass.thead}>
            <tr>
              <th className={tableClass.th}>กฎ</th>
              <th className={cx(tableClass.th, tableClass.num)} title="จำนวนครั้งที่มีคนคอมเมนต์หรือทักแชทตรงกับกฎ">
                ทำงาน
              </th>
              <th className={cx(tableClass.th, tableClass.num)}>ส่งสำเร็จ</th>
              <th className={cx(tableClass.th, tableClass.num)}>ไม่สำเร็จ</th>
              <th className={cx(tableClass.th, tableClass.num)} title="สัดส่วน DM ที่ลูกค้าเปิดอ่าน">
                อ่าน
              </th>
              <th className={cx(tableClass.th, tableClass.num)} title={CTR_HINT}>
                CTR
              </th>
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <RuleRow key={r.id} rule={r} maxTriggers={maxTriggers} />
            ))}
          </tbody>
          {rest.length > 0 && (
            <ShowMore count={rest.length} noun="กฎ" table={{ colSpan: 6 }}>
              {rest.map((r) => (
                <RuleRow key={r.id} rule={r} maxTriggers={maxTriggers} />
              ))}
            </ShowMore>
          )}
        </table>
      </div>

      <div className="md:hidden">
        <ul className="divide-y divide-line">
          {top.map((r) => (
            <RuleListItem key={r.id} rule={r} />
          ))}
        </ul>
        {rest.length > 0 && (
          <ShowMore count={rest.length} noun="กฎ" listClassName="divide-y divide-line border-t border-line">
            {rest.map((r) => (
              <RuleListItem key={r.id} rule={r} />
            ))}
          </ShowMore>
        )}
      </div>
    </>
  );
}
