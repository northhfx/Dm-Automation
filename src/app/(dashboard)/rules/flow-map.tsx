"use client";

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { cx, formatNumber, formatPercent } from "@/components/ui";
import type { MatchType, Platform, TriggerType } from "@/db/schema";
import { layoutFlow } from "@/lib/flows/layout";
import type { FlowStep } from "@/lib/flows/types";
import type { StepStats } from "@/lib/stats";

export interface TriggerSummary {
  trigger: TriggerType;
  platforms: Platform[];
  matchType: MatchType;
  keywords: string[];
  allPosts: boolean;
}

interface Props {
  steps: FlowStep[];
  summary: TriggerSummary;
  stats?: Record<string, StepStats>;
  /** กดการ์ดข้อความ → ไปแก้ข้อความนั้น */
  onSelect: (stepId: string) => void;
}

interface Edge {
  key: string;
  d: string;
}

const KEYWORD_LIMIT = 6;

/** เส้นโค้งจากจุดต่อของปุ่ม ไปยังขอบซ้ายของการ์ดปลายทาง */
function curve(x1: number, y1: number, x2: number, y2: number): string {
  const bend = Math.max(48, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

/** หาเส้นจากจุดต่อ (data-out) ไปยังจุดรับของการ์ดปลายทาง (data-in) */
function measureEdges(canvas: HTMLElement): Edge[] {
  const base = canvas.getBoundingClientRect();
  const center = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top };
  };
  const edges: Edge[] = [];
  canvas.querySelectorAll<HTMLElement>("[data-out]").forEach((from) => {
    const to = from.dataset.to && canvas.querySelector(`[data-in="${CSS.escape(from.dataset.to)}"]`);
    if (!to) return;
    const a = center(from);
    // ให้หัวลูกศรแตะขอบซ้ายของจุดรับ ไม่ทับจุด
    const b = center(to);
    b.x -= to.getBoundingClientRect().width / 2 + 1;
    edges.push({ key: from.dataset.out!, d: curve(a.x, a.y, b.x, b.y) });
  });
  return edges;
}

/**
 * แผนผังแบบ ManyChat: การ์ด "เมื่อ…" → การ์ดข้อความ → ปุ่ม → การ์ดถัดไป ต่อกันด้วยเส้น
 * ใช้ดูภาพรวม ส่วนการแก้ไขทำในการ์ดด้านล่าง
 */
export function FlowMap({ steps, summary, stats, onSelect }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const { columns, unreachable } = layoutFlow(steps);
  const byId = new Map(steps.map((s) => [s.id, s]));
  const numberOf = (id: string) => steps.findIndex((s) => s.id === id) + 1;

  // วัดตำแหน่งจุดต่อจริงบนจอแล้ววาดเส้นใหม่ทุกครั้งที่ข้อความ/ขนาดการ์ดเปลี่ยน
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => {
      const next = measureEdges(canvas);
      setEdges((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    canvas.querySelectorAll("[data-card]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [steps, summary]);

  const renderCard = (id: string, warn: boolean) => {
    const step = byId.get(id)!;
    const stat = stats?.[id];
    return (
      <StepCard
        key={id}
        step={step}
        number={numberOf(id)}
        first={id === steps[0]?.id}
        unreachable={warn}
        stat={stat}
        targetNumber={(stepId) => (stepId && byId.has(stepId) ? numberOf(stepId) : null)}
        onSelect={() => onSelect(id)}
      />
    );
  };

  return (
    <div
      ref={canvasRef}
      className="relative flex w-max min-w-full items-start gap-16 bg-bg p-5 [background-image:radial-gradient(var(--line)_1.2px,transparent_1.2px)] [background-size:18px_18px]"
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-accent" />
          </marker>
        </defs>
        {edges.map((e) => (
          <path key={e.key} d={e.d} fill="none" strokeWidth={2} className="stroke-accent" markerEnd="url(#flow-arrow)" />
        ))}
      </svg>

      <TriggerCard summary={summary} firstStepId={steps[0]?.id} />

      {columns.map((column, i) => (
        <div key={i} className="flex flex-col gap-6">
          {column.map((id) => renderCard(id, false))}
        </div>
      ))}

      {unreachable.length > 0 && (
        <div className="flex flex-col gap-6">
          <p className="w-60 text-xs text-fg-2">ยังไม่มีปุ่มไหนพามาที่ข้อความเหล่านี้</p>
          {unreachable.map((id) => renderCard(id, true))}
        </div>
      )}
    </div>
  );
}

function TriggerCard({ summary, firstStepId }: { summary: TriggerSummary; firstStepId?: string }) {
  const { trigger, platforms, matchType, keywords, allPosts } = summary;
  const platformLabel =
    platforms.length === 2
      ? "Facebook + Instagram"
      : platforms[0] === "instagram"
        ? "Instagram"
        : platforms[0] === "facebook"
          ? "Facebook"
          : "ยังไม่ได้เลือกแพลตฟอร์ม";
  const shown = keywords.slice(0, KEYWORD_LIMIT);

  return (
    <div data-card="trigger" className="relative w-56 shrink-0 rounded-xl border-2 border-accent/50 bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm font-semibold">
        <span aria-hidden="true">⚡</span> เมื่อ…
      </div>
      <div className="space-y-3 p-3 text-sm">
        <div className="space-y-2 rounded-lg bg-surface-2 p-2.5">
          <div className="font-medium">{trigger === "comment" ? "มีคนคอมเมนต์ใต้โพสต์" : "มีคนทักแชท (DM) มา"}</div>
          <div className={cx("text-xs", platforms.length ? "text-fg-2" : "text-critical-text")}>
            {platformLabel}
            {trigger === "comment" && ` · ${allPosts ? "ทุกโพสต์" : "เฉพาะโพสต์ที่เลือก"}`}
          </div>
          {matchType === "any" ? (
            <div className="text-xs text-fg-2">ทุกข้อความ (ไม่ต้องมี keyword)</div>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-fg-2">{matchType === "exact" ? "พิมพ์ตรงทั้งข้อความว่า" : "มีคำว่า"}</div>
              {keywords.length ? (
                <div className="flex flex-wrap gap-1">
                  {shown.map((k, i) => (
                    <span key={i} className="max-w-full truncate rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">
                      {k}
                    </span>
                  ))}
                  {keywords.length > shown.length && (
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs text-fg-2">+{keywords.length - shown.length}</span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-critical-text">ยังไม่ได้ใส่ keyword</div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 text-xs text-fg-2">
          แล้ว
          <span data-out="trigger" data-to={firstStepId} className="-mr-[20px] h-3 w-3 rounded-full border-2 border-accent bg-surface" />
        </div>
      </div>
    </div>
  );
}

function StepCard({
  step,
  number,
  first,
  unreachable,
  stat,
  targetNumber,
  onSelect,
}: {
  step: FlowStep;
  number: number;
  first: boolean;
  unreachable: boolean;
  stat?: StepStats;
  targetNumber: (stepId: string | undefined) => number | null;
  onSelect: () => void;
}) {
  const parts = step.text.trim().split("{name}");
  return (
    <button
      type="button"
      data-card={step.id}
      onClick={onSelect}
      aria-label={`ข้อความที่ ${number} — กดเพื่อแก้ไข`}
      className={cx(
        "relative block w-60 shrink-0 rounded-xl border bg-surface text-left shadow-sm transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        unreachable ? "border-dashed border-warning" : "border-line",
      )}
    >
      <span data-in={step.id} className="absolute top-5 -left-[7px] h-3 w-3 -translate-y-1/2 rounded-full bg-accent" />
      <span className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-fg">{number}</span>
        <span className="text-sm font-semibold">ส่งข้อความ</span>
        <span className="ml-auto text-xs text-fg-3">{first ? "ส่งทันที" : `ข้อความที่ ${number}`}</span>
      </span>
      <span className="block space-y-2 p-3">
        <span className="line-clamp-5 block text-sm break-words whitespace-pre-line">
          {step.text.trim() ? (
            parts.map((part, i) => (
              <Fragment key={i}>
                {part}
                {i < parts.length - 1 && (
                  <span className="rounded bg-accent-soft px-1 text-xs font-medium whitespace-nowrap text-accent">ชื่อลูกค้า</span>
                )}
              </Fragment>
            ))
          ) : (
            <span className="text-fg-3">(ยังไม่มีข้อความ)</span>
          )}
        </span>
        {step.buttons.map((b) => {
          const target = b.type === "next" ? targetNumber(b.nextStepId) : null;
          return (
            <span key={b.id} className="relative block rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-center text-sm font-medium">
              <span className="block truncate">
                {b.title || <span className="text-fg-3">ชื่อปุ่ม</span>}
                {b.type === "link" && <span className="ml-1 text-fg-3">↗</span>}
              </span>
              <span className="block text-xs font-normal text-fg-3">
                {b.type === "link" ? "เปิดลิงก์" : target ? `ส่งข้อความที่ ${target}` : "ยังไม่ได้เลือกข้อความ"}
              </span>
              {b.type === "next" && (
                <span
                  data-out={`${step.id}:${b.id}`}
                  data-to={target ? b.nextStepId : undefined}
                  className={cx(
                    "absolute top-1/2 -right-[19px] h-3 w-3 -translate-y-1/2 rounded-full border-2 bg-surface",
                    target ? "border-accent" : "border-fg-3",
                  )}
                />
              )}
            </span>
          );
        })}
      </span>
      {stat && (
        <span className="block border-t border-line px-3 py-1.5 text-xs text-fg-2">
          ส่ง {formatNumber(stat.sent)} ครั้ง
          {step.buttons.length > 0 && ` · CTR ${formatPercent(stat.reached ? (stat.engaged / stat.reached) * 100 : null)}`}
        </span>
      )}
      {unreachable && <span className="block border-t border-line px-3 py-1.5 text-xs text-fg-2">ยังไม่ได้ใช้ — เลือกข้อความนี้ในปุ่มใดปุ่มหนึ่ง</span>}
    </button>
  );
}
