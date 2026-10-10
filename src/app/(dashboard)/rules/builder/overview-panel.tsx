"use client";

import type { Dispatch, ReactNode } from "react";
import { ChevronRight, CircleAlert, CircleCheck, Hand, MousePointerClick, Spline, TriangleAlert, Unlink, Zap } from "lucide-react";
import { Button, cx, formatNumber, formatPercent, Notice } from "@/components/ui";
import { targetOf, type BuilderAction, type BuilderDoc, type Problem, type ProblemTarget, type Selection } from "./model";
import { PanelSection } from "./trigger-panel";

export interface RuleSummaryStats {
  triggers: number;
  sent: number;
  ctr: number | null;
}

interface Props {
  doc: BuilderDoc;
  selection: Selection;
  problems: Problem[];
  numbers: Map<string, number>;
  serverError: string | null;
  stats?: RuleSummaryStats;
  dispatch: Dispatch<BuilderAction>;
  onGoTo: (target: ProblemTarget) => void;
}

function Tip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent [&_svg]:size-4">{icon}</span>
      <span className="pt-1 text-sm leading-6 text-fg-2">{children}</span>
    </li>
  );
}

export function OverviewPanel({ doc, selection, problems, numbers, serverError, stats, dispatch, onGoTo }: Props) {
  const blocking = problems.filter((p) => p.blocking);
  const warnings = problems.filter((p) => !p.blocking);
  const edge = selection?.kind === "edge" ? selection.from : null;
  const edgeTarget = edge ? targetOf(doc, edge) : undefined;
  let edgeLabel = "";
  if (edge && edgeTarget) {
    if (edge.kind === "trigger") edgeLabel = `การ์ด "เมื่อ…" → ข้อความ #${numbers.get(edgeTarget)}`;
    else {
      const button = doc.steps.find((s) => s.id === edge.stepId)?.buttons.find((b) => b.id === edge.buttonId);
      edgeLabel = `ปุ่ม "${button?.title.trim() || "ไม่มีชื่อ"}" ของข้อความ #${numbers.get(edge.stepId)} → ข้อความ #${numbers.get(edgeTarget)}`;
    }
  }

  return (
    <div>
      {edge && edgeTarget && (
        <div className="px-5 pt-5">
          <div className="space-y-3 rounded-xl border border-accent/30 bg-accent-soft/50 p-4">
            <div>
              <p className="text-xs font-medium text-fg-2">เส้นที่เลือก</p>
              <p className="mt-0.5 text-sm font-medium">{edgeLabel}</p>
            </div>
            <Button variant="danger" size="sm" icon={<Unlink />} onClick={() => dispatch({ type: "disconnect", from: edge })}>
              ลบเส้นนี้
            </Button>
          </div>
        </div>
      )}

      {serverError && (
        <div className="px-5 pt-5">
          <Notice tone="critical" title="บันทึกไม่สำเร็จ">
            {serverError}
          </Notice>
        </div>
      )}

      <PanelSection title="ก่อนบันทึก" description={blocking.length ? "แตะรายการเพื่อไปแก้ที่การ์ดนั้น" : undefined}>
        {blocking.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-good-soft px-3 py-2.5 text-sm font-medium text-good-text">
            <CircleCheck size={18} aria-hidden="true" />
            ครบแล้ว พร้อมบันทึก
          </div>
        ) : null}
        {(blocking.length > 0 || warnings.length > 0) && (
          <ul className="space-y-1.5">
            {[...blocking, ...warnings].map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => onGoTo(p.target)}
                  className={cx(
                    "group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
                    p.blocking ? "border-critical/25 bg-critical-soft/60 hover:bg-critical-soft" : "border-warning/30 bg-warning-soft/60 hover:bg-warning-soft",
                  )}
                >
                  {p.blocking ? (
                    <CircleAlert size={16} className="mt-0.5 shrink-0 text-critical-text" aria-hidden="true" />
                  ) : (
                    <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warning-text" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 leading-6 text-fg">{p.message}</span>
                  <ChevronRight size={16} className="mt-1 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      {stats && (
        <PanelSection title="ผลลัพธ์ของกฎนี้" description="นับตั้งแต่เริ่มใช้งาน">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["ทำงาน", formatNumber(stats.triggers), "ครั้ง"],
              ["ส่ง DM", formatNumber(stats.sent), "ข้อความ"],
              ["อัตราการกด", formatPercent(stats.ctr), "จากคนที่ได้รับ"],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-lg border border-line bg-surface p-2.5">
                <dt className="text-xs text-fg-2">{label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular">{value}</dd>
                <dd className="text-[11px] text-fg-3">{sub}</dd>
              </div>
            ))}
          </dl>
        </PanelSection>
      )}

      <PanelSection title="วิธีใช้">
        <ul className="space-y-3.5">
          <Tip icon={<MousePointerClick />}>
            <b className="font-medium text-fg">แตะการ์ด</b>เพื่อแก้ไข · ลากการ์ดเพื่อย้ายตำแหน่ง
          </Tip>
          <Tip icon={<Spline />}>
            <b className="font-medium text-fg">ลากจากจุดกลม</b>ข้างปุ่ม ไปวางที่ว่างเพื่อสร้างข้อความถัดไป หรือวางบนการ์ดเพื่อเชื่อม
          </Tip>
          <Tip icon={<Hand />}>
            <b className="font-medium text-fg">ลากพื้นที่ว่าง</b>เพื่อเลื่อน · Ctrl + ล้อเมาส์ หรือถ่างสองนิ้วเพื่อซูม
          </Tip>
        </ul>
        <Button variant="secondary" size="sm" icon={<Zap />} onClick={() => dispatch({ type: "select", selection: { kind: "trigger" } })}>
          ตั้งค่าเงื่อนไข (การ์ด &quot;เมื่อ…&quot;)
        </Button>
      </PanelSection>
    </div>
  );
}
