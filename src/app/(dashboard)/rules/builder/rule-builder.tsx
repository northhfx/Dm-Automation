"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, CircleAlert, ClipboardCheck, MessageSquareText, PanelRightClose, PanelRightOpen, Trash2, X, Zap } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { dismissToast, toast } from "@/components/toast";
import { Button, cx, IconButton } from "@/components/ui";
import type { RecentPost } from "@/lib/meta/graph";
import type { CanvasPoint } from "@/lib/flows/types";
import type { StepStats } from "@/lib/stats";
import { saveRule } from "../actions";
import type { RuleFormState, RuleFormValues } from "../form-values";
import { FlowCanvas, type CanvasApi } from "./canvas";
import { MessagePanel } from "./message-panel";
import {
  autoLayout,
  builderReducer,
  canAddStep,
  createInitialState,
  docJson,
  findFreeSpot,
  findProblems,
  newId,
  nodeBox,
  reachableSteps,
  spotRightOf,
  stepNumbers,
  toFormData,
  TRIGGER_NODE,
  type BuilderDoc,
  type EdgeFrom,
  type MeasuredNode,
  type ProblemTarget,
  type Sizes,
} from "./model";
import { OverviewPanel, type RuleSummaryStats } from "./overview-panel";
import { TopBar } from "./top-bar";
import { TriggerPanel } from "./trigger-panel";

interface Props {
  initial: RuleFormValues;
  recentPosts: RecentPost[];
  postsError: string | null;
  stepStats?: Record<string, StepStats>;
  ruleStats?: RuleSummaryStats;
}

const DESKTOP_QUERY = "(min-width: 1024px)";

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

const sameMeasure = (a: MeasuredNode | undefined, b: MeasuredNode) =>
  !!a && a.w === b.w && a.h === b.h && JSON.stringify(a.handles) === JSON.stringify(b.handles);

/**
 * หน้าสร้าง/แก้กฎแบบแผนผัง (ManyChat-style): การ์ด "เมื่อ…" → การ์ดข้อความ → ปุ่ม → การ์ดถัดไป
 * ทุกอย่างอยู่ใน reducer (ฟอร์มของ React 19 รีเซ็ตเองหลังส่งก็ไม่ทำให้ข้อมูลหาย)
 */
export function RuleBuilder({ initial, recentPosts, postsError, stepStats, ruleStats }: Props) {
  const router = useRouter();
  const ruleId = initial.id;
  const [state, dispatch] = useReducer(builderReducer, undefined, () =>
    createInitialState(
      initial,
      recentPosts.map((p) => p.id),
    ),
  );
  const { doc, selection } = state;
  const [sizes, setSizes] = useState<Sizes>({});
  const [saveState, formAction, pending] = useActionState<RuleFormState, FormData>(saveRule, {});
  // ซ่อนข้อความ error จากเซิร์ฟเวอร์เมื่อกดบันทึกใหม่
  const [clearedAttempt, setClearedAttempt] = useState<number | undefined>(undefined);
  const serverError = saveState.error && saveState.attempt !== clearedAttempt ? saveState.error : null;
  const [panelOpen, setPanelOpen] = useState(true); // เดสก์ท็อป: แผงด้านขวา
  const [sheetOpen, setSheetOpen] = useState(false); // มือถือ: แผงด้านล่าง
  const [sheetHeight, setSheetHeight] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  // เคยกดบันทึกแล้วไม่ผ่าน → แสดงข้อผิดพลาดทุกจุดเต็มๆ (ก่อนหน้านั้นเตือนแบบเบาๆ)
  const [showErrors, setShowErrors] = useState(false);
  const isDesktop = useIsDesktop();
  const canvasApi = useRef<CanvasApi>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const panelBodyRef = useRef<HTMLDivElement>(null);
  /** doc ที่ส่งไปบันทึกล่าสุด */
  const submitted = useRef<BuilderDoc | null>(null);

  const dirty = docJson(doc) !== state.savedJson;
  const problems = useMemo(() => findProblems(doc), [doc]);
  const numbers = useMemo(() => stepNumbers(doc), [doc]);
  const reach = useMemo(() => reachableSteps(doc), [doc]);
  const unreachable = useMemo(() => new Set(doc.steps.filter((s) => !reach.has(s.id)).map((s) => s.id)), [doc.steps, reach]);
  const stepErrors = useMemo(
    () => new Map(problems.flatMap((p) => (p.blocking && p.target.kind === "step" ? [[p.target.id, p.message] as const] : []))),
    [problems],
  );
  const triggerProblem = problems.some((p) => p.blocking && p.target.kind === "trigger");
  const blockingCount = problems.filter((p) => p.blocking).length;

  const onMeasure = useCallback((id: string, m: MeasuredNode) => {
    setSizes((prev) => (sameMeasure(prev[id], m) ? prev : { ...prev, [id]: m }));
  }, []);

  // การ์ดที่จัดวางอัตโนมัติจากขนาดประมาณ → จัดใหม่ครั้งเดียวด้วยขนาดจริง (ไม่นับเป็นการแก้ไข)
  const allMeasured = !!sizes[TRIGGER_NODE] && doc.steps.every((s) => sizes[s.id]);
  useEffect(() => {
    if (state.autoPlaced && allMeasured) dispatch({ type: "layout", layout: autoLayout(doc, sizes), history: false, keepClean: true });
  }, [state.autoPlaced, allMeasured, doc, sizes]);

  // เตือนก่อนปิดแท็บ/รีเฟรชถ้ายังไม่ได้บันทึก
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ความสูงของแผงด้านล่าง (มือถือ) ใช้เลื่อนแผนผังให้การ์ดที่เลือกไม่โดนบัง
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setSheetHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const bottomInset = !isDesktop && sheetOpen ? Math.max(0, sheetHeight - 56) : 0;

  /* ------------------------------------------------------------ เปิดแผง / เลือก */

  const openPanel = useCallback(() => {
    if (window.matchMedia(DESKTOP_QUERY).matches) setPanelOpen(true);
    else setSheetOpen(true);
    panelBodyRef.current?.scrollTo({ top: 0 });
  }, []);

  const reveal = useCallback((node: string) => {
    // รอให้แผงเปิด/วัดขนาดเสร็จก่อน แล้วค่อยเลื่อนแผนผัง
    requestAnimationFrame(() => requestAnimationFrame(() => canvasApi.current?.focus(node)));
  }, []);

  const goTo = useCallback(
    (target: ProblemTarget) => {
      if (target.kind === "name") {
        nameRef.current?.focus();
        return;
      }
      if (target.kind === "trigger") {
        dispatch({ type: "select", selection: { kind: "trigger" } });
        openPanel();
        reveal(TRIGGER_NODE);
      } else {
        dispatch({ type: "select", selection: { kind: "step", id: target.id } });
        openPanel();
        reveal(target.id);
      }
    },
    [openPanel, reveal],
  );

  const onNodeTap = useCallback(
    (node: string) => {
      dispatch({ type: "select", selection: node === TRIGGER_NODE ? { kind: "trigger" } : { kind: "step", id: node } });
      openPanel();
      if (!window.matchMedia(DESKTOP_QUERY).matches) reveal(node);
    },
    [openPanel, reveal],
  );

  const focusText = useCallback(() => {
    requestAnimationFrame(() => panelBodyRef.current?.querySelector<HTMLTextAreaElement>('[data-autofocus="text"]')?.focus());
  }, []);

  const onEdit = useCallback(
    (id: string) => {
      onNodeTap(id);
      if (window.matchMedia(DESKTOP_QUERY).matches) focusText();
    },
    [onNodeTap, focusText],
  );

  /* ------------------------------------------------------------ สร้าง / ทำสำเนา / ลบ */

  const latest = useRef({ doc, sizes });
  useEffect(() => {
    latest.current = { doc, sizes };
  });

  const onCreate = useCallback(
    (at: CanvasPoint, from?: EdgeFrom) => {
      if (!canAddStep(latest.current.doc)) {
        toast("ใส่ข้อความได้สูงสุด 20 ข้อความต่อกฎ", { tone: "warning" });
        return;
      }
      const id = newId("s");
      dispatch({ type: "addStep", id, at, from });
      openPanel();
      reveal(id);
      if (window.matchMedia(DESKTOP_QUERY).matches) focusText();
    },
    [openPanel, focusText, reveal],
  );

  const onCreateFrom = useCallback(
    (from: EdgeFrom) => {
      const { doc: d, sizes: s } = latest.current;
      onCreate(spotRightOf(d, s, from), from);
    },
    [onCreate],
  );

  const onDuplicate = useCallback((id: string) => {
    const { doc: d, sizes: s } = latest.current;
    const step = d.steps.find((x) => x.id === id);
    if (!step) return;
    if (!canAddStep(d)) {
      toast("ใส่ข้อความได้สูงสุด 20 ข้อความต่อกฎ", { tone: "warning" });
      return;
    }
    const box = nodeBox(d, s, id);
    const at = findFreeSpot(d, s, { x: box.x + 32, y: box.y + box.h + 32 }, box.h);
    dispatch({ type: "duplicateStep", stepId: id, id: newId("s"), buttonIds: step.buttons.map(() => newId("b")), at });
    toast("ทำสำเนาการ์ดแล้ว");
  }, []);

  const deleteToast = useRef<number | null>(null);
  const deleteNow = useCallback((id: string) => {
    const n = stepNumbers(latest.current.doc).get(id);
    dispatch({ type: "deleteStep", stepId: id });
    deleteToast.current = toast(`ลบข้อความ #${n} แล้ว`, { description: "กด Ctrl+Z หรือปุ่มย้อนกลับเพื่อเอาคืน" });
  }, []);
  // ย้อนกลับแล้ว → ปิดข้อความ "ลบแล้ว"
  useEffect(() => {
    if (state.future.length && deleteToast.current !== null) {
      dismissToast(deleteToast.current);
      deleteToast.current = null;
    }
  }, [state.future.length]);

  const onDelete = useCallback(
    (id: string) => {
      const step = latest.current.doc.steps.find((s) => s.id === id);
      if (!step) return;
      if (step.text.trim() || step.buttons.length) setPendingDelete(id);
      else deleteNow(id);
    },
    [deleteNow],
  );

  /* ------------------------------------------------------------ บันทึก */

  const save = useCallback(() => {
    if (pending) return;
    const first = problems.find((p) => p.blocking);
    if (first) {
      setShowErrors(true);
      goTo(first.target);
      toast("ยังบันทึกไม่ได้", { tone: "critical", description: first.message });
      return;
    }
    submitted.current = doc;
    setClearedAttempt(saveState.attempt);
    const data = toFormData(doc, ruleId);
    startTransition(() => formAction(data));
  }, [pending, problems, goTo, doc, ruleId, formAction, saveState.attempt]);

  const handled = useRef(saveState);
  useEffect(() => {
    if (saveState === handled.current) return;
    handled.current = saveState;
    if (saveState.error) {
      toast("บันทึกไม่สำเร็จ", { tone: "critical", description: saveState.error });
      const stepId = saveState.errorStepId;
      // เลือกการ์ดที่มีปัญหาหลังหน้าจอแสดงผลเสร็จ
      if (stepId) requestAnimationFrame(() => goTo({ kind: "step", id: stepId }));
    } else if (submitted.current) {
      // กฎเดิม: เซิร์ฟเวอร์ส่งสถานะ "โพสต์ถัดไป" ล่าสุดกลับมา (เริ่มรอเมื่อไหร่ / ผูกโพสต์ไหนแล้ว) → ใส่ให้โดยไม่นับเป็นการแก้ไข
      const v = saveState.values;
      dispatch({ type: "saved", doc: submitted.current, display: v ? { nextPostSince: v.nextPostSince, boundPosts: v.boundPosts } : undefined });
      toast("บันทึกแล้ว", { tone: "good" });
    }
  }, [saveState, goTo]);

  /* ------------------------------------------------------------ คีย์ลัด */

  const keys = useRef({ save, selection, onDelete });
  useEffect(() => {
    keys.current = { save, selection, onDelete };
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const typing = isTyping(document.activeElement);
      if (mod && key === "s") {
        e.preventDefault();
        keys.current.save();
      } else if (mod && key === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && key === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (e.key === "Escape") {
        if (canvasApi.current?.cancel()) return;
        if (typing) (document.activeElement as HTMLElement).blur();
        else dispatch({ type: "select", selection: null });
      } else if ((e.key === "Delete" || e.key === "Backspace") && !typing && !mod) {
        const sel = keys.current.selection;
        if (sel?.kind === "step") {
          e.preventDefault();
          keys.current.onDelete(sel.id);
        } else if (sel?.kind === "edge") {
          e.preventDefault();
          dispatch({ type: "disconnect", from: sel.from });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* ------------------------------------------------------------ ออกจากหน้า */

  function onLeave(e: MouseEvent<HTMLAnchorElement>) {
    if (!dirty) return;
    e.preventDefault();
    setLeaveOpen(true);
  }

  /* ------------------------------------------------------------ แผงด้านข้าง */

  const selectedStep = selection?.kind === "step" ? doc.steps.find((s) => s.id === selection.id) : undefined;
  let panelTitle: ReactNode = "ภาพรวม";
  let panelIcon: ReactNode = (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-fg-2">
      <ClipboardCheck size={15} aria-hidden="true" />
    </span>
  );
  let panelBody: ReactNode;
  if (selection?.kind === "trigger") {
    panelTitle = "ทำงานเมื่อ…";
    panelIcon = (
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
        <Zap size={15} aria-hidden="true" />
      </span>
    );
    panelBody = <TriggerPanel doc={doc} dispatch={dispatch} problems={problems} recentPosts={recentPosts} postsError={postsError} />;
  } else if (selectedStep) {
    const n = numbers.get(selectedStep.id);
    panelTitle = `ข้อความ #${n}`;
    panelIcon = (
      <span
        className={cx(
          "flex h-7 w-7 items-center justify-center rounded-lg",
          doc.startStepId === selectedStep.id ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-2",
        )}
      >
        <MessageSquareText size={15} aria-hidden="true" />
      </span>
    );
    panelBody = (
      <MessagePanel
        key={selectedStep.id}
        doc={doc}
        step={selectedStep}
        numbers={numbers}
        problem={problems.find((p) => p.blocking && p.target.kind === "step" && p.target.id === selectedStep.id)}
        unreachable={unreachable.has(selectedStep.id)}
        showErrors={showErrors}
        stat={stepStats?.[selectedStep.id]}
        dispatch={dispatch}
        onCreateFrom={onCreateFrom}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );
  } else {
    panelBody = (
      <OverviewPanel
        doc={doc}
        selection={selection}
        problems={problems}
        numbers={numbers}
        serverError={serverError}
        stats={ruleStats}
        dispatch={dispatch}
        onGoTo={goTo}
      />
    );
  }

  const panelVisible = isDesktop ? panelOpen : sheetOpen;
  const deleteTarget = pendingDelete ? doc.steps.find((s) => s.id === pendingDelete) : undefined;

  return (
    <div className="relative flex h-[calc(100dvh-var(--app-topbar-h,0px))] min-h-0 flex-col overflow-clip bg-bg">
      <TopBar
        ruleId={ruleId}
        name={doc.name}
        nameRef={nameRef}
        nameInvalid={showErrors && problems.some((p) => p.key === "name")}
        active={doc.active}
        dirty={dirty}
        pending={pending}
        stats={ruleStats}
        onName={(name) => dispatch({ type: "patch", patch: { name }, key: "name", at: Date.now() })}
        onActive={(active) => dispatch({ type: "patch", patch: { active } })}
        onSave={save}
        onLeave={onLeave}
      />

      {/* มือถือ: แผงด้านล่างอ้างอิงความสูงกับทั้งหน้า (จึงไม่ใส่ relative ตรงนี้) */}
      <div className="flex min-h-0 flex-1 lg:relative">
        <div className="relative min-w-0 flex-1">
          <FlowCanvas
            apiRef={canvasApi}
            doc={doc}
            selection={selection}
            sizes={sizes}
            numbers={numbers}
            stepErrors={stepErrors}
            unreachable={unreachable}
            triggerProblem={triggerProblem}
            stats={stepStats}
            ready={!state.autoPlaced}
            canUndo={state.past.length > 0}
            canRedo={state.future.length > 0}
            canAdd={canAddStep(doc)}
            bottomInset={bottomInset}
            dispatch={dispatch}
            onMeasure={onMeasure}
            onNodeTap={onNodeTap}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onCreate={onCreate}
          />
          {!panelOpen && (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="absolute top-3 right-3 hidden h-10 lg:inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-fg shadow-md hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
            >
              <PanelRightOpen size={18} aria-hidden="true" />
              แผงตั้งค่า
              {blockingCount > 0 && (
                <span className="rounded-full bg-critical px-1.5 text-xs font-semibold text-critical-fg tabular">{blockingCount}</span>
              )}
            </button>
          )}
        </div>

        {/* แผงตั้งค่า: เดสก์ท็อปอยู่ด้านขวา, มือถือเป็นแผ่นเลื่อนขึ้นจากด้านล่าง */}
        <aside
          ref={sheetRef}
          aria-label={typeof panelTitle === "string" ? panelTitle : "แผงตั้งค่า"}
          inert={!panelVisible}
          className={cx(
            // มือถือ: แผ่นเลื่อนขึ้นจากด้านล่าง (ใช้ CSS ล้วน หน้าแรกที่โหลดจึงไม่กระพริบ)
            "absolute inset-x-0 bottom-0 z-30 flex max-h-[min(75dvh,calc(100%-13rem))] flex-col rounded-t-2xl border-t border-line bg-surface shadow-[var(--elev-lg)] transition-transform duration-300 ease-out",
            sheetOpen ? "translate-y-0" : "pointer-events-none translate-y-full",
            // เดสก์ท็อป: แผงด้านขวา
            "lg:pointer-events-auto lg:static lg:z-auto lg:max-h-none lg:w-[360px] lg:shrink-0 lg:translate-y-0 lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none lg:transition-none xl:w-[400px]",
            !panelOpen && "lg:hidden",
          )}
        >
          <div className="lg:hidden">
            <SheetGrip onClose={() => setSheetOpen(false)} />
          </div>
          <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-5 pb-3 lg:h-14 lg:pb-0">
            {panelIcon}
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{panelTitle}</h2>
            {selectedStep && doc.startStepId === selectedStep.id && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">ข้อความแรก</span>
            )}
            <span className="hidden lg:block">
              <IconButton icon={<PanelRightClose />} label="ซ่อนแผงตั้งค่า" size="sm" onClick={() => setPanelOpen(false)} />
            </span>
            <span className="-mr-2 lg:hidden">
              <IconButton icon={<X />} label="ปิดแผงตั้งค่า" size="md" onClick={() => setSheetOpen(false)} />
            </span>
          </div>
          <div ref={panelBodyRef} data-panel-body className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            {panelBody}
          </div>
        </aside>
      </div>

      {/* มือถือ: แถบล่างสำหรับเปิดแผง */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex h-14 shrink-0 items-center gap-3 border-t border-line bg-surface px-4 pb-[env(safe-area-inset-bottom)] text-left lg:hidden"
      >
        {blockingCount > 0 ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-critical-soft text-critical-text">
            <CircleAlert size={17} aria-hidden="true" />
          </span>
        ) : (
          panelIcon ?? (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-fg-2">
              <MessageSquareText size={16} aria-hidden="true" />
            </span>
          )
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{selection && selection.kind !== "edge" ? panelTitle : "ภาพรวมและสิ่งที่ต้องแก้"}</span>
          <span className={cx("block text-xs", blockingCount ? "text-critical-text" : "text-fg-3")}>
            {blockingCount ? `ต้องแก้อีก ${blockingCount} จุดก่อนบันทึก` : dirty || !ruleId ? "ครบแล้ว พร้อมบันทึก" : "บันทึกแล้ว"}
          </span>
        </span>
        <ChevronUp size={18} className="text-fg-3" aria-hidden="true" />
      </button>

      <Dialog
        open={!!deleteTarget}
        onClose={() => setPendingDelete(null)}
        size="sm"
        title={`ลบข้อความ #${deleteTarget ? numbers.get(deleteTarget.id) : ""}?`}
        description="ปุ่มที่เชื่อมมาที่การ์ดนี้จะไม่ได้เชื่อม (ย้อนกลับได้ด้วย Ctrl+Z ก่อนบันทึก)"
        icon={<Trash2 aria-hidden="true" />}
        iconTone="danger"
        hideClose
        footer={
          <>
            <Button variant="secondary" data-autofocus onClick={() => setPendingDelete(null)} className="max-sm:w-full">
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              className="max-sm:w-full"
              onClick={() => {
                if (deleteTarget) deleteNow(deleteTarget.id);
                setPendingDelete(null);
              }}
            >
              ลบการ์ด
            </Button>
          </>
        }
      />

      <Dialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        size="sm"
        title="ออกโดยไม่บันทึก?"
        description="การแก้ไขที่ยังไม่ได้บันทึกจะหายไป"
        hideClose
        footer={
          <>
            <Button variant="secondary" data-autofocus onClick={() => setLeaveOpen(false)} className="max-sm:w-full">
              อยู่ต่อ
            </Button>
            <Button
              variant="destructive"
              className="max-sm:w-full"
              onClick={() => {
                setLeaveOpen(false);
                router.push("/rules");
              }}
            >
              ออกโดยไม่บันทึก
            </Button>
          </>
        }
      />
    </div>
  );
}

/** ที่จับด้านบนของแผงมือถือ: ปัดลงเพื่อปิด */
function SheetGrip({ onClose }: { onClose: () => void }) {
  const start = useRef<number | null>(null);
  return (
    <div
      className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
      onPointerDown={(e) => {
        start.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        if (start.current !== null && e.clientY - start.current > 40) onClose();
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      aria-hidden="true"
    >
      <span className="h-1.5 w-10 rounded-full bg-line-strong" />
    </div>
  );
}
