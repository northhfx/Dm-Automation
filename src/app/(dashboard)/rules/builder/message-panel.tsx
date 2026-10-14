"use client";

import { useId, useRef, type Dispatch } from "react";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Flag, Plus, Trash2, UserRound } from "lucide-react";
import { SegmentedControl } from "@/components/segmented-control";
import { Button, cx, Field, IconButton, inputClass, Notice, selectClass, textareaClass } from "@/components/ui";
import { FLOW_LIMITS, measuredLength, NAME_ALLOWANCE, type FlowButton, type FlowStep } from "@/lib/flows/types";
import { useFormat, useT } from "@/lib/i18n/client";
import { builderMessages } from "@/lib/i18n/messages/builder";
import type { StepStats } from "@/lib/stats";
import { newId, stepCtr, type BuilderAction, type BuilderDoc, type EdgeFrom, type Problem } from "./model";
import { PanelSection } from "./trigger-panel";

const NEW_STEP = "__new__";
/** คำแทนชื่อลูกค้าในข้อความ (ไม่แปล — ระบบแทนด้วยชื่อจริงตอนส่ง) */
const NAME_TOKEN = "{name}";

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

/** ข้อความสั้นๆ ของการ์ดในรายการเลือกปลายทาง ({name} → คำว่า "ชื่อลูกค้า" ตามภาษา) */
function snippet(text: string, customerName: string, empty: string): string {
  const s = text.replaceAll(NAME_TOKEN, customerName).replace(/\s+/g, " ").trim();
  if (!s) return empty;
  return s.length > 28 ? `${s.slice(0, 28)}…` : s;
}

export function MessagePanel({ doc, step, numbers, problem, unreachable, showErrors, stat, dispatch, onCreateFrom, onDuplicate, onDelete }: Props) {
  const t = useT(builderMessages);
  const f = useFormat();
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
    setText(step.text.slice(0, start) + NAME_TOKEN + step.text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + NAME_TOKEN.length, start + NAME_TOKEN.length);
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
              {t(doc.startStepId ? "unreachableHint" : "noStartHint", { action: t("setStart") })}
            </Notice>
          )}
        </div>
      )}

      <PanelSection>
        <Field
          label={t("textLabel")}
          htmlFor={`${ids}-text`}
          aside={
            <span className={cx(over && "font-medium text-critical-text")}>
              {f.number(length)}/{f.number(limit)}
            </span>
          }
          hint={
            step.text.includes(NAME_TOKEN)
              ? t("nameHint", { token: NAME_TOKEN, allowance: String(NAME_ALLOWANCE) })
              : step.buttons.length
                ? t("buttonsLimitHint", { max: String(FLOW_LIMITS.textWithButtons) })
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
            placeholder={t("textPlaceholder")}
            aria-invalid={over || undefined}
            className={textareaClass}
          />
        </Field>
        <Button variant="secondary" size="sm" icon={<UserRound />} onClick={insertName}>
          {t("insertName")}
        </Button>
      </PanelSection>

      <PanelSection title={t("previewTitle")}>
        <ChatPreview step={step} />
      </PanelSection>

      <PanelSection
        title={t("buttonsTitle", { count: step.buttons.length, max: FLOW_LIMITS.maxButtons })}
        description={t("buttonsHint", { option: t("typeNext") })}
      >
        {step.buttons.length === 0 && <p className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-xs text-fg-3">{t("noButtons")}</p>}
        <ol className="space-y-3">
          {step.buttons.map((b, i) => {
            const titleOver = b.title.trim().length > FLOW_LIMITS.buttonTitle;
            const urlBad = b.type === "link" && b.url !== undefined && b.url.trim() !== "" && !isHttpUrl(b.url.trim());
            const target = b.type === "next" && b.nextStepId && numbers.has(b.nextStepId) && b.nextStepId !== step.id ? b.nextStepId : "";
            return (
              <li key={b.id} className="space-y-3 rounded-xl border border-line bg-surface-2/40 p-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-fg-2">{t("buttonHeading", { n: i + 1 })}</span>
                  <span className="ml-auto flex items-center">
                    <IconButton icon={<ArrowUp />} label={t("moveUp")} size="sm" className="pointer-coarse:size-10" disabled={i === 0} onClick={() => dispatch({ type: "moveButton", stepId: step.id, buttonId: b.id, dir: -1 })} />
                    <IconButton
                      icon={<ArrowDown />}
                      label={t("moveDown")}
                      size="sm"
                      className="pointer-coarse:size-10"
                      disabled={i === step.buttons.length - 1}
                      onClick={() => dispatch({ type: "moveButton", stepId: step.id, buttonId: b.id, dir: 1 })}
                    />
                    <IconButton
                      icon={<Trash2 />}
                      label={t("deleteButton", { n: i + 1 })}
                      size="sm"
                      className="hover:text-critical-text pointer-coarse:size-10"
                      onClick={() => dispatch({ type: "removeButton", stepId: step.id, buttonId: b.id })}
                    />
                  </span>
                </div>
                <Field
                  label={t("buttonName")}
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
                    placeholder={t("buttonNameExample")}
                    aria-invalid={titleOver || undefined}
                    className={inputClass}
                  />
                </Field>
                <SegmentedControl
                  block
                  label={t("whenTapped")}
                  size="sm"
                  value={b.type}
                  onChange={(type) => updateButton(b, { type })}
                  options={[
                    { value: "next", label: t("typeNext") },
                    { value: "link", label: t("typeLink"), icon: <ExternalLink /> },
                  ]}
                />
                {b.type === "next" ? (
                  <Field label={t("nextTarget")} htmlFor={`${ids}-${b.id}-to`}>
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
                      <option value="">{t("pickMessage")}</option>
                      {others.map(([id, n]) => (
                        <option key={id} value={id}>
                          #{n} · {snippet(textByStep.get(id) ?? "", t("customerName"), t("noTextSnippet"))}
                        </option>
                      ))}
                      <option value={NEW_STEP} disabled={doc.steps.length >= FLOW_LIMITS.maxSteps}>
                        {t("newMessageOption")}
                      </option>
                    </select>
                  </Field>
                ) : (
                  <Field
                    label={t("linkLabel")}
                    htmlFor={`${ids}-${b.id}-url`}
                    error={urlBad ? t("linkInvalid") : undefined}
                    hint={t("linkHint")}
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
          {step.buttons.length >= FLOW_LIMITS.maxButtons ? t("maxButtons", { max: String(FLOW_LIMITS.maxButtons) }) : t("addButton")}
        </Button>
      </PanelSection>

      {stat && stat.sent > 0 && (
        <PanelSection title={t("statsTitle")} description={t("statsSince")}>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              [t("statSent"), f.number(stat.sent), t("statSentUnit")],
              [t("statEngaged"), f.number(stat.engaged), t("statEngagedUnit", { count: stat.reached })],
              [t("statCtr"), step.buttons.length ? f.percent(stepCtr(stat)) : "–", t("statCtrUnit")],
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

      <PanelSection title={t("cardActions")}>
        <div className="flex flex-wrap gap-2">
          {!isStart && (
            <Button variant="secondary" size="sm" icon={<Flag />} onClick={() => dispatch({ type: "setStart", stepId: step.id })}>
              {t("setStart")}
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={<Copy />} onClick={() => onDuplicate(step.id)} disabled={doc.steps.length >= FLOW_LIMITS.maxSteps}>
            {t("duplicate")}
          </Button>
          <Button variant="danger" size="sm" icon={<Trash2 />} onClick={() => onDelete(step.id)}>
            {t("deleteCard")}
          </Button>
        </div>
        {isStart && <p className="text-xs text-fg-3">{t("isStartHint")}</p>}
      </PanelSection>
    </div>
  );
}

/** หน้าตาข้อความในแชทแบบ Messenger (ข้อความ + ปุ่มในกล่องเดียวกัน) */
function ChatPreview({ step }: { step: FlowStep }) {
  const t = useT(builderMessages);
  const sample = t("previewName");
  const text = step.text.trim().replaceAll(NAME_TOKEN, sample);
  return (
    <div className="rounded-xl bg-surface-2 p-4">
      <div className="flex items-end gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg" aria-hidden="true">
          {t("shopAvatar")}
        </span>
        <div className="w-full max-w-[260px] overflow-hidden rounded-2xl rounded-bl-md border border-line bg-surface shadow-[var(--elev-xs)]">
          <p className={cx("px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap", !text && "text-fg-3 italic")}>
            {text || t("previewEmpty")}
          </p>
          {step.buttons.map((b) => (
            <div key={b.id} className="flex items-center justify-center gap-1 border-t border-line px-3 py-2 text-sm font-medium text-accent">
              <span className="truncate">{b.title.trim() || t("buttonNamePlaceholder")}</span>
              {b.type === "link" && <ExternalLink size={12} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 pl-9 text-[11px] text-fg-3">{t("previewNote", { sample })}</p>
    </div>
  );
}
