"use client";

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { LayoutGrid, Maximize, Minus, Plus, Redo2, Undo2, X } from "lucide-react";
import { cx } from "@/components/ui";
import type { CanvasPoint } from "@/lib/flows/types";
import type { StepStats } from "@/lib/stats";
import { boundsOf, clampZoom, edgePath, fitView, toWorld, zoomAt, type View } from "./geometry";
import {
  autoLayout,
  CARD_WIDTH,
  edgeKey,
  edgesOf,
  findFreeSpot,
  INPUT_HANDLE_Y,
  nodeBox,
  spotRightOf,
  targetOf,
  TRIGGER_NODE,
  type BuilderAction,
  type BuilderDoc,
  type EdgeFrom,
  type MeasuredNode,
  type Selection,
  type Sizes,
} from "./model";
import { MessageNode, NODE_TOOLBAR_W, TriggerNode } from "./nodes";

export interface CanvasApi {
  /** ซูมให้เห็นการ์ดทั้งหมด */
  fit: () => void;
  /** เลื่อนแผนผังให้เห็นการ์ดนี้ (ถ้ายังไม่เห็น) */
  focus: (node: string) => void;
  /** ยกเลิกการลากที่ค้างอยู่ — คืน true ถ้ามีการลากให้ยกเลิก */
  cancel: () => boolean;
}

interface Props {
  apiRef: Ref<CanvasApi>;
  doc: BuilderDoc;
  selection: Selection;
  sizes: Sizes;
  numbers: Map<string, number>;
  stepErrors: Map<string, string>;
  unreachable: Set<string>;
  triggerProblem: boolean;
  /** เคยกดบันทึกแล้วไม่ผ่าน → สิ่งที่ต้องแก้เป็นสีแดง */
  showErrors: boolean;
  stats?: Record<string, StepStats>;
  /** การ์ดจัดวางเสร็จแล้ว (พร้อมซูมให้พอดีจอ) */
  ready: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canAdd: boolean;
  /** ความสูงที่แผงด้านล่างบังแผนผังอยู่ (มือถือ) */
  bottomInset: number;
  dispatch: Dispatch<BuilderAction>;
  onMeasure: (id: string, m: MeasuredNode) => void;
  /** แตะการ์ด (ไม่ได้ลาก) */
  onNodeTap: (node: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** สร้างการ์ดใหม่ที่ตำแหน่ง at (from = เชื่อมจากจุดต่อนี้ให้ด้วย) */
  onCreate: (at: CanvasPoint, from?: EdgeFrom) => void;
}

type Gesture =
  | { kind: "pan"; id: number; sx: number; sy: number; v0: View; moved: boolean; tap: Selection | "clear" }
  | { kind: "pinch"; d0: number; mid0: CanvasPoint; v0: View }
  | { kind: "node"; id: number; node: string; sx: number; sy: number; ox: number; oy: number; moved: boolean; key: string }
  | { kind: "link"; id: number; from: EdgeFrom; source: string; sx: number; sy: number; moved: boolean };

interface LiveLink {
  from: EdgeFrom;
  source: string;
  x: number;
  y: number;
  over: string | null;
}

const DRAG_THRESHOLD = 4;

export function FlowCanvas(props: Props) {
  const { doc, selection, sizes, numbers, stepErrors, unreachable, stats, dispatch, bottomInset } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 40, y: 40, zoom: 1 });
  const [animate, setAnimate] = useState(false);
  const [shown, setShown] = useState(false);
  const [link, setLink] = useState<LiveLink | null>(null);
  const [panning, setPanning] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, CanvasPoint>());
  const markerId = useId().replace(/:/g, "");
  const pressedDelete = useRef(false);

  // ค่าล่าสุดสำหรับใช้ใน event handler ที่ผูกไว้ครั้งเดียว
  const latest = useRef({ view, doc, sizes, props });
  useLayoutEffect(() => {
    latest.current = { view, doc, sizes, props };
  });

  const local = (clientX: number, clientY: number): CanvasPoint => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const animateTo = useCallback((next: View) => {
    setAnimate(true);
    setView(next);
    window.setTimeout(() => setAnimate(false), 220);
  }, []);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { doc: d, sizes: s, props: p } = latest.current;
    const ids = [TRIGGER_NODE, ...d.steps.map((x) => x.id)];
    const bounds = boundsOf(ids.map((id) => nodeBox(d, s, id)));
    if (!bounds) return;
    const h = Math.max(200, el.clientHeight - p.bottomInset);
    // เผื่อที่ให้แถบปุ่มลอยด้านบน/ล่าง
    const v = fitView({ ...bounds, y: bounds.y - 28, h: bounds.h + 56 }, el.clientWidth, h, { padding: 40, maxZoom: 1 });
    animateTo(v);
  }, [animateTo]);

  const focusNode = useCallback(
    (node: string) => {
      const el = containerRef.current;
      if (!el) return;
      const { doc: d, sizes: s, view: v, props: p } = latest.current;
      const b = nodeBox(d, s, node);
      const w = el.clientWidth;
      const h = el.clientHeight - p.bottomInset;
      const sx = b.x * v.zoom + v.x;
      const sy = b.y * v.zoom + v.y;
      // เลื่อนน้อยที่สุดเท่าที่จำเป็นให้เห็นการ์ดทั้งใบ (การ์ดสูงมาก: ให้เห็นส่วนหัวก่อน)
      const margin = 24;
      const top = 64;
      // แถบปุ่ม แก้ไข/ทำสำเนา/ลบ เหนือการ์ดข้อความมีขนาดคงที่บนจอ (กว้างกว่าการ์ดตอนซูมออก) → เผื่อที่ให้เห็นครบ
      const bw = Math.max(b.w * v.zoom, node === TRIGGER_NODE ? 0 : NODE_TOOLBAR_W);
      const bh = Math.min(b.h * v.zoom, h - top - margin);
      let dx = 0;
      let dy = 0;
      if (sx < margin) dx = margin - sx;
      else if (sx + bw > w - margin) dx = Math.max(margin - sx, w - margin - (sx + bw));
      if (sy < top) dy = top - sy;
      else if (sy + bh > h - margin) dy = Math.max(top - sy, h - margin - (sy + bh));
      if (!dx && !dy) return;
      animateTo({ ...v, x: v.x + dx, y: v.y + dy });
    },
    [animateTo],
  );

  const cancel = useCallback(() => {
    const g = gesture.current;
    if (!g) return false;
    gesture.current = null;
    setPanning(false);
    if (g.kind === "link") setLink(null);
    if (g.kind === "node" && g.moved) latest.current.props.dispatch({ type: "undo" });
    if (g.kind === "pan" && g.moved) setView(g.v0);
    return true;
  }, []);

  useImperativeHandle(props.apiRef, () => ({ fit, focus: focusNode, cancel }), [fit, focusNode, cancel]);

  // ซูมให้พอดีจอครั้งแรก เมื่อวัดขนาดการ์ดครบแล้ว
  const allMeasured = !!sizes[TRIGGER_NODE] && doc.steps.every((s) => sizes[s.id]);
  useEffect(() => {
    if (shown || !props.ready || !allMeasured) return;
    const el = containerRef.current;
    if (!el || !el.clientWidth) return;
    const ids = [TRIGGER_NODE, ...doc.steps.map((x) => x.id)];
    const bounds = boundsOf(ids.map((id) => nodeBox(doc, sizes, id)));
    if (bounds) {
      const v = fitView({ ...bounds, y: bounds.y - 28, h: bounds.h + 56 }, el.clientWidth, el.clientHeight, { padding: 40, maxZoom: 1 });
      // จอเล็ก (มือถือ): ถ้าย่อจนอ่านไม่ออก ให้เริ่มที่ 60% โดยเห็นการ์ด "เมื่อ…" ก่อน แล้วค่อยเลื่อนดูส่วนที่เหลือ
      const MIN_READABLE = 0.6;
      if (v.zoom < MIN_READABLE) setView({ zoom: MIN_READABLE, x: 16 - bounds.x * MIN_READABLE, y: 72 - bounds.y * MIN_READABLE });
      else setView(v);
    }
    setShown(true);
  }, [shown, props.ready, allMeasured, doc, sizes]);

  // ล้อเมาส์/ทัชแพด: เลื่อนแผนผัง, Ctrl/⌘ + ล้อ หรือถ่างนิ้วบนทัชแพด = ซูม
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-overlay]")) return;
      e.preventDefault();
      const p = local(e.clientX, e.clientY);
      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.deltaMode === 1) {
        dx *= 16;
        dy *= 16;
      }
      if (e.ctrlKey || e.metaKey) {
        const step = Math.abs(dy) >= 40 ? Math.sign(dy) * 18 : dy;
        setView((v) => zoomAt(v, v.zoom * Math.exp(-step * 0.008), p.x, p.y));
      } else {
        if (e.shiftKey && !dx) [dx, dy] = [dy, 0];
        setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /** การ์ดที่อยู่ใต้นิ้ว/เมาส์ (null = พื้นที่ว่าง, "overlay" = แถบปุ่มลอย) */
  function nodeUnder(clientX: number, clientY: number): string | null | "overlay" | "outside" {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!el || !containerRef.current?.contains(el)) return "outside";
    if (el.closest("[data-overlay]")) return "overlay";
    return el.closest<HTMLElement>("[data-node]")?.dataset.node ?? null;
  }

  function canDrop(from: EdgeFrom, node: string | null | "overlay" | "outside"): node is string {
    if (!node || node === "overlay" || node === "outside" || node === TRIGGER_NODE) return false;
    return from.kind === "trigger" || node !== from.stepId;
  }

  function startPinch() {
    const [a, b] = [...pointers.current.values()];
    const g = gesture.current;
    if (g?.kind === "link") setLink(null);
    gesture.current = {
      kind: "pinch",
      d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      v0: latest.current.view,
    };
    setPanning(true);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-overlay]") || target.closest("[data-no-drag]")) return;
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    const p = local(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, p);
    containerRef.current!.setPointerCapture(e.pointerId);
    setAnimate(false);
    if (pointers.current.size === 2) {
      startPinch();
      return;
    }
    if (pointers.current.size > 2) return;

    const handleEl = target.closest<HTMLElement>("[data-handle]");
    const nodeEl = target.closest<HTMLElement>("[data-node]");
    if (e.button === 0 && handleEl && nodeEl) {
      e.preventDefault();
      const node = nodeEl.dataset.node!;
      const handle = handleEl.dataset.handle!;
      const from: EdgeFrom = node === TRIGGER_NODE ? { kind: "trigger" } : { kind: "button", stepId: node, buttonId: handle };
      gesture.current = { kind: "link", id: e.pointerId, from, source: node, sx: p.x, sy: p.y, moved: false };
      return;
    }
    if (e.button === 0 && nodeEl) {
      const node = nodeEl.dataset.node!;
      const pos = node === TRIGGER_NODE ? doc.triggerPos : (doc.positions[node] ?? { x: 0, y: 0 });
      gesture.current = { kind: "node", id: e.pointerId, node, sx: p.x, sy: p.y, ox: pos.x, oy: pos.y, moved: false, key: `drag:${node}:${e.timeStamp}` };
      return;
    }
    const edgeEl = target.closest<SVGElement>("[data-edge]");
    const edge = edgeEl ? edgesOf(doc).find((x) => x.key === edgeEl.dataset.edge) : undefined;
    gesture.current = {
      kind: "pan",
      id: e.pointerId,
      sx: p.x,
      sy: p.y,
      v0: view,
      moved: false,
      tap: edge ? { kind: "edge", from: edge.from } : "clear",
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    const p = local(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, p);

    if (g.kind === "pinch") {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts;
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoom = clampZoom(g.v0.zoom * (d / g.d0));
      const wx = (g.mid0.x - g.v0.x) / g.v0.zoom;
      const wy = (g.mid0.y - g.v0.y) / g.v0.zoom;
      setView({ zoom, x: mid.x - wx * zoom, y: mid.y - wy * zoom });
      return;
    }
    if (e.pointerId !== g.id) return;
    const dx = p.x - g.sx;
    const dy = p.y - g.sy;
    if (!g.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      g.moved = true;
      if (g.kind === "pan") setPanning(true);
    }
    if (!g.moved) return;

    if (g.kind === "pan") {
      setView({ ...g.v0, x: g.v0.x + dx, y: g.v0.y + dy });
    } else if (g.kind === "node") {
      const z = latest.current.view.zoom;
      dispatch({ type: "move", node: g.node, to: { x: g.ox + dx / z, y: g.oy + dy / z }, key: g.key, at: e.timeStamp });
    } else if (g.kind === "link") {
      const w = toWorld(latest.current.view, p.x, p.y);
      const over = nodeUnder(e.clientX, e.clientY);
      setLink({ from: g.from, source: g.source, x: w.x, y: w.y, over: canDrop(g.from, over) ? over : null });
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      if (pointers.current.size < 2) {
        gesture.current = null;
        setPanning(false);
      }
      return;
    }
    if (e.pointerId !== g.id) return;
    gesture.current = null;
    setPanning(false);

    if (g.kind === "pan") {
      if (!g.moved) dispatch({ type: "select", selection: g.tap === "clear" ? null : g.tap });
    } else if (g.kind === "node") {
      if (!g.moved) props.onNodeTap(g.node);
    } else if (g.kind === "link") {
      setLink(null);
      const { doc: d, sizes: s, view: v } = latest.current;
      if (g.moved) {
        const over = nodeUnder(e.clientX, e.clientY);
        if (canDrop(g.from, over)) {
          dispatch({ type: "connect", from: g.from, target: over });
          dispatch({ type: "select", selection: { kind: "edge", from: g.from } });
        } else if (over === null) {
          // ปล่อยบนพื้นที่ว่าง → สร้างการ์ดใหม่ตรงนั้น (จุดรับเส้นอยู่ใต้นิ้วพอดี)
          const p = local(e.clientX, e.clientY);
          const w = toWorld(v, p.x, p.y);
          props.onCreate({ x: w.x + 6, y: w.y - INPUT_HANDLE_Y }, g.from);
        }
      } else if (targetOf(d, g.from)) {
        dispatch({ type: "select", selection: { kind: "edge", from: g.from } });
      } else {
        props.onCreate(spotRightOf(d, s, g.from), g.from);
      }
    }
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch" && pointers.current.size >= 2) return;
    gesture.current = null;
    setPanning(false);
    if (g.kind === "link") setLink(null);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    // เลือกการ์ดด้วยคีย์บอร์ด (Tab ไปที่การ์ดแล้วกด Enter)
    const node = (e.target as HTMLElement).dataset?.node;
    if (node && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      props.onNodeTap(node);
    }
  }

  function zoomBy(factor: number) {
    const el = containerRef.current!;
    animateTo(zoomAt(view, view.zoom * factor, el.clientWidth / 2, (el.clientHeight - bottomInset) / 2));
  }

  function resetZoom() {
    const el = containerRef.current!;
    animateTo(zoomAt(view, 1, el.clientWidth / 2, (el.clientHeight - bottomInset) / 2));
  }

  function addAtCenter() {
    const el = containerRef.current!;
    const c = toWorld(view, el.clientWidth / 2, Math.min(el.clientHeight - bottomInset, el.clientHeight) / 2);
    props.onCreate(findFreeSpot(doc, sizes, { x: c.x - CARD_WIDTH / 2, y: c.y - 80 }));
  }

  function arrange() {
    dispatch({ type: "layout", layout: autoLayout(doc, sizes), history: true });
    requestAnimationFrame(() => requestAnimationFrame(fit));
  }

  /* ------------------------------------------------------------ เส้นเชื่อม */

  const anchorOut = (node: string, handle: string): CanvasPoint | null => {
    const m = sizes[node];
    if (!m || m.handles[handle] === undefined) return null;
    const pos = node === TRIGGER_NODE ? doc.triggerPos : doc.positions[node];
    if (!pos) return null;
    return { x: pos.x + m.w, y: pos.y + m.handles[handle] };
  };
  const anchorIn = (node: string): CanvasPoint | null => {
    const pos = doc.positions[node];
    return pos ? { x: pos.x - 7, y: pos.y + INPUT_HANDLE_Y } : null;
  };

  const selectedEdgeKey = selection?.kind === "edge" ? edgeKey(selection.from) : null;
  const edges = edgesOf(doc).flatMap((e) => {
    const a = anchorOut(e.source, e.handle);
    const b = anchorIn(e.target);
    if (!a || !b) return [];
    // ระหว่างลากเส้นใหม่จากจุดต่อเดิม ซ่อนเส้นเก่าไว้
    if (link && edgeKey(link.from) === e.key) return [];
    return [{ ...e, ...edgePath(a.x, a.y, b.x, b.y) }];
  });
  const selectedEdge = edges.find((e) => e.key === selectedEdgeKey);

  let livePath: string | null = null;
  if (link) {
    const handle = link.from.kind === "trigger" ? "out" : link.from.buttonId;
    const a = anchorOut(link.source, handle);
    const b = link.over ? anchorIn(link.over) : { x: link.x, y: link.y };
    if (a && b) livePath = edgePath(a.x, a.y, b.x, b.y).d;
  }

  // คงอ้างอิงเดิมไว้ การ์ดจะได้ไม่ render ใหม่ทุกครั้งที่เลื่อน/ซูม
  const stepIds = useMemo(() => new Set(doc.steps.map((s) => s.id)), [doc.steps]);
  const selectedStep = selection?.kind === "step" ? selection.id : null;
  const dotSize = 20 * view.zoom;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="แผนผังข้อความ — ลากพื้นที่ว่างเพื่อเลื่อน, ลากจุดที่ปุ่มเพื่อเชื่อมข้อความ"
      className={cx(
        "relative h-full w-full touch-none overflow-clip bg-bg outline-none select-none",
        panning ? "cursor-grabbing" : link ? "cursor-crosshair" : "cursor-default",
      )}
      style={{
        backgroundImage: "radial-gradient(circle, color-mix(in oklab, var(--fg-3) 32%, transparent) 1px, transparent 1.4px)",
        backgroundSize: `${dotSize}px ${dotSize}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
    >
      <div
        className={cx("absolute top-0 left-0 origin-top-left", !shown && "opacity-0", animate && "transition-transform duration-200 ease-out")}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden="true">
          <defs>
            <marker id={`${markerId}-a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: "color-mix(in oklab, var(--accent) 70%, var(--fg-3))" }} />
            </marker>
            <marker id={`${markerId}-s`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: "var(--accent)" }} />
            </marker>
          </defs>
          {edges.map((e) => {
            const active = e.key === selectedEdgeKey;
            return (
              <g key={e.key} className="group">
                <path
                  d={e.d}
                  fill="none"
                  strokeWidth={active ? 3 : 2}
                  markerEnd={`url(#${markerId}-${active ? "s" : "a"})`}
                  style={{ stroke: active ? "var(--accent)" : "color-mix(in oklab, var(--accent) 70%, var(--fg-3))" }}
                  className="transition-[stroke-width] group-hover:[stroke-width:3]"
                />
                <path data-edge={e.key} d={e.d} fill="none" stroke="transparent" strokeWidth={16} className="cursor-pointer" style={{ pointerEvents: "stroke" }} />
              </g>
            );
          })}
          {livePath && (
            <path
              d={livePath}
              fill="none"
              strokeWidth={2.5}
              strokeDasharray="6 5"
              markerEnd={`url(#${markerId}-s)`}
              style={{ stroke: "var(--accent)" }}
            />
          )}
        </svg>

        <TriggerNode
          doc={doc}
          selected={selection?.kind === "trigger"}
          problem={props.triggerProblem}
          showErrors={props.showErrors}
          onMeasure={props.onMeasure}
        />
        {doc.steps.map((step) => {
          const pos = doc.positions[step.id] ?? { x: 0, y: 0 };
          return (
            <MessageNode
              key={step.id}
              step={step}
              number={numbers.get(step.id) ?? 0}
              isStart={doc.startStepId === step.id}
              x={pos.x}
              y={pos.y}
              selected={selectedStep === step.id}
              dropTarget={link?.over === step.id}
              linking={!!link && (link.from.kind === "trigger" || link.from.stepId !== step.id)}
              unreachable={unreachable.has(step.id)}
              error={stepErrors.get(step.id)}
              showErrors={props.showErrors}
              stat={stats?.[step.id]}
              stepIds={stepIds}
              zoom={selectedStep === step.id ? view.zoom : 1}
              onMeasure={props.onMeasure}
              onEdit={props.onEdit}
              onDuplicate={props.onDuplicate}
              onDelete={props.onDelete}
            />
          );
        })}

        {selectedEdge && !link && (
          <button
            type="button"
            data-no-drag
            onPointerDown={() => {
              pressedDelete.current = true;
            }}
            onClick={(e) => {
              // กันคลิกที่เกิดจากการแตะเลือกเส้น (ปุ่มนี้โผล่ใต้นิ้วพอดี) — ต้องกดที่ปุ่มนี้จริงๆ หรือกดด้วยคีย์บอร์ด
              if (!pressedDelete.current && e.detail !== 0) return;
              pressedDelete.current = false;
              dispatch({ type: "disconnect", from: selectedEdge.from });
            }}
            aria-label="ลบเส้นนี้"
            title="ลบเส้นนี้ (Delete)"
            className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-critical-text shadow-md hover:bg-critical-soft focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
            style={{ left: selectedEdge.mid.x, top: selectedEdge.mid.y, transform: `translate(-50%, -50%) scale(${1 / view.zoom})` }}
          >
            <X size={16} strokeWidth={2.25} aria-hidden="true" />
          </button>
        )}
      </div>

      {link && (
        <div
          role="status"
          className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-fg px-4 py-2 text-xs font-medium whitespace-nowrap text-bg shadow-lg max-sm:top-16"
        >
          {link.over ? "ปล่อยเพื่อเชื่อมกับการ์ดนี้" : "ปล่อยบนการ์ดเพื่อเชื่อม · ปล่อยที่ว่างเพื่อสร้างข้อความใหม่"}
        </div>
      )}

      {/* ปุ่มเพิ่มข้อความ (ลอยมุมซ้ายบน) */}
      <div data-overlay className={cx("absolute top-3 left-3 flex items-center gap-2", bottomInset > 0 && "hidden")}>
        <button
          type="button"
          onClick={addAtCenter}
          disabled={!props.canAdd}
          title={props.canAdd ? "เพิ่มการ์ดข้อความใหม่" : "ใส่ข้อความได้สูงสุด 20 ข้อความต่อกฎ"}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent pr-4 pl-3 text-sm font-medium text-accent-fg shadow-md hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none disabled:opacity-60"
        >
          <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
          เพิ่มข้อความ
        </button>
      </div>

      {/* ซูม / พอดีจอ / จัดเรียง / ย้อนกลับ */}
      <div
        data-overlay
        className={cx(
          "absolute bottom-3 left-3 flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-md",
          // มือถือ: ซ่อนแถบปุ่มตอนแผงด้านล่างเปิด (พื้นที่แผนผังเหลือน้อย)
          bottomInset > 0 && "hidden",
        )}
      >
        <ControlButton label="ย้อนกลับ (Ctrl+Z)" onClick={() => dispatch({ type: "undo" })} disabled={!props.canUndo}>
          <Undo2 size={17} aria-hidden="true" />
        </ControlButton>
        <ControlButton label="ทำซ้ำ (Ctrl+Shift+Z)" onClick={() => dispatch({ type: "redo" })} disabled={!props.canRedo}>
          <Redo2 size={17} aria-hidden="true" />
        </ControlButton>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        <ControlButton label="ซูมออก" onClick={() => zoomBy(1 / 1.2)} disabled={view.zoom <= 0.4 + 1e-6}>
          <Minus size={17} aria-hidden="true" />
        </ControlButton>
        <button
          type="button"
          onClick={resetZoom}
          title="กลับไปขนาด 100%"
          className="h-9 min-w-[3.25rem] rounded-lg px-1 text-xs font-medium text-fg-2 tabular hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
        >
          {Math.round(view.zoom * 100)}%
        </button>
        <ControlButton label="ซูมเข้า" onClick={() => zoomBy(1.2)} disabled={view.zoom >= 1.6 - 1e-6}>
          <Plus size={17} aria-hidden="true" />
        </ControlButton>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        <ControlButton label="พอดีจอ" onClick={fit}>
          <Maximize size={16} aria-hidden="true" />
        </ControlButton>
        <ControlButton label="จัดเรียงการ์ดอัตโนมัติ" onClick={arrange}>
          <LayoutGrid size={16} aria-hidden="true" />
        </ControlButton>
      </div>
    </div>
  );
}

function ControlButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-2 pointer-coarse:h-10 pointer-coarse:w-10 hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}
