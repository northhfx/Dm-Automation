"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronRight } from "lucide-react";
import { useFormat, useT } from "@/lib/i18n/client";
import { commonMessages } from "@/lib/i18n/messages/common";
import { SegmentedControl } from "./segmented-control";
import { cx } from "./ui";

/*
 * กราฟแท่งรายวัน ซ้อน Facebook (ล่าง) + Instagram (บน) — เลือกได้ว่าจะดูตัวเลขไหน (แท็บด้านบน)
 * - สีตามแพลตฟอร์ม (--brand-facebook / --brand-instagram) ผ่านการตรวจตาบอดสีทั้งโหมดสว่างและมืดแล้ว
 * - เส้นตารางบาง ทึบ ไม่มีพื้นไล่สี · ชี้เมาส์ / แตะ / กดลูกศรซ้าย-ขวา ดูค่าแต่ละวัน · มีตารางให้เปิดดูแทนกราฟ
 */

export interface PlatformDay {
  /** YYYY-MM-DD (วันตามเขตเวลาของระบบแล้ว) */
  date: string;
  facebook: number;
  instagram: number;
}

export interface ChartMetric {
  key: string;
  /** ชื่อแท็บ */
  label: string;
  data: PlatformDay[];
}

const SERIES = [
  { key: "facebook", label: "Facebook", color: "var(--brand-facebook)" },
  { key: "instagram", label: "Instagram", color: "var(--brand-instagram)" },
] as const;

const MARGIN = { top: 12, right: 8, bottom: 28, left: 36 };
const GAP = 2;

// วันที่ในข้อมูลเป็น "YYYY-MM-DD" → แสดงแบบ UTC ไม่ให้วันเลื่อน
const SHORT_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
const LONG_DATE: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };

const parseDate = (d: string) => new Date(`${d}T00:00:00Z`);

/** แกน Y เป็นเลขกลมๆ เช่น 0, 5, 10, 15 */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** สี่เหลี่ยมมุมบนโค้ง (ส่วนบนสุดของแท่ง) — มุมล่างตรง ติดฐาน */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function PlatformBarChart({ metrics, height = 260, ariaLabel }: { metrics: ChartMetric[]; height?: number; ariaLabel: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [metricKey, setMetricKey] = useState(metrics[0]?.key ?? "");
  const [active, setActive] = useState<number | null>(null);
  const t = useT(commonMessages);
  const f = useFormat();
  const shortDate = (d: string) => f.date(parseDate(d), SHORT_DATE);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  const data = metric?.data ?? [];
  const totals = { facebook: 0, instagram: 0 };
  for (const d of data) {
    totals.facebook += d.facebook;
    totals.instagram += d.instagram;
  }

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.facebook + d.instagram)));
  const top = ticks[ticks.length - 1] || 1;
  const slot = data.length > 0 ? innerW / data.length : innerW;
  // แท่งกว้างราว 60% ของช่อง (เว้นที่ว่างระหว่างแท่ง ไม่ให้ดูเป็นก้อนสีทึบ)
  const barW = Math.max(1, Math.min(18, slot * 0.6, slot - GAP));
  const xOf = (i: number) => MARGIN.left + i * slot + (slot - barW) / 2;
  const yOf = (v: number) => MARGIN.top + innerH - (v / top) * innerH;

  // ป้ายวันที่: ไม่เกิน ~6 ป้าย ไม่ให้ชนกัน
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 80))));
  const labels = data.map((d, i) => ({ i, d })).filter(({ i }) => i % every === 0 || i === data.length - 1);
  if (labels.length >= 2 && labels[labels.length - 1].i - labels[labels.length - 2].i < every * 0.6) labels.splice(labels.length - 2, 1);

  function onPointerMove(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * data.length);
    setActive(Math.min(data.length - 1, Math.max(0, i)));
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((cur) => Math.min(data.length - 1, Math.max(0, (cur ?? data.length - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
  }

  const point = active !== null ? data[active] : null;
  const TOOLTIP_W = 168;
  const tipLeft =
    active === null ? 0 : xOf(active) + barW + 10 + TOOLTIP_W <= width ? xOf(active) + barW + 10 : Math.max(0, xOf(active) - 10 - TOOLTIP_W);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {metrics.length > 1 && (
          <SegmentedControl
            label={ariaLabel}
            size="sm"
            value={metric.key}
            onChange={(v) => {
              setMetricKey(v);
              setActive(null);
            }}
            options={metrics.map((m) => ({ value: m.key, label: m.label }))}
          />
        )}
        {/* คำอธิบายสี + ยอดรวมของช่วงนี้ */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-2">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
              {s.label}
              <span className="font-semibold text-fg tabular">{f.number(totals[s.key])}</span>
            </span>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${ariaLabel}: ${metric?.label ?? ""}`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="block overflow-visible rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--line)" strokeWidth={1} />
              <text x={MARGIN.left - 8} y={yOf(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--fg-3)" className="tabular">
                {f.number(tick)}
              </text>
            </g>
          ))}

          {labels.map(({ i, d }) => (
            <text key={d.date} x={xOf(i) + barW / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--fg-3)">
              {shortDate(d.date)}
            </text>
          ))}

          {data.map((d, i) => {
            const fbH = (d.facebook / top) * innerH;
            const igH = (d.instagram / top) * innerH;
            const base = MARGIN.top + innerH;
            // ช่องว่าง 2px ระหว่างสองส่วน (เฉพาะเมื่อมีทั้งคู่)
            const gap = fbH > 0 && igH > 0 ? Math.min(GAP, igH / 2) : 0;
            const dim = active !== null && active !== i;
            return (
              <g key={d.date} opacity={dim ? 0.35 : 1} className="transition-opacity duration-100">
                {fbH > 0 && (
                  <path
                    d={igH > 0 ? `M${xOf(i)},${base}V${base - fbH}H${xOf(i) + barW}V${base}Z` : topRoundedRect(xOf(i), base - fbH, barW, fbH, 3)}
                    fill={SERIES[0].color}
                  />
                )}
                {igH > 0 && <path d={topRoundedRect(xOf(i), base - fbH - igH, barW, Math.max(0, igH - gap), 3)} fill={SERIES[1].color} />}
              </g>
            );
          })}

          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerDown={onPointerMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

        {point && (
          <div
            className="pointer-events-none absolute top-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm shadow-lg"
            style={{ left: tipLeft, width: TOOLTIP_W }}
          >
            <div className="mb-1.5 text-xs text-fg-3">{f.date(parseDate(point.date), LONG_DATE)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center gap-2 leading-6">
                <span className="inline-block size-2 shrink-0 rounded-[2px]" style={{ background: s.color }} aria-hidden />
                <span className="text-fg-2">{s.label}</span>
                <span className="ml-auto font-semibold tabular">{f.number(point[s.key])}</span>
              </div>
            ))}
            <div className="mt-1 flex border-t border-line pt-1 leading-6">
              <span className="text-fg-2">{metric.label}</span>
              <span className="ml-auto font-semibold tabular">{f.number(point.facebook + point.instagram)}</span>
            </div>
          </div>
        )}
      </div>

      <details className="group mt-3 text-sm">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md py-1 text-[13px] text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
          {t("chartShowTable")}
        </summary>
        <div className="scroll-thin mt-2 max-h-64 overflow-auto rounded-lg border border-line">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface-2 text-xs text-fg-3">
              <tr>
                <th className="px-3 py-2 font-medium">{t("chartDate")}</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right font-medium">
                    {s.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">{metric.label}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <td className="px-3 py-1.5">{shortDate(d.date)}</td>
                  <td className="px-3 py-1.5 text-right tabular">{f.number(d.facebook)}</td>
                  <td className="px-3 py-1.5 text-right tabular">{f.number(d.instagram)}</td>
                  <td className={cx("px-3 py-1.5 text-right font-medium tabular")}>{f.number(d.facebook + d.instagram)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
