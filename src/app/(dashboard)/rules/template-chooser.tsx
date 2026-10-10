"use client";

import Link, { useLinkStatus } from "next/link";
import { Fragment, useState, type ReactNode } from "react";
import {
  ChevronRight,
  Link2,
  MessageCircle,
  MessagesSquare,
  MousePointerClick,
  Plus,
  Send,
  SquareDashed,
  Zap,
} from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Badge, Button, cx, Spinner, type ButtonSize } from "@/components/ui";

/*
 * เลือกแบบเริ่มต้นตอนสร้างกฎใหม่ (ลิงก์ไป /rules/new?template=...)
 * - NewRuleButton: ปุ่ม "สร้างกฎใหม่" ที่เปิดหน้าต่างให้เลือกแบบ
 * - TemplateOptions: รายการแบบเริ่มต้น (ใช้ในหน้าต่าง และในหน้าว่างตอนยังไม่มีกฎ)
 */

interface TemplateOption {
  id: "comment" | "dm" | "blank";
  title: string;
  description: string;
  icon: ReactNode;
  /** ไอคอนเล็กๆ เรียงเป็นลำดับการทำงาน (ภาพประกอบเท่านั้น) */
  flow: ReactNode[];
  recommended?: boolean;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "comment",
    title: "คอมเมนต์ → ส่ง DM พร้อมปุ่ม",
    description: "ตอบใต้คอมเมนต์ให้ แล้วส่ง DM ที่มีปุ่มให้ลูกค้ากดรับรายละเอียด",
    icon: <MessageCircle />,
    flow: [<MessageCircle key="c" />, <Send key="s" />, <MousePointerClick key="b" />, <Link2 key="l" />],
    recommended: true,
  },
  {
    id: "dm",
    title: "ตอบแชทตาม keyword",
    description: "ลูกค้าทักแชทด้วยคำที่ตั้งไว้ เช่น “ราคา” ระบบตอบกลับพร้อมลิงก์ทันที",
    icon: <MessagesSquare />,
    flow: [<MessagesSquare key="m" />, <Send key="s" />, <Link2 key="l" />],
  },
  {
    id: "blank",
    title: "เริ่มจากว่าง",
    description: "เริ่มจากการ์ดเปล่าใบเดียว แล้วสร้างข้อความและปุ่มเองทั้งหมด",
    icon: <Plus />,
    flow: [<Zap key="z" />, <SquareDashed key="d" />],
  },
];

const hrefOf = (id: TemplateOption["id"]) => `/rules/new?template=${id}`;

/** ภาพลำดับการทำงานย่อส่วน: [ไอคอน]—[ไอคอน]—[ไอคอน] */
function FlowHint({ flow, recommended, className }: { flow: ReactNode[]; recommended?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cx("flex items-center", className)}>
      {flow.map((icon, i) => {
        const last = i === flow.length - 1;
        const dashed = last && flow.length === 2;
        return (
          <Fragment key={i}>
            {i > 0 && <span className={cx("h-px w-3 sm:w-4", dashed ? "border-t border-dashed border-line-strong" : "bg-line-strong")} />}
            <span
              className={cx(
                "flex size-6 items-center justify-center rounded-md border [&_svg]:size-3.5",
                i === 0
                  ? recommended
                    ? "border-transparent bg-accent text-accent-fg"
                    : "border-accent/25 bg-accent-soft text-accent"
                  : dashed
                    ? "border-dashed border-line-strong bg-surface text-fg-3"
                    : "border-line bg-surface text-fg-2",
              )}
            >
              {icon}
            </span>
          </Fragment>
        );
      })}
    </span>
  );
}

/** ลูกศรท้ายการ์ด — เปลี่ยนเป็นวงหมุนระหว่างรอเปิดหน้าสร้างกฎ */
function GoIndicator() {
  const { pending } = useLinkStatus();
  return (
    <span className="flex size-5 shrink-0 items-center justify-center text-fg-3 transition group-hover:translate-x-0.5 group-hover:text-accent">
      {pending ? <Spinner label="กำลังเปิด" /> : <ChevronRight className="size-[18px]" aria-hidden />}
    </span>
  );
}

const optionBase =
  "group relative flex rounded-xl border bg-surface text-left shadow-xs transition-[border-color,background-color,box-shadow] hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 focus-visible:border-accent";

/**
 * รายการแบบเริ่มต้น
 * layout="list": แถวเรียงลงมา (ในหน้าต่าง) · layout="grid": การ์ด 3 ใบเรียงกัน (ในหน้าว่าง)
 */
export function TemplateOptions({ layout = "list", className }: { layout?: "list" | "grid"; className?: string }) {
  if (layout === "grid") {
    return (
      <ul className={cx("grid gap-3 lg:grid-cols-3", className)}>
        {TEMPLATES.map((t) => (
          <li key={t.id} className="flex">
            <Link
              href={hrefOf(t.id)}
              className={cx(
                optionBase,
                "w-full flex-col overflow-hidden",
                t.recommended ? "border-accent/40 hover:border-accent" : "border-line hover:border-line-strong",
              )}
            >
              <span
                className={cx(
                  "flex h-[72px] items-center justify-center border-b",
                  t.recommended ? "border-accent/20 bg-accent-soft/60" : "border-line bg-surface-2/60",
                )}
              >
                <FlowHint flow={t.flow} recommended={t.recommended} />
              </span>
              <span className="flex flex-1 items-start gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] leading-6 font-semibold text-fg">{t.title}</span>
                    {t.recommended && <Badge tone="accent">แนะนำ</Badge>}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-fg-2">{t.description}</span>
                </span>
                <span className="mt-0.5">
                  <GoIndicator />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className={cx("space-y-2.5", className)}>
      {TEMPLATES.map((t) => (
        <li key={t.id}>
          <Link
            href={hrefOf(t.id)}
            className={cx(
              optionBase,
              "items-center gap-3.5 p-3.5 sm:gap-4 sm:p-4",
              t.recommended
                ? "border-accent/40 bg-accent-soft/30 hover:border-accent hover:bg-accent-soft/50"
                : "border-line hover:border-line-strong hover:bg-surface-2/50",
            )}
          >
            <span
              className={cx(
                "flex size-10 shrink-0 items-center justify-center self-start rounded-lg [&_svg]:size-5",
                t.recommended ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-2",
              )}
            >
              {t.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[15px] leading-6 font-semibold text-fg">{t.title}</span>
                {t.recommended && <Badge tone="accent">แนะนำ</Badge>}
              </span>
              <span className="mt-0.5 block text-[13px] leading-5 text-fg-2">{t.description}</span>
              <FlowHint flow={t.flow} recommended={t.recommended} className="mt-2.5" />
            </span>
            <GoIndicator />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** ปุ่ม "สร้างกฎใหม่" → เปิดหน้าต่างเลือกแบบเริ่มต้น */
export function NewRuleButton({
  children = "สร้างกฎใหม่",
  size = "md",
  block,
  className,
}: {
  children?: ReactNode;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<Plus />} size={size} block={block} className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {children}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="สร้างกฎใหม่"
        description="เลือกแบบที่ใกล้เคียงที่สุด แล้วแก้ข้อความ ปุ่ม และการ์ดได้เองทุกอย่าง"
        icon={<Zap aria-hidden />}
        iconTone="accent"
      >
        <TemplateOptions />
      </Dialog>
    </>
  );
}
