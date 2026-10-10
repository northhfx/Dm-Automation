"use client";

import { Fragment, memo, useLayoutEffect, useRef, type ReactNode } from "react";
import {
  CalendarClock,
  CircleAlert,
  Copy,
  ExternalLink,
  Layers,
  ListChecks,
  MessageCircle,
  MessageSquareText,
  MessageSquareReply,
  MessageSquareOff,
  Pencil,
  Send,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { cx, formatNumber, formatPercent } from "@/components/ui";
import type { FlowStep } from "@/lib/flows/types";
import type { StepStats } from "@/lib/stats";
import {
  CARD_WIDTH,
  INPUT_HANDLE_Y,
  nextPostStatus,
  postIdsOf,
  stepCtr,
  TRIGGER_NODE,
  TRIGGER_WIDTH,
  type BuilderDoc,
  type MeasuredNode,
} from "./model";
import { PlatformMark } from "./widgets";

/* ---------------------------------------------------------------- การวัดขนาดการ์ด (หน่วย world ไม่ขึ้นกับซูม) */

/** ระยะจากขอบบนของการ์ดถึงจุดกึ่งกลางของ el (ใช้ offsetTop จึงไม่เพี้ยนตามการซูม) */
function centerYWithin(el: HTMLElement, node: HTMLElement): number {
  // offsetTop นับจากด้านในขอบการ์ด → บวกความหนาขอบ (clientTop) ด้วย
  let y = el.offsetHeight / 2 + node.clientTop;
  let cur: HTMLElement | null = el;
  while (cur && cur !== node) {
    y += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return y;
}

function useMeasure(id: string, onMeasure: (id: string, m: MeasuredNode) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onMeasure);
  useLayoutEffect(() => {
    cb.current = onMeasure;
  });
  // วัดใหม่ทุกครั้งที่ render (ถูก: การ์ดมีไม่เกิน 21 ใบ) + เมื่อขนาดเปลี่ยนเอง เช่น ฟอนต์โหลดเสร็จ
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handles: Record<string, number> = {};
    node.querySelectorAll<HTMLElement>("[data-handle]").forEach((h) => {
      handles[h.dataset.handle!] = Math.round(centerYWithin(h, node));
    });
    cb.current(id, { w: node.offsetWidth, h: node.offsetHeight, handles });
  });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const handles: Record<string, number> = {};
      node.querySelectorAll<HTMLElement>("[data-handle]").forEach((h) => {
        handles[h.dataset.handle!] = Math.round(centerYWithin(h, node));
      });
      cb.current(id, { w: node.offsetWidth, h: node.offsetHeight, handles });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [id]);
  return ref;
}

/* ---------------------------------------------------------------- ชิ้นส่วนที่ใช้ร่วมกัน */

/** แสดงข้อความ โดยแทน {name} ด้วยชิป "ชื่อลูกค้า" */
export function TextWithName({ text, chipClassName }: { text: string; chipClassName?: string }) {
  const parts = text.split("{name}");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <span
              className={cx(
                "mx-0.5 inline-flex items-center rounded-md bg-accent-soft px-1.5 align-baseline text-[0.85em] font-medium whitespace-nowrap text-accent",
                chipClassName,
              )}
            >
              ชื่อลูกค้า
            </span>
          )}
        </Fragment>
      ))}
    </>
  );
}

/** จุดต่อเส้นขาออก (ลากเพื่อเชื่อม/สร้างการ์ดใหม่ หรือแตะเพื่อสร้างการ์ดถัดไป) */
function OutHandle({ handle, connected, label, className }: { handle: string; connected: boolean; label: string; className?: string }) {
  return (
    <button
      type="button"
      data-handle={handle}
      aria-label={label}
      title={connected ? "ลากไปการ์ดอื่นเพื่อเปลี่ยน · แตะเพื่อเลือกเส้น" : "ลากไปวางเพื่อสร้าง/เชื่อมข้อความถัดไป · แตะเพื่อสร้างข้อความใหม่"}
      className={cx(
        // จอสัมผัส: ขยายพื้นที่แตะรอบจุด (before) — ตอนซูมออกจุดจะเล็กมาก
        "group/handle absolute top-[calc(50%-14px)] flex h-7 w-7 cursor-crosshair items-center justify-center rounded-full pointer-coarse:before:absolute pointer-coarse:before:-inset-2 pointer-coarse:before:rounded-full focus-visible:outline-none",
        className,
      )}
    >
      <span
        className={cx(
          "block h-3.5 w-3.5 rounded-full border-2 transition-transform group-hover/handle:scale-125 group-focus-visible/handle:ring-2 group-focus-visible/handle:ring-accent/40",
          connected ? "border-accent bg-accent" : "border-accent bg-surface",
        )}
      />
    </button>
  );
}

/** ความกว้างโดยประมาณของแถบปุ่มเหนือการ์ด (px บนจอ ไม่ขึ้นกับการซูม) */
export const NODE_TOOLBAR_W = 232;

function NodeToolbar({ zoom, children }: { zoom: number; children: ReactNode }) {
  return (
    <div
      data-no-drag
      role="toolbar"
      aria-label="จัดการการ์ด"
      className="absolute bottom-full left-0 mb-2 flex items-center gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-lg"
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: "bottom left" }}
    >
      {children}
    </div>
  );
}

function ToolbarButton({ onClick, icon, label, danger }: { onClick: () => void; icon: ReactNode; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium pointer-coarse:h-10 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
        danger ? "text-critical-text hover:bg-critical-soft" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

const cardBase =
  "absolute rounded-xl border bg-surface text-left outline-none focus-visible:ring-[3px] focus-visible:ring-accent/40 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.08)] transition-[border-color,box-shadow]";

/* ---------------------------------------------------------------- การ์ด "เมื่อ…" */

/**
 * สีของสิ่งที่ยังไม่ครบ: ก่อนกดบันทึกครั้งแรกใช้สีเตือน (กฎใหม่ยังไม่ได้กรอกเป็นเรื่องปกติ)
 * กดบันทึกแล้วไม่ผ่าน (strict) → สีแดง
 */
const missingText = (strict: boolean) => (strict ? "text-critical-text" : "text-warning-text");

/** บรรทัดสรุปว่ากฎใช้กับโพสต์/รีลไหน */
function PostScopeLine({ doc, strict }: { doc: BuilderDoc; strict: boolean }) {
  const row = "flex items-start gap-2";
  const icon = "mt-px shrink-0 text-fg-3";
  if (doc.postScope === "specific") {
    const count = postIdsOf(doc).length;
    return (
      <li className={row}>
        <ListChecks size={14} className={icon} aria-hidden="true" />
        {count ? <span>โพสต์/รีลที่เลือก ({count})</span> : <span className={cx("font-medium", missingText(strict))}>ยังไม่ได้เลือกโพสต์หรือรีล</span>}
      </li>
    );
  }
  if (doc.postScope === "next") {
    const status = nextPostStatus(doc);
    return (
      <li className={row}>
        <CalendarClock size={14} className={icon} aria-hidden="true" />
        <span className="min-w-0">
          โพสต์หรือรีลถัดไป
          <span aria-hidden="true"> · </span>
          {status.kind === "bound" ? (
            <span className="inline-flex flex-wrap items-center gap-x-1 align-bottom">
              <span className="font-medium text-good-text">ผูกแล้ว</span>
              {status.bound.map((p) => (
                <PlatformMark key={p} platform={p} />
              ))}
              {status.waiting.length > 0 && (
                <>
                  <span aria-hidden="true">·</span> รอ
                  {status.waiting.map((p) => (
                    <PlatformMark key={p} platform={p} />
                  ))}
                </>
              )}
            </span>
          ) : status.kind === "waiting" ? (
            <span className="font-medium text-accent">รอโพสต์ใหม่</span>
          ) : (
            <span>{status.kind === "rearm" ? "เริ่มนับใหม่หลังบันทึก" : "เริ่มนับหลังบันทึก"}</span>
          )}
        </span>
      </li>
    );
  }
  return (
    <li className={row}>
      <Layers size={14} className={icon} aria-hidden="true" />
      ทุกโพสต์และรีล
    </li>
  );
}

interface TriggerNodeProps {
  doc: BuilderDoc;
  selected: boolean;
  problem: boolean;
  /** เคยกดบันทึกแล้วไม่ผ่าน → แสดงสิ่งที่ต้องแก้เป็นสีแดง */
  showErrors: boolean;
  onMeasure: (id: string, m: MeasuredNode) => void;
}

const KEYWORD_LIMIT = 6;

export const TriggerNode = memo(function TriggerNode({ doc, selected, problem, showErrors, onMeasure }: TriggerNodeProps) {
  const ref = useMeasure(TRIGGER_NODE, onMeasure);
  const { trigger, platforms, matchType, keywords, triggerPos } = doc;
  const replies = doc.publicReplies.filter((r) => r.trim()).length;
  const shown = keywords.slice(0, KEYWORD_LIMIT);
  const connected = !!doc.startStepId;
  const TriggerIcon = trigger === "comment" ? MessageCircle : Send;

  return (
    <div
      ref={ref}
      data-node={TRIGGER_NODE}
      tabIndex={0}
      aria-label="การ์ด เมื่อ…"
      className={cx(
        cardBase,
        "cursor-grab active:cursor-grabbing",
        selected ? "border-accent ring-[3px] ring-accent/25" : "border-line hover:border-fg-3/50",
      )}
      style={{ left: triggerPos.x, top: triggerPos.y, width: TRIGGER_WIDTH }}
    >
      <div className="flex h-[52px] items-center gap-2.5 rounded-t-xl border-b border-line bg-accent-soft/60 px-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
          <Zap size={15} strokeWidth={2.25} aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold">เมื่อ…</span>
        {problem && (
          <span
            className={cx(
              "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              showErrors ? "bg-critical-soft text-critical-text" : "bg-warning-soft text-warning-text",
            )}
          >
            <CircleAlert size={12} aria-hidden="true" /> {showErrors ? "ต้องแก้ไข" : "ยังไม่ครบ"}
          </span>
        )}
      </div>
      <div className="space-y-3 p-3.5 text-sm">
        <div className="flex items-start gap-2.5">
          <TriggerIcon size={16} className="mt-0.5 shrink-0 text-fg-2" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-medium leading-snug">{trigger === "comment" ? "มีคนคอมเมนต์ใต้โพสต์" : "มีคนทักแชท (DM) มา"}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-2">
              {platforms.length ? (
                platforms.map((p) => <PlatformMark key={p} platform={p} withLabel />)
              ) : (
                <span className={missingText(showErrors)}>ยังไม่ได้เลือกแพลตฟอร์ม</span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-surface-2 p-2.5">
          {matchType === "any" ? (
            <div className="text-xs text-fg-2">ทุกข้อความ (ไม่ต้องมีคำเฉพาะ)</div>
          ) : (
            <>
              <div className="mb-1.5 text-xs text-fg-2">{matchType === "exact" ? "พิมพ์ตรงทั้งข้อความว่า" : "มีคำว่า"}</div>
              {keywords.length ? (
                <div className="flex flex-wrap gap-1">
                  {shown.map((k, i) => (
                    <span key={i} className="max-w-full truncate rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs font-medium">
                      {k}
                    </span>
                  ))}
                  {keywords.length > shown.length && (
                    <span className="rounded-md px-1.5 py-0.5 text-xs text-fg-2">+{keywords.length - shown.length}</span>
                  )}
                </div>
              ) : (
                <div className={cx("text-xs font-medium", missingText(showErrors))}>ยังไม่ได้ใส่คำ</div>
              )}
            </>
          )}
        </div>

        {trigger === "comment" && (
          <ul className="space-y-1.5 text-xs text-fg-2">
            <PostScopeLine doc={doc} strict={showErrors} />
            <li className="flex items-center gap-2">
              {replies ? (
                <MessageSquareReply size={14} className="shrink-0 text-fg-3" aria-hidden="true" />
              ) : (
                <MessageSquareOff size={14} className="shrink-0 text-fg-3" aria-hidden="true" />
              )}
              {replies ? `ตอบใต้คอมเมนต์ ${replies} แบบ (สุ่ม)` : "ไม่ตอบใต้คอมเมนต์"}
            </li>
          </ul>
        )}
      </div>
      <div className="relative flex h-11 items-center justify-end gap-2 border-t border-line px-3.5 text-xs">
        {!connected && <span className={cx("mr-auto font-medium", missingText(showErrors))}>ยังไม่ได้เชื่อมข้อความแรก</span>}
        <span className="font-medium text-fg-2">แล้วส่ง</span>
        <OutHandle handle="out" connected={connected} label="จุดต่อ แล้วส่ง — ลากไปที่ข้อความแรก" className="-right-[15px]" />
      </div>
    </div>
  );
});

/* ---------------------------------------------------------------- การ์ดข้อความ */

interface MessageNodeProps {
  step: FlowStep;
  number: number;
  isStart: boolean;
  x: number;
  y: number;
  selected: boolean;
  /** กำลังลากเส้นมาวางบนการ์ดนี้ */
  dropTarget: boolean;
  /** ระหว่างลากเส้น: การ์ดนี้รับเส้นได้ไหม */
  linking: boolean;
  unreachable: boolean;
  error?: string;
  /** เคยกดบันทึกแล้วไม่ผ่าน → ขอบการ์ดที่มีปัญหาเป็นสีแดง (ก่อนหน้านั้นสีเตือน) */
  showErrors: boolean;
  stat?: StepStats;
  /** id ของข้อความที่มีอยู่จริง (ไว้ดูว่าปุ่มเชื่อมแล้วหรือยัง) */
  stepIds: Set<string>;
  zoom: number;
  onMeasure: (id: string, m: MeasuredNode) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export const MessageNode = memo(function MessageNode(props: MessageNodeProps) {
  const { step, number, isStart, x, y, selected, dropTarget, linking, unreachable, error, showErrors, stat, stepIds, zoom } = props;
  const ref = useMeasure(step.id, props.onMeasure);
  const text = step.text.trim();
  const ctr = stepCtr(stat);

  return (
    <div
      ref={ref}
      data-node={step.id}
      tabIndex={0}
      aria-label={`ข้อความ #${number}`}
      className={cx(
        cardBase,
        "cursor-grab active:cursor-grabbing",
        dropTarget
          ? "border-accent ring-4 ring-accent/30"
          : selected
            ? "border-accent ring-[3px] ring-accent/25"
            : error
              ? showErrors
                ? "border-critical/60 hover:border-critical"
                : "border-warning/70 hover:border-warning"
              : unreachable
                ? "border-dashed border-fg-3/60 hover:border-fg-3"
                : "border-line hover:border-fg-3/50",
        linking && !dropTarget && "ring-2 ring-accent/15",
      )}
      style={{ left: x, top: y, width: CARD_WIDTH }}
    >
      {selected && (
        <NodeToolbar zoom={zoom}>
          <ToolbarButton onClick={() => props.onEdit(step.id)} icon={<Pencil size={14} aria-hidden="true" />} label="แก้ไข" />
          <ToolbarButton onClick={() => props.onDuplicate(step.id)} icon={<Copy size={14} aria-hidden="true" />} label="ทำสำเนา" />
          <ToolbarButton onClick={() => props.onDelete(step.id)} icon={<Trash2 size={14} aria-hidden="true" />} label="ลบ" danger />
        </NodeToolbar>
      )}

      {/* จุดรับเส้น */}
      <span
        aria-hidden="true"
        data-in={step.id}
        className={cx(
          "absolute -left-[5px] h-4 w-2.5 -translate-y-1/2 rounded-full border-2 border-surface",
          isStart || !unreachable ? "bg-accent" : "bg-fg-3",
        )}
        style={{ top: INPUT_HANDLE_Y }}
      />

      <div className="flex h-[52px] items-center gap-2.5 border-b border-line px-3.5">
        <span
          className={cx(
            "flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-semibold tabular",
            isStart ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg",
          )}
        >
          {number}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <MessageSquareText size={15} className="text-fg-3" aria-hidden="true" />
          ส่งข้อความ
        </span>
        {isStart && <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">ข้อความแรก</span>}
      </div>

      <div className="space-y-2 p-3.5">
        <p className={cx("line-clamp-6 text-sm leading-relaxed break-words whitespace-pre-line", !text && "text-fg-3 italic")}>
          {text ? <TextWithName text={text} /> : "ยังไม่มีข้อความ — กดเพื่อพิมพ์"}
        </p>
        {step.buttons.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {step.buttons.map((b) => {
              const connected = b.type === "next" && !!b.nextStepId && stepIds.has(b.nextStepId) && b.nextStepId !== step.id;
              return (
                <div
                  key={b.id}
                  className="relative flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2/70 px-3 text-sm font-medium"
                >
                  <span className={cx("truncate", !b.title.trim() && "font-normal text-fg-3")}>{b.title.trim() || "ชื่อปุ่ม"}</span>
                  {b.type === "link" ? (
                    <ExternalLink size={13} className="shrink-0 text-fg-3" aria-label="เปิดลิงก์" />
                  ) : (
                    <OutHandle
                      handle={b.id}
                      connected={connected}
                      label={`จุดต่อของปุ่ม ${b.title || "ไม่มีชื่อ"}`}
                      className="-right-[29px]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {((error && text) || unreachable) && (
        <div className="space-y-1 border-t border-line px-3.5 py-2">
          {error && text && (
            <div className={cx("flex items-start gap-1.5 text-xs font-medium", missingText(showErrors))} title={error}>
              <CircleAlert size={13} className="mt-px shrink-0" aria-hidden="true" />
              <span className="line-clamp-2">{error.replace(/^ข้อความที่ \d+\s*/, "").replace(/^:\s*/, "")}</span>
            </div>
          )}
          {unreachable && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
              <TriangleAlert size={13} className="shrink-0 text-warning" aria-hidden="true" />
              ยังไม่ได้เชื่อม — จะไม่ถูกส่ง
            </div>
          )}
        </div>
      )}

      {stat && stat.sent > 0 && (
        <div className="flex items-center gap-1.5 rounded-b-xl border-t border-line bg-surface-2/50 px-3.5 py-2 text-xs text-fg-2 tabular">
          <span>
            ส่ง <span className="font-semibold text-fg">{formatNumber(stat.sent)}</span> ครั้ง
          </span>
          {step.buttons.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                อัตราการกด <span className="font-semibold text-fg">{formatPercent(ctr)}</span>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
});
