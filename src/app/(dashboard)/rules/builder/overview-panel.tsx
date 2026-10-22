"use client";

import type { Dispatch, ReactNode } from "react";
import { CalendarClock, ChevronRight, CircleAlert, CircleCheck, Hand, MousePointerClick, Spline, TriangleAlert, Unlink, Zap } from "lucide-react";
import { Button, cx, Notice } from "@/components/ui";
import { useFormat, useT } from "@/lib/i18n/client";
import { rulesMessages } from "@/lib/i18n/messages/rules";
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
  /** เปิดหัวข้อตั้งเวลา (ท้ายแผง "ทำงานเมื่อ…") */
  onSchedule: () => void;
}

function Tip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent [&_svg]:size-4">{icon}</span>
      <span className="pt-1 text-sm leading-6 text-fg-2">{children}</span>
    </li>
  );
}

export function OverviewPanel({ doc, selection, problems, numbers, serverError, stats, dispatch, onGoTo, onSchedule }: Props) {
  const t = useT(rulesMessages);
  const f = useFormat();
  const bold = (text: string) => <b className="font-medium text-fg">{text}</b>;
  const blocking = problems.filter((p) => p.blocking);
  const warnings = problems.filter((p) => !p.blocking);
  const edge = selection?.kind === "edge" ? selection.from : null;
  const edgeTarget = edge ? targetOf(doc, edge) : undefined;
  let edgeLabel = "";
  if (edge && edgeTarget) {
    if (edge.kind === "trigger") edgeLabel = t("edgeFromTrigger", { to: String(numbers.get(edgeTarget)) });
    else {
      const button = doc.steps.find((s) => s.id === edge.stepId)?.buttons.find((b) => b.id === edge.buttonId);
      edgeLabel = t("edgeFromButton", {
        button: button?.title.trim() || t("untitledButton"),
        from: String(numbers.get(edge.stepId)),
        to: String(numbers.get(edgeTarget)),
      });
    }
  }

  return (
    <div>
      {edge && edgeTarget && (
        <div className="px-5 pt-5">
          <div className="space-y-3 rounded-xl border border-accent/30 bg-accent-soft/50 p-4">
            <div>
              <p className="text-xs font-medium text-fg-2">{t("selectedEdge")}</p>
              <p className="mt-0.5 text-sm font-medium">{edgeLabel}</p>
            </div>
            <Button variant="danger" size="sm" icon={<Unlink />} onClick={() => dispatch({ type: "disconnect", from: edge })}>
              {t("deleteEdge")}
            </Button>
          </div>
        </div>
      )}

      {serverError && (
        <div className="px-5 pt-5">
          <Notice tone="critical" title={t("saveFailed")}>
            {serverError}
          </Notice>
        </div>
      )}

      <PanelSection title={t("beforeSave")} description={blocking.length ? t("beforeSaveHint") : undefined}>
        {blocking.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-good-soft px-3 py-2.5 text-sm font-medium text-good-text">
            <CircleCheck size={18} aria-hidden="true" />
            {t("readyToSave")}
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
        <PanelSection title={t("resultsTitle")} description={t("resultsSince")}>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              [t("resultRuns"), f.number(stats.triggers), t("resultRunsUnit")],
              [t("resultSent"), f.number(stats.sent), t("resultSentUnit")],
              [t("resultCtr"), f.percent(stats.ctr), t("resultCtrUnit")],
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

      <PanelSection title={t("howTo")}>
        <ul className="space-y-3.5">
          <Tip icon={<MousePointerClick />}>{t.rich("tipTap", { action: bold(t("tipTapAction")) })}</Tip>
          <Tip icon={<Spline />}>{t.rich("tipConnect", { action: bold(t("tipConnectAction")) })}</Tip>
          <Tip icon={<Hand />}>{t.rich("tipPan", { action: bold(t("tipPanAction")) })}</Tip>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Zap />} onClick={() => dispatch({ type: "select", selection: { kind: "trigger" } })}>
            {t("editTrigger")}
          </Button>
          <Button variant="secondary" size="sm" icon={<CalendarClock />} onClick={onSchedule}>
            {t("scheduleLabel")}
          </Button>
        </div>
      </PanelSection>
    </div>
  );
}
