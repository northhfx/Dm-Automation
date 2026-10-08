"use client";

import { Fragment, useState } from "react";
import { Badge, buttonClass, cx, inputClass } from "@/components/ui";
import type { TriggerType } from "@/db/schema";
import { FLOW_LIMITS, type FlowButton, type FlowStep } from "@/lib/flows/types";
import type { StepStats } from "@/lib/stats";

interface Props {
  initial: FlowStep[];
  trigger: TriggerType;
  /** สถิติของแต่ละข้อความ (มีเฉพาะตอนแก้กฎที่เคยใช้งานแล้ว) */
  stats?: Record<string, StepStats>;
}

function newId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return prefix + random.replace(/-/g, "").slice(0, 10);
}

function blankStep(): FlowStep {
  return { id: newId("s"), text: "", buttons: [] };
}

const PREVIEW_NAME = "มิ้นท์";

/** แก้ข้อความที่จะส่งทาง DM: ข้อความแรกส่งทันที ข้อความถัดไปส่งเมื่อลูกค้ากดปุ่ม */
export function StepsEditor({ initial, trigger, stats }: Props) {
  const [steps, setSteps] = useState<FlowStep[]>(initial.length ? initial : [blankStep()]);

  const numberOf = (id: string | undefined) => steps.findIndex((s) => s.id === id) + 1;

  function updateStep(id: string, patch: Partial<FlowStep>) {
    setSteps((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function updateButton(stepId: string, buttonId: string, patch: Partial<FlowButton>) {
    setSteps((all) =>
      all.map((s) => (s.id === stepId ? { ...s, buttons: s.buttons.map((b) => (b.id === buttonId ? { ...b, ...patch } : b)) } : s)),
    );
  }

  function removeButton(stepId: string, buttonId: string) {
    setSteps((all) => all.map((s) => (s.id === stepId ? { ...s, buttons: s.buttons.filter((b) => b.id !== buttonId) } : s)));
  }

  /** ปุ่ม "ส่งข้อความถัดไป" พร้อมสร้างข้อความใหม่ต่อท้ายให้เลย */
  function addNextButton(stepId: string) {
    const next = blankStep();
    setSteps((all) => {
      const index = all.findIndex((s) => s.id === stepId);
      const withButton = all.map((s) =>
        s.id === stepId
          ? { ...s, buttons: [...s.buttons, { id: newId("b"), title: "", type: "next" as const, nextStepId: next.id }] }
          : s,
      );
      return [...withButton.slice(0, index + 1), next, ...withButton.slice(index + 1)];
    });
  }

  function addLinkButton(stepId: string) {
    setSteps((all) =>
      all.map((s) => (s.id === stepId ? { ...s, buttons: [...s.buttons, { id: newId("b"), title: "", type: "link" as const, url: "" }] } : s)),
    );
  }

  function removeStep(stepId: string) {
    setSteps((all) =>
      all
        .filter((s) => s.id !== stepId)
        .map((s) => ({ ...s, buttons: s.buttons.map((b) => (b.nextStepId === stepId ? { ...b, nextStepId: "" } : b)) })),
    );
  }

  function changeType(stepId: string, button: FlowButton, type: FlowButton["type"]) {
    if (type === button.type) return;
    if (type === "link") updateButton(stepId, button.id, { type, url: button.url ?? "", nextStepId: undefined });
    else {
      const fallback = steps.find((s) => s.id !== stepId)?.id ?? "";
      updateButton(stepId, button.id, { type, nextStepId: button.nextStepId || fallback, url: undefined });
    }
  }

  return (
    <div>
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />

      {steps.map((step, index) => {
        const incoming = steps.flatMap((s) =>
          s.buttons.filter((b) => b.type === "next" && b.nextStepId === step.id).map((b) => ({ from: s, button: b })),
        );
        const fromPrevious = index > 0 ? incoming.filter((x) => x.from.id === steps[index - 1].id) : [];
        const maxLength = step.buttons.length ? FLOW_LIMITS.textWithButtons : FLOW_LIMITS.textPlain;
        const stat = stats?.[step.id];

        return (
          <Fragment key={step.id}>
            {index > 0 && (
              <div className="flex flex-col items-center py-1 text-xs text-fg-2" aria-hidden={fromPrevious.length === 0}>
                <span className={cx("h-4 w-px", fromPrevious.length ? "bg-accent" : "bg-line")} />
                {fromPrevious.length > 0 && (
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent">
                    เมื่อกด {fromPrevious.map((x) => `"${x.button.title || "ปุ่ม"}"`).join(" หรือ ")}
                  </span>
                )}
                <span className={cx("h-4 w-px", fromPrevious.length ? "bg-accent" : "bg-line")} />
                <span className={fromPrevious.length ? "text-accent" : "text-fg-3"}>▼</span>
              </div>
            )}

            <section className="rounded-xl border border-line bg-surface p-4" aria-label={`ข้อความที่ ${index + 1}`}>
              <header className="mb-3 flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
                  {index + 1}
                </span>
                <span className="font-semibold">ข้อความที่ {index + 1}</span>
                {index === 0 ? (
                  <Badge tone="accent">ส่งทันทีเมื่อมีคน{trigger === "comment" ? "คอมเมนต์" : "ทักแชท"}</Badge>
                ) : incoming.length ? (
                  <Badge>
                    ส่งเมื่อกด {incoming.map((x) => `"${x.button.title || "ปุ่ม"}" (ข้อความที่ ${numberOf(x.from.id)})`).join(", ")}
                  </Badge>
                ) : (
                  <Badge tone="warning">ยังไม่มีปุ่มพามาที่ข้อความนี้</Badge>
                )}
                {stat && (
                  <span className="text-xs text-fg-3">
                    ส่งแล้ว {stat.sent.toLocaleString("th-TH")} ครั้ง
                    {step.buttons.length > 0 &&
                      ` · กด ${stat.engaged.toLocaleString("th-TH")} คน${stat.reached ? ` (${Math.round((stat.engaged / stat.reached) * 100)}%)` : ""}`}
                  </span>
                )}
                {steps.length > 1 && (
                  <button type="button" onClick={() => removeStep(step.id)} className="ml-auto text-sm text-critical-text hover:underline">
                    ลบข้อความนี้
                  </button>
                )}
              </header>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0 space-y-3">
                  <div className="space-y-1">
                    <label htmlFor={`text-${step.id}`} className="block text-sm font-medium">
                      ข้อความ
                    </label>
                    <textarea
                      id={`text-${step.id}`}
                      rows={4}
                      value={step.text}
                      onChange={(e) => updateStep(step.id, { text: e.target.value })}
                      placeholder="เช่น สวัสดีค่ะคุณ {name} ขอบคุณที่สนใจนะคะ"
                      className={inputClass}
                    />
                    <p className={cx("text-xs", step.text.length > maxLength ? "text-critical-text" : "text-fg-3")}>
                      {step.text.length}/{maxLength} ตัวอักษร · ใช้ {"{name}"} แทนชื่อลูกค้า
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">ปุ่มใต้ข้อความ (ไม่บังคับ สูงสุด {FLOW_LIMITS.maxButtons} ปุ่ม)</div>
                    {step.buttons.map((button, bIndex) => (
                      <div key={button.id} className="space-y-2 rounded-lg border border-line bg-surface-2 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <label htmlFor={`title-${button.id}`} className="sr-only">
                            ชื่อปุ่มที่ {bIndex + 1}
                          </label>
                          <input
                            id={`title-${button.id}`}
                            value={button.title}
                            maxLength={FLOW_LIMITS.buttonTitle}
                            onChange={(e) => updateButton(step.id, button.id, { title: e.target.value })}
                            placeholder="ชื่อปุ่ม เช่น ใช่ ฉันสนใจ!"
                            className={cx(inputClass, "min-w-0 flex-1")}
                          />
                          <button
                            type="button"
                            onClick={() => removeButton(step.id, button.id)}
                            className="text-sm text-fg-3 hover:text-critical-text"
                            aria-label={`ลบปุ่ม ${button.title || bIndex + 1}`}
                          >
                            ลบ
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-fg-2">กดแล้ว:</span>
                          <div className="flex rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label="กดปุ่มแล้วให้ทำอะไร">
                            {(
                              [
                                ["next", "ส่งข้อความถัดไป"],
                                ["link", "เปิดลิงก์"],
                              ] as const
                            ).map(([type, label]) => (
                              <button
                                key={type}
                                type="button"
                                role="radio"
                                aria-checked={button.type === type}
                                onClick={() => changeType(step.id, button, type)}
                                className={cx(
                                  "rounded-md px-2.5 py-1",
                                  button.type === type ? "bg-accent-soft font-medium text-accent" : "text-fg-2 hover:text-fg",
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {button.type === "next" ? (
                            <select
                              aria-label="ส่งข้อความไหน"
                              value={button.nextStepId ?? ""}
                              onChange={(e) => updateButton(step.id, button.id, { nextStepId: e.target.value })}
                              className={cx(inputClass, "w-auto min-w-0 flex-1")}
                            >
                              <option value="">— เลือกข้อความ —</option>
                              {steps
                                .filter((s) => s.id !== step.id)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    ข้อความที่ {numberOf(s.id)}
                                    {s.text ? `: ${s.text.slice(0, 24)}${s.text.length > 24 ? "…" : ""}` : ""}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <input
                              type="url"
                              aria-label="ลิงก์ปลายทาง"
                              value={button.url ?? ""}
                              onChange={(e) => updateButton(step.id, button.id, { url: e.target.value })}
                              placeholder="https://"
                              className={cx(inputClass, "w-auto min-w-0 flex-1")}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {step.buttons.length < FLOW_LIMITS.maxButtons && (
                      <div className="flex flex-wrap gap-2">
                        {steps.length < FLOW_LIMITS.maxSteps && (
                          <button type="button" onClick={() => addNextButton(step.id)} className={buttonClass.secondary}>
                            + ปุ่มส่งข้อความถัดไป
                          </button>
                        )}
                        <button type="button" onClick={() => addLinkButton(step.id)} className={buttonClass.secondary}>
                          + ปุ่มเปิดลิงก์
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <MessagePreview step={step} />
              </div>
            </section>
          </Fragment>
        );
      })}

      {steps.length < FLOW_LIMITS.maxSteps && (
        <div className="mt-3">
          <button type="button" onClick={() => setSteps((all) => [...all, blankStep()])} className={buttonClass.secondary}>
            + เพิ่มข้อความ
          </button>
        </div>
      )}
    </div>
  );
}

/** หน้าตาข้อความในแชทของลูกค้า */
function MessagePreview({ step }: { step: FlowStep }) {
  const text = step.text.replaceAll("{name}", PREVIEW_NAME).trim();
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs text-fg-3">ตัวอย่างที่ลูกค้าเห็น</div>
      <div className="rounded-2xl rounded-bl-md bg-surface-2 p-3 text-sm">
        <p className="whitespace-pre-line break-words">{text || <span className="text-fg-3">(ยังไม่มีข้อความ)</span>}</p>
        {step.buttons.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {step.buttons.map((b) => (
              <div key={b.id} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-center font-medium">
                {b.title || "ชื่อปุ่ม"}
                {b.type === "link" && <span className="ml-1 text-fg-3">↗</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
