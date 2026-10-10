"use client";

import Link from "next/link";
import { Fragment, useOptimistic, useTransition, type ReactNode } from "react";
import {
  ChevronRight,
  Copy,
  Hourglass,
  Info,
  ListOrdered,
  MessageCircle,
  MessagesSquare,
  MousePointerClick,
  Newspaper,
  Pencil,
  Pin,
  Reply,
  Send,
  Trash2,
  Zap,
} from "lucide-react";
import type { MatchType, Platform, PostScope, TriggerType } from "@/db/schema";
import { Badge, cx, formatNumber, formatPercent, PlatformIcon } from "@/components/ui";
import { Switch } from "@/components/switch";
import { Menu, MenuItem, MenuSeparator } from "@/components/menu";
import { runAction, toFormData } from "@/components/action";
import { toast } from "@/components/toast";
import { deleteRule, duplicateRule, toggleRule } from "./actions";
import { TemplateOptions } from "./template-chooser";

/*
 * รายการกฎอัตโนมัติ (แยกกลุ่มคอมเมนต์ / แชท เพราะระบบตรวจลำดับแยกกันในแต่ละกลุ่ม)
 * การ์ดแต่ละใบ: ชื่อ · เงื่อนไข · ตัวอย่างข้อความแรก · ลำดับการตอบ · สถิติ · สวิตช์เปิด/ปิด · เมนู
 */

/** ข้อมูลกฎที่หน้า /rules ส่งมา (เตรียมไว้ฝั่งเซิร์ฟเวอร์แล้ว) */
export interface RuleListItem {
  id: number;
  name: string;
  active: boolean;
  trigger: TriggerType;
  platforms: Platform[];
  matchType: MatchType;
  keywords: string[];
  /** กฎคอมเมนต์ใช้กับโพสต์ไหน: ทุกโพสต์ / เฉพาะที่เลือก / โพสต์ถัดไป */
  postScope: PostScope;
  /** จำนวนโพสต์ที่เลือก (ใช้เมื่อ postScope = "specific") */
  postCount: number;
  /** แบบ "โพสต์ถัดไป": แพลตฟอร์มที่ผูกโพสต์ได้แล้ว */
  boundPlatforms: Platform[];
  /** มีข้อความตอบใต้คอมเมนต์ */
  publicReply: boolean;
  stepCount: number;
  buttonCount: number;
  firstText: string;
  /** จำนวนครั้งที่กฎทำงาน (ตั้งแต่สร้างกฎ) */
  runs: number;
  /** กฎที่ไม่มีปุ่มเลยไม่มี CTR */
  hasButtons: boolean;
  /** CTR เป็น % (null = ยังไม่มีคนได้รับข้อความ หรือไม่มีปุ่ม) */
  ctr: number | null;
}

const GROUPS: { trigger: TriggerType; title: string; icon: ReactNode }[] = [
  { trigger: "comment", title: "เมื่อมีคนคอมเมนต์", icon: <MessageCircle /> },
  { trigger: "dm", title: "เมื่อมีคนทักแชท", icon: <MessagesSquare /> },
];

const CTR_HINT = "CTR = สัดส่วนคนที่กดปุ่มหรือลิงก์ จากคนที่ได้รับ DM";

export function RuleList({ rules }: { rules: RuleListItem[] }) {
  const groups = GROUPS.map((g) => ({ ...g, rules: rules.filter((r) => r.trigger === g.trigger) })).filter((g) => g.rules.length > 0);
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.trigger} aria-labelledby={`rules-${g.trigger}`}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <h2 id={`rules-${g.trigger}`} className="flex items-center gap-2 text-base leading-6 font-semibold text-fg">
              <span className="flex size-7 items-center justify-center rounded-lg border border-line bg-surface text-fg-2 shadow-xs [&_svg]:size-4" aria-hidden>
                {g.icon}
              </span>
              {g.title}
              <span className="text-sm font-normal text-fg-3 tabular">{g.rules.length}</span>
            </h2>
            {g.rules.length > 1 && (
              <p
                className="flex items-center gap-1.5 text-xs leading-5 text-fg-3"
                title="เปลี่ยนลำดับได้ที่ “ลำดับความสำคัญ” (ขั้นสูง) ในหน้าแก้ไขกฎ"
              >
                <ListOrdered className="size-3.5 shrink-0" aria-hidden />
                ถ้าตรงหลายกฎ ระบบใช้กฎที่อยู่บนสุด
              </p>
            )}
          </div>
          <ol className="space-y-3">
            {g.rules.map((r, i) => (
              <RuleCard key={r.id} rule={r} rank={i + 1} />
            ))}
          </ol>
        </section>
      ))}

      <p className="flex items-start gap-2 text-xs leading-5 text-fg-3">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          ตัวเลขนับตั้งแต่สร้างกฎ · {CTR_HINT} · เปลี่ยนลำดับกฎได้ที่ “ลำดับความสำคัญ” (ขั้นสูง) ในหน้าแก้ไขกฎ
        </span>
      </p>
    </div>
  );
}

function RuleCard({ rule, rank }: { rule: RuleListItem; rank: number }) {
  const [active, setActive] = useOptimistic(rule.active);
  const [pending, startTransition] = useTransition();
  const href = `/rules/${rule.id}`;

  function toggle(next: boolean) {
    startTransition(async () => {
      setActive(next);
      const ok = await runAction(() => toggleRule(toFormData({ id: rule.id })), {
        error: "เปลี่ยนสถานะไม่สำเร็จ ลองใหม่อีกครั้ง",
      });
      if (ok) {
        toast(next ? "เปิดกฎแล้ว เริ่มตอบอัตโนมัติ" : "ปิดกฎแล้ว หยุดตอบชั่วคราว", {
          tone: next ? "good" : "neutral",
          description: rule.name,
        });
      }
    });
  }

  const muted = !active && "opacity-60";

  return (
    <li
      className={cx(
        "relative flex gap-4 rounded-xl border p-4 transition-[background-color,border-color,box-shadow] sm:p-5",
        active
          ? "border-line bg-surface shadow-xs has-[h3_a:hover]:border-line-strong has-[h3_a:hover]:shadow-sm"
          : "border-line bg-surface-2/50 has-[h3_a:hover]:border-line-strong",
      )}
    >
      {/* ลำดับ (ระบบตรวจจากบนลงล่าง) */}
      <span
        className={cx(
          "hidden size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular sm:flex",
          active ? "border-line bg-surface-2 text-fg-2" : "border-line text-fg-3",
        )}
        title={`ลำดับที่ ${rank}`}
      >
        <span className="sr-only">ลำดับที่ </span>
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className={cx("min-w-0 text-[15px] leading-6 font-semibold break-words", muted)}>
                {/* ทั้งการ์ดกดได้ (ยกเว้นสวิตช์และเมนู) */}
                <Link
                  href={href}
                  className="text-fg transition-colors after:absolute after:inset-0 after:rounded-xl hover:text-accent focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                >
                  {rule.name}
                </Link>
              </h3>
              {/* จอใหญ่มีคำว่า "ปิดอยู่" ข้างสวิตช์แล้ว */}
              {!active && (
                <Badge tone="neutral" dot className="sm:hidden">
                  ปิดอยู่
                </Badge>
              )}
            </div>
            <TriggerSummary rule={rule} className={cx("mt-1", muted)} />
          </div>

          <div className="relative z-10 -mt-1.5 -mr-2 flex shrink-0 items-center gap-0.5 sm:-mt-1">
            <span aria-hidden className={cx("mr-1.5 hidden text-xs font-medium sm:inline", active ? "text-good-text" : "text-fg-3")}>
              {active ? "เปิดอยู่" : "ปิดอยู่"}
            </span>
            <Switch checked={active} onChange={toggle} busy={pending} label={`เปิดใช้กฎ ${rule.name}`} hideLabel />
            <RuleMenu rule={rule} href={href} />
          </div>
        </div>

        <MessagePreview text={rule.firstText} inactive={!active} className={cx("mt-3", muted)} />

        <div
          className={cx(
            "mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3",
            !active && "border-line/70",
          )}
        >
          <FlowSummary rule={rule} className={cx(muted)} />
          <RuleStats rule={rule} className={cx(muted)} />
        </div>
      </div>
    </li>
  );
}

function RuleMenu({ rule, href }: { rule: RuleListItem; href: string }) {
  return (
    <Menu label={`ตัวเลือกของกฎ ${rule.name}`}>
      <MenuItem href={href} icon={<Pencil />}>
        แก้ไข
      </MenuItem>
      <MenuItem action={duplicateRule} fields={{ id: rule.id }} icon={<Copy />} successMessage="ทำสำเนาแล้ว (ปิดไว้ก่อน)">
        ทำสำเนา
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        action={deleteRule}
        fields={{ id: rule.id }}
        icon={<Trash2 />}
        tone="danger"
        successMessage="ลบกฎแล้ว"
        confirm={{
          title: `ลบกฎ “${rule.name}”?`,
          description: "ลบแล้วกู้คืนไม่ได้ ถ้าแค่อยากหยุดชั่วคราว ให้ปิดสวิตช์แทน",
          confirmLabel: "ลบกฎ",
        }}
      >
        ลบ
      </MenuItem>
    </Menu>
  );
}

const PLATFORM_NAME: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram" };

/** ขอบเขตโพสต์ของกฎคอมเมนต์ → ไอคอน + ข้อความสั้น (+ คำอธิบายตอนชี้) */
function postScopeLabel(rule: RuleListItem): { icon: ReactNode; text: string; title: string; tone?: "warning" } {
  if (rule.postScope === "specific") {
    return rule.postCount > 0
      ? { icon: <Pin />, text: `${formatNumber(rule.postCount)} โพสต์ที่เลือก`, title: "ใช้กับโพสต์ที่เลือกไว้เท่านั้น" }
      : { icon: <Pin />, text: "ยังไม่ได้เลือกโพสต์", title: "เลือกโพสต์ในหน้าแก้ไขกฎ", tone: "warning" };
  }
  if (rule.postScope === "next") {
    const bound = rule.platforms.filter((p) => rule.boundPlatforms.includes(p));
    if (bound.length === 0) {
      return { icon: <Hourglass />, text: "รอโพสต์ถัดไป", title: "ระบบจะผูกกฎนี้กับโพสต์หรือรีลถัดไปที่คุณลงให้อัตโนมัติ" };
    }
    if (bound.length === rule.platforms.length) {
      return { icon: <Pin />, text: "ผูกกับโพสต์ใหม่แล้ว", title: "ใช้กับโพสต์ใหม่ที่ระบบผูกไว้ให้แล้ว" };
    }
    return {
      icon: <Pin />,
      text: `ผูก ${bound.map((p) => PLATFORM_NAME[p]).join(", ")} แล้ว`,
      title: "แพลตฟอร์มที่เหลือยังรอโพสต์ถัดไป",
    };
  }
  return { icon: <Newspaper />, text: "ทุกโพสต์", title: "ใช้กับทุกโพสต์และรีล" };
}

/** เงื่อนไข: แพลตฟอร์ม · คำที่ต้องมี · โพสต์ */
function TriggerSummary({ rule, className }: { rule: RuleListItem; className?: string }) {
  const comment = rule.trigger === "comment";
  const shown = rule.keywords.slice(0, 4);
  const more = rule.keywords.length - shown.length;
  const lead =
    rule.matchType === "any"
      ? comment
        ? "ทุกคอมเมนต์"
        : "ทุกข้อความในแชท"
      : `${comment ? "คอมเมนต์" : "แชท"}${rule.matchType === "exact" ? "ที่พิมพ์ว่า" : "ที่มีคำว่า"}`;
  const scope = comment ? postScopeLabel(rule) : null;

  return (
    <div className={cx("flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] leading-5 text-fg-2", className)}>
      <span className="inline-flex items-center gap-1">
        {rule.platforms.map((p) => (
          <PlatformIcon key={p} platform={p} size={16} title={PLATFORM_NAME[p]} />
        ))}
      </span>
      <span>{lead}</span>
      {rule.matchType !== "any" &&
        shown.map((k, i) => (
          <span
            key={`${k}-${i}`}
            className="inline-flex h-[22px] max-w-[12rem] items-center truncate rounded-md border border-line bg-surface-2 px-1.5 text-xs font-medium text-fg"
          >
            {k}
          </span>
        ))}
      {rule.matchType !== "any" && more > 0 && (
        // อยู่เหนือลิงก์ของการ์ด เพื่อให้ชี้ดูคำที่เหลือได้
        <span className="relative z-10 cursor-default text-xs text-fg-3" title={rule.keywords.join(", ")}>
          +{more} คำ
        </span>
      )}
      {scope && (
        // ไม่มีจุดคั่น เพราะบนมือถือจุดจะค้างอยู่ท้ายบรรทัด (ไอคอนแยกให้เห็นเองว่าเป็นอีกเรื่อง)
        <span
          className={cx(
            "ml-1 inline-flex items-center gap-1 [&_svg]:size-3.5 [&_svg]:shrink-0",
            scope.tone === "warning" ? "font-medium text-warning-text [&_svg]:text-warning-text" : "[&_svg]:text-fg-3",
          )}
          title={scope.title}
        >
          {scope.icon}
          {scope.text}
        </span>
      )}
    </div>
  );
}

/** แสดงข้อความ โดยแทน {name} ด้วยชิป "ชื่อลูกค้า" (แบบเดียวกับหน้าแก้ไขกฎ) */
function TextWithName({ text }: { text: string }) {
  const parts = text.split("{name}");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="mx-0.5 inline-flex items-center rounded-md bg-accent-soft px-1.5 align-baseline text-[0.85em] font-medium whitespace-nowrap text-accent">
              ชื่อลูกค้า
            </span>
          )}
        </Fragment>
      ))}
    </>
  );
}

/** ตัวอย่างข้อความแรกที่ลูกค้าจะได้รับ (แบบฟองแชท) */
function MessagePreview({ text, inactive, className }: { text: string; inactive?: boolean; className?: string }) {
  const flat = text.replace(/\s+/g, " ").trim();
  return (
    <div className={cx("flex", className)}>
      {/* ตัดบรรทัดที่ข้อความด้านใน (ถ้าตัดที่กล่องที่มี padding บรรทัดถัดไปจะโผล่มาครึ่งบรรทัด) */}
      <p
        className={cx(
          "max-w-2xl rounded-2xl rounded-tl-md px-3.5 py-2 text-sm leading-6",
          // การ์ดที่ปิดอยู่มีพื้นสีเทา → ฟองเป็นสีขาวมีขอบ จะได้ยังเห็นชัด
          inactive ? "border border-line bg-surface" : "bg-surface-2",
          flat ? "text-fg-2" : "text-fg-3 italic",
        )}
        title={flat || undefined}
      >
        <span className="line-clamp-2 sm:line-clamp-1">{flat ? <TextWithName text={flat} /> : "ยังไม่ได้เขียนข้อความ"}</span>
      </p>
    </div>
  );
}

/** ลำดับการตอบย่อ: ตอบใต้คอมเมนต์ › ส่ง 3 ข้อความ · 2 ปุ่ม */
function FlowSummary({ rule, className }: { rule: RuleListItem; className?: string }) {
  const chip = "inline-flex items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-3";
  return (
    <div className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-fg-2", className)}>
      {rule.trigger === "comment" && rule.publicReply && (
        <>
          <span className={chip}>
            <Reply aria-hidden />
            ตอบใต้คอมเมนต์
          </span>
          <ChevronRight className="size-3.5 text-fg-3" aria-hidden />
        </>
      )}
      <span className={chip}>
        <Send aria-hidden />
        ส่ง {formatNumber(rule.stepCount)} ข้อความ
      </span>
      {rule.buttonCount > 0 && (
        <>
          <span aria-hidden className="text-fg-3">
            ·
          </span>
          <span className={chip}>
            <MousePointerClick aria-hidden />
            {formatNumber(rule.buttonCount)} ปุ่ม
          </span>
        </>
      )}
    </div>
  );
}

/** สถิติย่อแบบ ManyChat: ทำงานกี่ครั้ง · CTR (คนที่กดปุ่ม/ลิงก์ ÷ คนที่ได้รับข้อความ) */
function RuleStats({ rule, className }: { rule: RuleListItem; className?: string }) {
  return (
    <dl className={cx("flex items-center gap-4 text-xs leading-5", className)}>
      <div className="flex items-center gap-1.5">
        <Zap className="size-3.5 text-accent" aria-hidden />
        <dt className="text-fg-3">ทำงาน</dt>
        <dd className="text-fg-2">
          <span className="text-sm font-semibold text-fg tabular">{formatNumber(rule.runs)}</span> ครั้ง
        </dd>
      </div>
      <div className="flex items-center gap-1.5" title={rule.hasButtons ? CTR_HINT : "กฎนี้ไม่มีปุ่ม จึงไม่มี CTR"}>
        <dt className="text-fg-3">CTR</dt>
        <dd className="text-fg-2">
          <span className="text-sm font-semibold text-fg tabular">{rule.hasButtons ? formatPercent(rule.ctr) : "–"}</span>
          {!rule.hasButtons && <span className="ml-1 text-fg-3">(ไม่มีปุ่ม)</span>}
        </dd>
      </div>
    </dl>
  );
}

/** หน้าว่าง: ภาพประกอบเล็กๆ + เลือกแบบเริ่มต้นได้ทันที */
export function RulesEmptyState() {
  return (
    <section
      aria-labelledby="rules-empty-title"
      className="rounded-xl border border-dashed border-line-strong bg-surface/60 px-4 py-10 sm:px-8 sm:py-14"
    >
      <div className="flex flex-col items-center text-center">
        <EmptyIllustration />
        <h2 id="rules-empty-title" className="mt-6 text-lg leading-7 font-semibold text-fg">
          ยังไม่มีกฎอัตโนมัติ
        </h2>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-balance text-fg-2">
          เลือกแบบเริ่มต้นด้านล่าง แล้วปรับข้อความ ปุ่ม และการ์ดได้เองทุกอย่าง
        </p>
      </div>
      {/* จอใหญ่: การ์ด 3 ใบเรียงกัน · มือถือ: แถวเรียงลงมา (สั้นกว่า เลื่อนน้อยกว่า) */}
      <div className="mx-auto mt-8 max-w-5xl">
        <TemplateOptions layout="list" className="lg:hidden" />
        <div className="hidden lg:block">
          <TemplateOptions layout="grid" />
        </div>
      </div>
    </section>
  );
}

/** ภาพประกอบ: คอมเมนต์ → สายฟ้า (ระบบ) → ส่ง DM */
function EmptyIllustration() {
  const side = "flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-fg-2 shadow-sm [&_svg]:size-5";
  return (
    <div aria-hidden className="relative flex items-center">
      <span className={cx(side, "-rotate-6")}>
        <MessageCircle />
      </span>
      <span className="h-px w-6 border-t-2 border-dotted border-line-strong sm:w-8" />
      <span className="relative flex size-16 items-center justify-center text-accent-fg [&_svg]:size-7">
        <span className="absolute -inset-2 rounded-[22px] bg-accent-soft" />
        <span className="relative flex size-16 items-center justify-center rounded-2xl bg-accent shadow-md">
          <Zap />
        </span>
      </span>
      <span className="h-px w-6 border-t-2 border-dotted border-line-strong sm:w-8" />
      <span className={cx(side, "rotate-6")}>
        <Send />
      </span>
    </div>
  );
}
