"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export interface ChartSeries<T> {
  key: keyof T & string;
  label: string;
  /** CSS color เช่น var(--series-1) */
  color: string;
}

interface Props<T extends { date: string }> {
  data: T[];
  series: ChartSeries<T>[];
  height?: number;
}

const MARGIN = { top: 16, right: 56, bottom: 28, left: 40 };

const shortDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const nf = new Intl.NumberFormat("th-TH");

/** แกน Y ที่เป็นเลขกลมๆ เช่น 0, 5, 10, 15, 20 */
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

function parseDate(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

/** กราฟเส้นแบบเบาๆ: เลื่อนเมาส์ (หรือกดลูกศรซ้าย/ขวา) เพื่อดูค่าแต่ละวัน */
export function LineChart<T extends { date: string }>({ data, series, height = 260 }: Props<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];

  const x = (i: number) => MARGIN.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => MARGIN.top + innerH - (v / top) * innerH;

  const paths = series.map((s) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(Number(d[s.key]) || 0).toFixed(1)}`).join(""),
  );

  // ป้ายวันที่บนแกน X: แสดงไม่เกิน ~6 ป้าย ไม่ให้ชนกัน
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 90))));
  const xLabels = data.map((d, i) => ({ i, d })).filter(({ i }) => i % labelEvery === 0 || i === data.length - 1);
  if (xLabels.length >= 2) {
    const [prev, last] = xLabels.slice(-2);
    if (last.i - prev.i < labelEvery * 0.6) xLabels.splice(xLabels.length - 2, 1);
  }

  function onPointerMove(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const ratio = data.length <= 1 ? 0 : px / rect.width;
    setActive(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))));
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((cur) => {
      const start = cur ?? data.length - 1;
      return Math.min(data.length - 1, Math.max(0, start + (e.key === "ArrowLeft" ? -1 : 1)));
    });
  }

  const last = data.length - 1;
  // ถ้าป้ายค่าปลายเส้นอยู่ใกล้กันจนทับกัน ไม่ต้องแสดง (ดูค่าจาก tooltip/ตารางแทน)
  const endYs = last >= 0 ? series.map((s) => y(Number(data[last][s.key]) || 0)) : [];
  const endLabelsCollide = endYs.some((a, i) => endYs.some((b, j) => i < j && Math.abs(a - b) < 14));
  const activePoint = active !== null ? data[active] : null;
  // วาง tooltip ข้างเส้น crosshair (ไม่บังจุดข้อมูล) ถ้าด้านขวาไม่พอให้ย้ายไปด้านซ้าย
  const TOOLTIP_W = 160;
  const tooltipLeft =
    active === null ? 0 : x(active) + 12 + TOOLTIP_W <= width ? x(active) + 12 : Math.max(0, x(active) - 12 - TOOLTIP_W);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-fg-2">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>

      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`กราฟรายวัน: ${series.map((s) => s.label).join(" และ ")} (กดลูกศรซ้าย/ขวาเพื่อดูค่าแต่ละวัน)`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="block overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--fg-3)" className="tabular">
                {nf.format(t)}
              </text>
            </g>
          ))}

          {xLabels.map(({ i, d }) => (
            <text key={d.date} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--fg-3)">
              {shortDate.format(parseDate(d.date))}
            </text>
          ))}

          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={MARGIN.top + innerH} stroke="var(--fg-3)" strokeWidth={1} />
          )}

          {series.map((s, si) => (
            <path key={s.key} d={paths[si]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* จุดปลายเส้น + ค่าล่าสุด (direct label) */}
          {last >= 0 &&
            series.map((s) => {
              const v = Number(data[last][s.key]) || 0;
              return (
                <g key={s.key}>
                  <circle cx={x(last)} cy={y(v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                  {!endLabelsCollide && (
                    <text x={x(last) + 10} y={y(v)} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--fg)" className="tabular">
                      {nf.format(v)}
                    </text>
                  )}
                </g>
              );
            })}

          {active !== null &&
            series.map((s) => (
              <circle
                key={s.key}
                cx={x(active)}
                cy={y(Number(data[active][s.key]) || 0)}
                r={4}
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ))}

          <rect
            x={MARGIN.left - 8}
            y={MARGIN.top}
            width={innerW + 16}
            height={innerH}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

        {activePoint && (
          <div
            className="pointer-events-none absolute top-2 w-40 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg"
            style={{ left: tooltipLeft }}
          >
            <div className="mb-1 text-xs text-fg-3">{longDate.format(parseDate(activePoint.date))}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} aria-hidden />
                <span className="font-semibold tabular">{nf.format(Number(activePoint[s.key]) || 0)}</span>
                <span className="text-fg-2">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-fg-2 hover:text-fg">ดูเป็นตาราง</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left">
            <thead className="text-fg-3">
              <tr>
                <th className="py-1 pr-4 font-medium">วันที่</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1 pr-4 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <td className="py-1 pr-4">{shortDate.format(parseDate(d.date))}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1 pr-4 text-right tabular">
                      {nf.format(Number(d[s.key]) || 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
