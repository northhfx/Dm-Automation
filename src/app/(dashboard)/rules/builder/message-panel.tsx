"use client";

import { useId, useRef, type Dispatch } from "react";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Flag, Plus, Trash2, UserRound } from "lucide-react";
import { SegmentedControl } from "@/components/segmented-control";
import { Button, cx, Field, formatNumber, formatPercent, IconButton, inputClass, Notice, selectClass, textareaClass } from "@/components/ui";
import { FLOW_LIMITS, measuredLength, NAME_ALLOWANCE, type FlowButton, type FlowStep } from "@/lib/flows/types";
import type { StepStats } from "@/lib/stats";
import { newId, stepCtr, type BuilderAction, type BuilderDoc, type EdgeFrom, type Problem } from "./model";
import { PanelSection } from "./trigger-panel";

const PREVIEW_NAME = "มิ้นท์";
const NEW_STEP = "__new__";

interface Props {
  doc: BuilderDoc;
  step: FlowStep;
  numbers: Map<string, number>;
  problem?: Problem;
  unreachable: boolean;
  /** เคยกดบันทึกแล้วไม่ผ่าน */
  showErrors: boolean;
  stat?: StepStats;
  dispatch: Dispatch<BuilderAction>;
  /** สร้างข้อความใหม่ต่อจากปุ่มนี้ */
  onCreateFrom: (from: EdgeFrom) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function snippet(text: string): string {
  const t = text.replaceAll("{name}", "ชื่อลูกค้า").replace(/\s+/g, " ").trim();
  if (!t) return "(ยังไม่มีข้อความ)";
  return t.length > 28 ? `${t.slice(0, 28)}…` : t;
}

export function MessagePanel({ doc, step, numbers, problem, unreachable, showErrors, stat, dispatch, onCreateFrom, onDuplicate, onDelete }: Props) {
  const ids = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const isStart = doc.startStepId === step.id;
  const limit = step.buttons.length ? FLOW_LIMITS.textWithButtons : FLOW_LIMITS.textPlain;
  const length = measuredLength(step.text);
  const over = length > limit;
  // การ์ดว่าง: ช่องพิมพ์บอกอยู่แล้ว ไม่ต้องเตือนซ้ำ จนกว่าจะกดบันทึก
  const showProblem = !!problem && (!!step.text.trim() || showErrors);

  function setText(text: string) {
    dispatch({ type: "setText", stepId: step.id, text, at: Date.now() });
  }

  function insertName() {
    const el = textRef.current;
    const start = el?.selectionStart ?? step.text.length;
    const end = el?.selectionEnd ?? start;
    setText(step.text.slice(0, start) + "{name}" + step.text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + 6, start + 6);
    });
  }

  const updateButton = (b: FlowButton, patch: Partial<Omit<FlowButton, "id">>) =>
    dispatch({ type: "updateButton", stepId: step.id, buttonId: b.id, patch, at: Date.now() });

  const others = [...numbers.entries()].filter(([id]) => id !== step.id).sort((a, b) => a[1] - b[1]);
  const textByStep = new Map(doc.steps.map((s) => [s.id, s.text]));

  return (
    <div>
      {(showProblem || unreachable) && (
        <div className="space-y-2 px-5 pt-5">
          {showProblem && <Notice tone="critical">{problem?.message}</Notice>}
          {unreachable && (
            <Notice tone="warning">
              {doc.startStepId
                ? 'ยังไม่มีปุ่มไหนพามาที่ข้อความนี้ จึงจะไม่ถูกส่ง — ลากเส้นจากจุดข้างปุ่มของการ์ดอื่นมาที่การ์ดนี้ หรือกด "ตั้งเป็นข้อความแรก"'
                : 'การ์ด "เมื่อ…" ยังไม่ได้เชื่อมกับข้อความไหน — กด "ตั้งเป็นข้อความแรก" ถ้าอยากให้ส่งข้อความนี้ก่อน'}
            </Notice>
          )}
        </div>
      )}

      <PanelSection>
        <Field
          label="ข้อความที่จะส่ง"
          htmlFor={`${ids}-text`}
          aside={
            <span className={cx(over && "font-medium text-critical-text")}>
              {formatNumber(length)}/{formatNumber(limit)}
            </span>
          }
          hint={
            step.text.includes("{name}")
              ? `{name} จะถูกแทนด้วยชื่อลูกค้า (นับเผื่อ ${NAME_ALLOWANCE} ตัวอักษร)`
              : step.buttons.length
                ? `ข้อความที่มีปุ่มยาวได้ ${FLOW_LIMITS.textWithButtons} ตัวอักษร`
                : undefined
          }
        >
          <textarea
            id={`${ids}-text`}
            ref={textRef}
            data-autofocus="text"
            rows={5}
            value={step.text}
            onChange={(e) => setText(e.target.value)}
            placeholder="พิมพ์ข้อความที่จะส่งให้ลูกค้า…"
            aria-invalid={over || undefined}
            className={textareaClass}
          />
        </Field>
        <Button variant="secondary" size="sm" icon={<UserRound />} onClick={insertName}>
          แทรกชื่อลูกค้า
        </Button>
      </PanelSection>

      <PanelSection title="ตัวอย่างที่ลูกค้าเห็น">
        <ChatPreview step={step} />
      </PanelSection>

      <PanelSection
        title={`ปุ่ม (${step.buttons.length}/${FLOW_LIMITS.maxButtons})`}
        description="ปุ่ม 'ส่งข้อความต่อ' พาไปข้อความถัดไป — ถามก่อนแล้วให้กดปุ่ม มักได้คนกดลิงก์มากกว่าส่งลิงก์ทันที"
      >
        {step.buttons.length === 0 && <p className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-xs text-fg-3">ยังไม่มีปุ่ม</p>}
        <ol className="space-y-3">
          {step.buttons.map((b, i) => {
            const titleOver = b.title.trim().length > FLOW_LIMITS.buttonTitle;
            const urlBad = b.type === "link" && b.url !== undefined && b.url.trim() !== "" && !isHttpUrl(b.url.trim());
            const target = b.type === "next" && b.nextStepId && numbers.has(b.nextStepId) && b.nextStepId !== step.id ? b.nextStepId : "";
            return (
              <li key={b.id} className="space-y-3 rounded-xl border border-line bg-surface-2/40 p-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-fg-2">ปุ่มที่ {i + 1}</span>
                  <span className="ml-auto flex items-center">
                    <IconButton icon={<ArrowUp />} label="เลื่อนขึ้น" size="sm" className="pointer-coarse:size-10" disabled={i === 0} onClick={() => dispatch({ type: "moveButton", stepId: step.id, buttonId: b.id, dir: -1 })} />
                    <IconButton
                      icon={<ArrowDown />}
                      label="เลื่อนลง"
                      size="sm"
                      className="pointer-coarse:size-10"
                      disabled={i === step.buttons.length - 1}
                      onClick={() => dispatch({ type: "moveButton", stepId: step.id, buttonId: b.id, dir: 1 })}
                    />
                    <IconButton
                      icon={<Trash2 />}
                      label={`ลบปุ่มที่ ${i + 1}`}
                      size="sm"
                      className="hover:text-critical-text pointer-coarse:size-10"
                      onClick={() => dispatch({ type: "removeButton", stepId: step.id, buttonId: b.id })}
                    />
                  </span>
                </div>
                <Field
                  label="ชื่อปุ่ม"
                  htmlFor={`${ids}-${b.id}-title`}
                  aside={
                    <span className={cx(titleOver && "font-medium text-critical-text")}>
                      {b.title.trim().length}/{FLOW_LIMITS.buttonTitle}
                    </span>
                  }
                >
                  <input
                    id={`${ids}-${b.id}-title`}
                    data-button-title={b.id}
                    value={b.title}
                    onChange={(e) => updateButton(b, { title: e.target.value })}
                    placeholder="เช่น ใช่ ฉันสนใจ!"
                    aria-invalid={titleOver || undefined}
                    className={inputClass}
                  />
                </Field>
                <SegmentedControl
                  block
                  label="กดแล้ว"
                  size="sm"
                  value={b.type}
                  onChange={(type) => updateButton(b, { type })}
                  options={[
                    { value: "next", label: "ส่งข้อความต่อ" },
                    { value: "link", label: "เปิดลิงก์", icon: <ExternalLink /> },
                  ]}
                />
                {b.type === "next" ? (
                  <Field label="ส่งข้อความไหน" htmlFor={`${ids}-${b.id}-to`}>
                    <select
                      id={`${ids}-${b.id}-to`}
                      value={target}
                      aria-invalid={!target || undefined}
                      onChange={(e) => {
                        if (e.target.value === NEW_STEP) onCreateFrom({ kind: "button", stepId: step.id, buttonId: b.id });
                        else updateButton(b, { nextStepId: e.target.value });
                      }}
                      className={selectClass}
                    >
                      <option value="">— เลือกข้อความ —</option>
                      {others.map(([id, n]) => (
                        <option key={id} value={id}>
                          #{n} · {snippet(textByStep.get(id) ?? "")}
                        </option>
                      ))}
                      <option value={NEW_STEP} disabled={doc.steps.length >= FLOW_LIMITS.maxSteps}>
                        + สร้างข้อความใหม่
                      </option>
                    </select>
                  </Field>
                ) : (
                  <Field
                    label="ลิงก์"
                    htmlFor={`${ids}-${b.id}-url`}
                    error={urlBad ? "ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http://" : undefined}
                    hint="ระบบแปลงเป็นลิงก์ติดตามการคลิกให้อัตโนมัติ"
                  >
                    <input
                      id={`${ids}-${b.id}-url`}
                      type="url"
                      inputMode="url"
                      value={b.url ?? ""}
                      onChange={(e) => updateButton(b, { url: e.target.value })}
                      placeholder="https://"
                      aria-invalid={urlBad || undefined}
                      className={inputClass}
                    />
                  </Field>
                )}
              </li>
            );
          })}
        </ol>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus />}
          block
          disabled={step.buttons.length >= FLOW_LIMITS.maxButtons}
          onClick={() => {
            const buttonId = newId("b");
            dispatch({ type: "addButton", stepId: step.id, buttonId });
            requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-button-title="${buttonId}"]`)?.focus());
          }}
        >
          {step.buttons.length >= FLOW_LIMITS.maxButtons ? "ใส่ได้สูงสุด 3 ปุ่ม" : "เพิ่มปุ่ม"}
        </Button>
      </PanelSection>

      {stat && stat.sent > 0 && (
        <PanelSection title="สถิติของข้อความนี้" description="นับตั้งแต่เริ่มใช้งาน">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["ส่งแล้ว", `${formatNumber(stat.sent)}`, "ครั้ง"],
              ["คนกด", `${formatNumber(stat.engaged)}`, `จาก ${formatNumber(stat.reached)} คน`],
              ["อัตราการกด", step.buttons.length ? formatPercent(stepCtr(stat)) : "–", "จากคนที่ได้รับ"],
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

      <PanelSection title="จัดการการ์ด">
        <div className="flex flex-wrap gap-2">
          {!isStart && (
            <Button variant="secondary" size="sm" icon={<Flag />} onClick={() => dispatch({ type: "setStart", stepId: step.id })}>
              ตั้งเป็นข้อความแรก
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={<Copy />} onClick={() => onDuplicate(step.id)} disabled={doc.steps.length >= FLOW_LIMITS.maxSteps}>
            ทำสำเนา
          </Button>
          <Button variant="danger" size="sm" icon={<Trash2 />} onClick={() => onDelete(step.id)}>
            ลบการ์ด
          </Button>
        </div>
        {isStart && <p className="text-xs text-fg-3">ข้อความนี้ส่งทันทีเมื่อกฎทำงาน (การ์ด &quot;เมื่อ…&quot; เชื่อมมาที่นี่)</p>}
      </PanelSection>
    </div>
  );
}

/** หน้าตาข้อความในแชทแบบ Messenger (ข้อความ + ปุ่มในกล่องเดียวกัน) */
function ChatPreview({ step }: { step: FlowStep }) {
  const text = step.text.trim().replaceAll("{name}", PREVIEW_NAME);
  return (
    <div className="rounded-xl bg-surface-2 p-4">
      <div className="flex items-end gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg" aria-hidden="true">
          ร้าน
        </span>
        <div className="w-full max-w-[260px] overflow-hidden rounded-2xl rounded-bl-md border border-line bg-surface shadow-[var(--elev-xs)]">
          <p className={cx("px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap", !text && "text-fg-3 italic")}>
            {text || "ยังไม่มีข้อความ"}
          </p>
          {step.buttons.map((b) => (
            <div key={b.id} className="flex items-center justify-center gap-1 border-t border-line px-3 py-2 text-sm font-medium text-accent">
              <span className="truncate">{b.title.trim() || "ชื่อปุ่ม"}</span>
              {b.type === "link" && <ExternalLink size={12} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 pl-9 text-[11px] text-fg-3">ตัวอย่างโดยใช้ชื่อลูกค้า &quot;{PREVIEW_NAME}&quot;</p>
    </div>
  );
}
