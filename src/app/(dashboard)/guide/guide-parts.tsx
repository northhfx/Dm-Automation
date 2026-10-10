import type { ReactNode } from "react";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";
import { Badge, buttonStyle, cx } from "@/components/ui";

/*
 * ชิ้นส่วนของหน้าคู่มือตั้งค่า (ไม่มี hook — ใช้ใน Server Component ได้)
 * ขั้นที่เสร็จแล้วจะพับไว้ (ใช้ <details> ของเบราว์เซอร์ กดเปิดดูใหม่ได้) ขั้นที่ยังไม่เสร็จเปิดไว้เสมอ
 */

export type StepState = "done" | "current" | "todo" | "optional";

/** วงกลมสถานะของขั้น: เสร็จ = เครื่องหมายถูก, ขั้นต่อไป = ตัวเลขพื้นสีหลัก, ยังไม่ถึง = ตัวเลขขอบเทา */
export function StepDot({ n, state, size = "md" }: { n: number; state: StepState; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full font-semibold tabular",
        size === "md" ? "size-9 text-sm [&_svg]:size-[18px]" : "size-6 text-xs [&_svg]:size-3.5",
        state === "done" && "bg-good-soft text-good-text",
        state === "current" && "bg-accent text-accent-fg shadow-xs",
        state === "todo" && "border border-line-strong bg-surface text-fg-2",
        state === "optional" && "border border-dashed border-line-strong bg-surface text-fg-3",
      )}
    >
      {state === "done" ? <Check strokeWidth={2.75} /> : n}
    </span>
  );
}

/** การ์ดของแต่ละขั้น */
export function StepCard({
  n,
  state,
  title,
  summary,
  children,
}: {
  n: number;
  state: StepState;
  title: string;
  /** บรรทัดใต้ชื่อ: ยังไม่เสร็จ = ขั้นนี้ทำอะไร, เสร็จแล้ว = สรุปผล */
  summary?: ReactNode;
  children: ReactNode;
}) {
  const current = state === "current";
  return (
    <li id={`step-${n}`} className="scroll-mt-[calc(var(--app-topbar-h)+16px)] lg:scroll-mt-10">
      <details
        open={state !== "done"}
        className={cx(
          "group rounded-xl border bg-surface shadow-xs transition-shadow",
          current ? "border-accent/50 ring-4 ring-accent/10" : "border-line",
        )}
      >
        <summary className="flex list-none items-start gap-4 rounded-xl px-4 py-4 transition-colors group-open:rounded-b-none hover:bg-surface-2/50 sm:px-5 [&::-webkit-details-marker]:hidden">
          <StepDot n={n} state={state} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs font-medium text-fg-3">ขั้นที่ {n}</span>
              {state === "done" && (
                <Badge tone="good" icon={<Check strokeWidth={2.5} />}>
                  เสร็จแล้ว
                </Badge>
              )}
              {current && <Badge tone="accent">ขั้นต่อไป</Badge>}
              {state === "optional" && <Badge tone="neutral">ทำเมื่อพร้อม</Badge>}
            </div>
            <h2 className="mt-0.5 text-base leading-6 font-semibold text-fg">{title}</h2>
            {summary && <p className="mt-0.5 text-sm leading-6 break-words text-fg-2">{summary}</p>}
          </div>
          <ChevronDown className="mt-1.5 size-5 shrink-0 text-fg-3 transition-transform duration-200 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-5 border-t border-line px-4 pt-5 pb-6 text-sm leading-7 text-fg sm:pr-6 sm:pl-[72px]">{children}</div>
      </details>
    </li>
  );
}

/** รายการขั้นย่อยแบบมีเลข — start = เลขเริ่ม (กรณีต่อจากรายการก่อนหน้า) */
export function SubSteps({ children, start = 1 }: { children: ReactNode; start?: number }) {
  return (
    <ol start={start} className="space-y-4">
      {children}
    </ol>
  );
}

export function SubStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li value={n} className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-fg-2 tabular ring-1 ring-line ring-inset"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-3">{children}</div>
    </li>
  );
}

/** ลิงก์ไปเว็บภายนอก (เปิดแท็บใหม่) ในประโยค */
export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium break-words text-accent underline-offset-2 hover:underline">
      {children}
      <ArrowUpRight className="ml-0.5 inline size-3.5 align-[-2px]" aria-hidden />
      <span className="sr-only"> (เปิดแท็บใหม่)</span>
    </a>
  );
}

/** ปุ่มเปิดเว็บภายนอก (เปิดแท็บใหม่) */
export function ExtButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cx(buttonStyle("secondary"), "max-sm:w-full")}>
      {children}
      <ArrowUpRight aria-hidden />
      <span className="sr-only">(เปิดแท็บใหม่)</span>
    </a>
  );
}

/** ชื่อปุ่ม/เมนูบนเว็บ Meta ที่ต้องกด */
export function B({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-fg">{children}</b>;
}

/** ชื่อ field / permission แบบโค้ด */
export function CodeChips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((f) => (
        <code key={f} className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs leading-5 text-fg">
          {f}
        </code>
      ))}
    </span>
  );
}

/** กรอบรอบฟอร์มที่ต้องกรอกในขั้นนั้น */
export function FormPanel({ id, title, description, children }: { id?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-[calc(var(--app-topbar-h)+16px)] rounded-xl border border-line bg-surface-2/40 p-4 sm:p-5 lg:scroll-mt-10">
      <p className="text-sm leading-6 font-semibold text-fg">{title}</p>
      {description && <p className="text-xs leading-5 text-fg-3">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
