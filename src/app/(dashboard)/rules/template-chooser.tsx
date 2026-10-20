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
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/core";
import { rulesMessages } from "@/lib/i18n/messages/rules";

/*
 * เลือกแบบเริ่มต้นตอนสร้างกฎใหม่ (ลิงก์ไป /rules/new?template=...)
 * - NewRuleButton: ปุ่ม "สร้างกฎใหม่" ที่เปิดหน้าต่างให้เลือกแบบ
 * - TemplateOptions: รายการแบบเริ่มต้น (ใช้ในหน้าต่าง และในหน้าว่างตอนยังไม่มีกฎ)
 */

type RulesKey = MessageKey<typeof rulesMessages>;

interface FlowPart {
  icon: ReactNode;
  /** ชื่อสั้นใต้ไอคอน (แสดงเฉพาะแบบการ์ดใหญ่) */
  label: RulesKey;
  /** กรอบเส้นประ = ยังว่าง ให้สร้างเอง */
  empty?: boolean;
}

interface TemplateOption {
  id: "comment" | "dm" | "blank";
  title: RulesKey;
  description: RulesKey;
  icon: ReactNode;
  /** ลำดับการทำงานย่อส่วน (ภาพประกอบเท่านั้น) */
  flow: FlowPart[];
  recommended?: boolean;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "comment",
    title: "templateCommentTitle",
    description: "templateCommentBody",
    icon: <MessageCircle />,
    flow: [
      { icon: <MessageCircle />, label: "flowComment" },
      { icon: <Send />, label: "flowSendDm" },
      { icon: <MousePointerClick />, label: "flowTapButton" },
      { icon: <Link2 />, label: "flowLink" },
    ],
    recommended: true,
  },
  {
    id: "dm",
    title: "templateDmTitle",
    description: "templateDmBody",
    icon: <MessagesSquare />,
    flow: [
      { icon: <MessagesSquare />, label: "flowChat" },
      { icon: <Send />, label: "flowReply" },
      { icon: <Link2 />, label: "flowLink" },
    ],
  },
  {
    id: "blank",
    title: "templateBlankTitle",
    description: "templateBlankBody",
    icon: <Plus />,
    flow: [
      { icon: <Zap />, label: "flowTrigger" },
      { icon: <SquareDashed />, label: "flowEmptyCard", empty: true },
    ],
  },
];

/** folderId = สร้างจากในโฟลเดอร์ → กฎใหม่อยู่ในโฟลเดอร์นั้น */
const hrefOf = (id: TemplateOption["id"], folderId?: number) => `/rules/new?template=${id}${folderId ? `&folder=${folderId}` : ""}`;

/**
 * ภาพลำดับการทำงานย่อส่วน: [ไอคอน]—[ไอคอน]—[ไอคอน]
 * size="sm" ในรายการ · size="lg" ในการ์ดใหญ่ (มีชื่อใต้ไอคอน)
 */
function FlowHint({
  flow,
  recommended,
  size = "sm",
  className,
}: {
  flow: FlowPart[];
  recommended?: boolean;
  size?: "sm" | "lg";
  className?: string;
}) {
  const t = useT(rulesMessages);
  const lg = size === "lg";
  return (
    <span aria-hidden className={cx("flex items-start", className)}>
      {flow.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span
              className={cx(
                "shrink-0",
                lg ? "mt-[15.5px] w-5" : "mt-[11.5px] w-3 sm:w-4",
                part.empty ? "border-t border-dashed border-line-strong" : "h-px bg-line-strong",
              )}
            />
          )}
          <span className="flex flex-col items-center gap-1">
            <span
              className={cx(
                "flex items-center justify-center border",
                lg ? "size-8 rounded-lg [&_svg]:size-4" : "size-6 rounded-md [&_svg]:size-3.5",
                i === 0
                  ? recommended
                    ? "border-transparent bg-accent text-accent-fg shadow-xs"
                    : "border-accent/25 bg-accent-soft text-accent"
                  : part.empty
                    ? "border-dashed border-line-strong bg-surface text-fg-3"
                    : "border-line bg-surface text-fg-2 shadow-xs",
              )}
            >
              {part.icon}
            </span>
            {lg && <span className="text-[11px] leading-4 whitespace-nowrap text-fg-3">{t(part.label)}</span>}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/** ลูกศรท้ายการ์ด — เปลี่ยนเป็นวงหมุนระหว่างรอเปิดหน้าสร้างกฎ */
function GoIndicator() {
  const t = useT(rulesMessages);
  const { pending } = useLinkStatus();
  return (
    <span className="flex size-5 shrink-0 items-center justify-center text-fg-3 transition group-hover:translate-x-0.5 group-hover:text-accent">
      {pending ? <Spinner label={t("opening")} /> : <ChevronRight className="size-[18px]" aria-hidden />}
    </span>
  );
}

const optionBase =
  "group relative flex rounded-xl border bg-surface text-left shadow-xs transition-[border-color,background-color,box-shadow] hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 focus-visible:border-accent";

/**
 * รายการแบบเริ่มต้น
 * layout="list": แถวเรียงลงมา (ในหน้าต่าง) · layout="grid": การ์ด 3 ใบเรียงกัน (ในหน้าว่าง)
 */
export function TemplateOptions({
  layout = "list",
  folderId,
  className,
}: {
  layout?: "list" | "grid";
  folderId?: number;
  className?: string;
}) {
  const t = useT(rulesMessages);
  if (layout === "grid") {
    return (
      <ul className={cx("grid gap-3 lg:grid-cols-3", className)}>
        {TEMPLATES.map((tpl) => (
          <li key={tpl.id} className="flex">
            <Link
              href={hrefOf(tpl.id, folderId)}
              className={cx(
                optionBase,
                "w-full flex-col overflow-hidden",
                tpl.recommended ? "border-accent/40 hover:border-accent" : "border-line hover:border-line-strong",
              )}
            >
              <span
                className={cx(
                  "flex h-24 items-center justify-center border-b px-4",
                  tpl.recommended ? "border-accent/20 bg-accent-soft/60" : "border-line bg-surface-2/60",
                )}
              >
                <FlowHint flow={tpl.flow} recommended={tpl.recommended} size="lg" />
              </span>
              <span className="flex flex-1 items-start gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] leading-6 font-semibold text-fg">{t(tpl.title)}</span>
                    {tpl.recommended && <Badge tone="accent">{t("recommended")}</Badge>}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-fg-2">{t(tpl.description)}</span>
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
      {TEMPLATES.map((tpl) => (
        <li key={tpl.id}>
          <Link
            href={hrefOf(tpl.id, folderId)}
            className={cx(
              optionBase,
              "items-center gap-3.5 p-3.5 sm:gap-4 sm:p-4",
              tpl.recommended
                ? "border-accent/40 bg-accent-soft/30 hover:border-accent hover:bg-accent-soft/50"
                : "border-line hover:border-line-strong hover:bg-surface-2/50",
            )}
          >
            <span
              className={cx(
                "flex size-10 shrink-0 items-center justify-center self-start rounded-lg [&_svg]:size-5",
                tpl.recommended ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-2",
              )}
            >
              {tpl.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[15px] leading-6 font-semibold text-fg">{t(tpl.title)}</span>
                {tpl.recommended && <Badge tone="accent">{t("recommended")}</Badge>}
              </span>
              <span className="mt-0.5 block text-[13px] leading-5 text-fg-2">{t(tpl.description)}</span>
              <FlowHint flow={tpl.flow} recommended={tpl.recommended} className="mt-2.5" />
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
  children,
  size = "md",
  block,
  folderId,
  className,
}: {
  children?: ReactNode;
  size?: ButtonSize;
  block?: boolean;
  /** กฎใหม่อยู่ในโฟลเดอร์นี้ */
  folderId?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useT(rulesMessages);
  return (
    <>
      <Button icon={<Plus />} size={size} block={block} className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {children ?? t("newAutomation")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("newAutomation")}
        description={t("chooserDescription")}
        icon={<Zap aria-hidden />}
        iconTone="accent"
      >
        <TemplateOptions folderId={folderId} />
      </Dialog>
    </>
  );
}
