import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode, Ref } from "react";
import { ChevronLeft, CircleAlert, CircleCheck, Inbox, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { PlatformIcon } from "./platform-icon";

/*
 * ชุดคอมโพเนนต์พื้นฐานของทั้งระบบ (ใช้ได้ทั้ง Server และ Client Component — ไฟล์นี้ไม่มี hook)
 * คอมโพเนนต์ที่ต้องโต้ตอบ (Dialog, Menu, Switch, toast ฯลฯ) อยู่ในไฟล์แยกใน src/components/
 * คู่มือการใช้งาน: ดู COMPONENTS.md ที่ส่งให้ทีม
 * ไอคอนทุกตัวรับเป็น element เช่น icon={<Plus />} (ส่งข้าม Server → Client ได้) ไม่ต้องกำหนดขนาดเอง
 */

export { PlatformIcon } from "./platform-icon";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ---------------- หัวหน้า / ส่วน / การ์ด ----------------

/** หัวข้อหน้า: ชื่อหน้า + คำอธิบายสั้น + ปุ่มด้านขวา (บนมือถือปุ่มจะลงไปอยู่บรรทัดใหม่) */
export function PageHeader({
  title,
  description,
  actions,
  back,
  badge,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** ลิงก์ย้อนกลับเหนือชื่อหน้า เช่น { href: "/rules", label: "กฎทั้งหมด" } */
  back?: { href: string; label: string };
  /** ป้ายข้างชื่อหน้า เช่น <Badge tone="good" dot>เปิดอยู่</Badge> */
  badge?: ReactNode;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      {back && (
        <Link
          href={back.href}
          className="-ml-1 mb-2 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-sm text-fg-2 transition-colors hover:text-fg"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl leading-9 font-semibold tracking-tight text-fg">{title}</h1>
            {badge}
          </div>
          {description && <div className="mt-1 max-w-3xl text-sm leading-6 text-fg-2">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** กลุ่มเนื้อหาในหน้า (ไม่มีกรอบ) มีหัวข้อขนาด 16px — ใช้คั่นหน้าที่ยาวเป็นช่วงๆ */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("space-y-4", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base leading-6 font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-fg-2">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

type CardPadding = "none" | "sm" | "md" | "lg";

/**
 * การ์ดพื้นขาวขอบมน — ใส่ title เพื่อมีหัวการ์ด (actions = ปุ่ม/ลิงก์ด้านขวาของหัว)
 * padding="none" สำหรับตาราง/รายการที่ต้องชิดขอบ (หัวการ์ดจะมีเส้นคั่นด้านล่างให้)
 */
export function Card({
  children,
  className,
  title,
  description,
  actions,
  icon,
  footer,
  padding = "md",
  id,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  padding?: CardPadding;
  id?: string;
}) {
  const hasHeader = Boolean(title || actions);
  const pad = { none: "", sm: "p-4", md: "p-5", lg: "p-6 sm:p-8" }[padding];
  const headerPad = { none: "border-b border-line px-5 py-4", sm: "px-4 pt-4", md: "px-5 pt-5", lg: "px-6 pt-6 sm:px-8 sm:pt-8" }[padding];
  return (
    <section id={id} className={cx("min-w-0 rounded-xl border border-line bg-surface shadow-xs", className)}>
      {hasHeader && (
        <header className={cx("flex items-start gap-3", headerPad)}>
          {icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-2 [&_svg]:size-[18px]">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1 self-center">
            {title && <h2 className="text-base leading-6 font-semibold text-fg">{title}</h2>}
            {description && <div className="mt-0.5 text-sm leading-6 text-fg-2">{description}</div>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children !== undefined && children !== null && children !== false && (
        <div className={cx(pad, hasHeader && padding !== "none" && "pt-4")}>{children}</div>
      )}
      {footer && (
        <footer className="flex flex-wrap items-center gap-2 rounded-b-xl border-t border-line bg-surface-2/50 px-5 py-3 text-sm">
          {footer}
        </footer>
      )}
    </section>
  );
}

type Tone = "neutral" | "good" | "critical" | "accent" | "warning";

const ICON_TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-2",
  good: "bg-good-soft text-good-text",
  critical: "bg-critical-soft text-critical-text",
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning-text",
};

/** ตัวเลขสรุป เช่น "ส่ง DM สำเร็จ 120" — ใส่ href ให้ทั้งกล่องกดได้ */
export function StatTile({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
  href,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm leading-6 text-fg-2">{label}</span>
        {icon && (
          <span className={cx("-mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", ICON_TONES[tone])}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[28px] leading-9 font-semibold tracking-tight text-fg tabular">{value}</div>
      {detail && <div className="mt-1 text-xs leading-5 text-fg-3">{detail}</div>}
    </>
  );
  const cls = "block min-w-0 rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5";
  return href ? (
    <Link href={href} className={cx(cls, "transition hover:border-line-strong hover:shadow-sm", className)}>
      {body}
    </Link>
  ) : (
    <div className={cx(cls, className)}>{body}</div>
  );
}

// ---------------- ป้าย ----------------

type BadgeTone = Tone | "outline";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg-2",
  good: "bg-good-soft text-good-text",
  critical: "bg-critical-soft text-critical-text",
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning-text",
  outline: "border border-line bg-surface text-fg-2",
};

const DOTS: Record<BadgeTone, string> = {
  neutral: "bg-fg-3",
  good: "bg-good",
  critical: "bg-critical",
  accent: "bg-accent",
  warning: "bg-warning",
  outline: "bg-fg-3",
};

/** ป้ายสถานะเล็กๆ — dot = จุดสีหน้าข้อความ (เช่น สถานะเปิด/ปิด) */
export function Badge({
  children,
  tone = "neutral",
  dot,
  icon,
  size = "sm",
  className,
  title,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
        size === "sm" ? "h-[22px] px-2 text-xs" : "h-7 px-2.5 text-[13px]",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cx("size-1.5 shrink-0 rounded-full", DOTS[tone])} aria-hidden />}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** ป้ายแพลตฟอร์มพร้อมไอคอน — short = "FB" / "IG" */
export function PlatformBadge({ platform, short }: { platform: string; short?: boolean }) {
  const ig = platform === "instagram";
  return (
    <Badge tone="outline" icon={<PlatformIcon platform={platform} size={14} />}>
      {short ? (ig ? "IG" : "FB") : ig ? "Instagram" : "Facebook"}
    </Badge>
  );
}

// ---------------- ปุ่ม ----------------

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] select-none disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 [&_svg]:shrink-0";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg shadow-xs hover:bg-accent-hover active:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-fg shadow-xs hover:bg-surface-2 active:bg-surface-3",
  ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg active:bg-surface-3",
  danger: "border border-line-strong bg-surface text-critical-text shadow-xs hover:border-critical/40 hover:bg-critical-soft",
  destructive: "bg-critical text-critical-fg shadow-xs hover:bg-critical-hover",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px] [&_svg]:size-4",
  md: "h-10 gap-2 px-4 text-sm [&_svg]:size-4",
  lg: "h-11 gap-2 px-5 text-[15px] [&_svg]:size-[18px]",
};

const ICON_BTN_SIZE: Record<ButtonSize, string> = {
  sm: "size-8 [&_svg]:size-4",
  md: "size-10 [&_svg]:size-[18px]",
  lg: "size-11 [&_svg]:size-5",
};

/** คลาสของปุ่ม (ใช้กับ <button>, <Link>, <a>) — ส่วนใหญ่ใช้ <Button> / <ButtonLink> แทนได้ */
export function buttonStyle(variant: ButtonVariant = "primary", size: ButtonSize = "md", opts: { iconOnly?: boolean; block?: boolean } = {}): string {
  return cx(BTN_BASE, BTN_VARIANT[variant], opts.iconOnly ? ICON_BTN_SIZE[size] : BTN_SIZE[size], opts.block && "w-full");
}

/** คลาสปุ่มขนาดปกติ (สูง 40px) — ของเดิม ใช้ต่อได้ */
export const buttonClass = {
  primary: buttonStyle("primary"),
  secondary: buttonStyle("secondary"),
  ghost: buttonStyle("ghost"),
  danger: buttonStyle("danger"),
  /** ปุ่มแดงทึบ สำหรับปุ่มยืนยันการลบในหน้าต่างยืนยัน */
  destructive: buttonStyle("destructive"),
};

/** วงกลมหมุน "กำลังโหลด" — ใส่ label เมื่ออยู่เดี่ยวๆ */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cx("size-4 shrink-0 animate-spin", className)}
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** ไอคอนด้านหน้า เช่น <Plus /> */
  icon?: ReactNode;
  iconRight?: ReactNode;
  /** แสดงวงหมุนแทนไอคอน และกดไม่ได้ */
  loading?: boolean;
  /** เต็มความกว้าง */
  block?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
};

/**
 * ปุ่มมาตรฐาน — ค่าเริ่มต้น type="button" (ไม่ส่งฟอร์ม)
 * ถ้าต้องการส่งฟอร์มให้ใส่ type="submit" หรือใช้ <SubmitButton> ที่แสดงสถานะกำลังบันทึกให้เอง
 */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading,
  block,
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonStyle(variant, size, { block }), className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

/** ลิงก์ที่หน้าตาเป็นปุ่ม (ไปหน้าอื่น) */
export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  block,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}) {
  return (
    <Link className={cx(buttonStyle(variant, size, { block }), className)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

/** ปุ่มไอคอนอย่างเดียว (ต้องมี label สำหรับโปรแกรมอ่านหน้าจอ และขึ้นเป็นคำใบ้ตอนชี้เมาส์) */
export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: ReactNode;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button type={type} aria-label={label} title={label} className={cx(buttonStyle(variant, size, { iconOnly: true }), className)} {...rest}>
      {icon}
    </button>
  );
}

// ---------------- ฟอร์ม ----------------

/** ช่องกรอกข้อความ (input / textarea) สูง 40px */
export const inputClass =
  "block w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm leading-[22px] text-fg shadow-xs transition-[border-color,box-shadow] placeholder:text-fg-3 hover:border-fg-3/60 focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-3 aria-invalid:border-critical aria-invalid:focus:ring-critical/15";

/** ช่องข้อความหลายบรรทัด */
export const textareaClass = cx(inputClass, "min-h-[88px] resize-y");

/** ช่องเลือก <select> (มีลูกศรในตัว) */
export const selectClass =
  "ui-select block w-full min-w-0 cursor-pointer rounded-lg border border-line-strong bg-surface py-2 pr-9 pl-3 text-sm leading-[22px] text-fg shadow-xs transition-[border-color,box-shadow] hover:border-fg-3/60 focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-3 aria-invalid:border-critical";

/** checkbox / radio ใช้สีหลักของระบบ */
export const checkboxClass = "size-4 shrink-0 cursor-pointer rounded border-line-strong accent-accent";

/** ป้ายชื่อช่อง + คำอธิบาย/ข้อผิดพลาดใต้ช่อง */
export function Field({
  label,
  hint,
  children,
  htmlFor,
  error,
  optional,
  required,
  aside,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  /** ข้อความผิดพลาด (สีแดง แทนที่ hint) — อย่าลืมใส่ aria-invalid ที่ช่องด้วย */
  error?: ReactNode;
  /** แสดง "(ไม่บังคับ)" */
  optional?: boolean;
  /** แสดงดอกจันสีแดง */
  required?: boolean;
  /** ข้อความเล็กด้านขวาของป้าย เช่น ตัวนับ 12/640 */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="block text-sm leading-6 font-medium text-fg">
          {label}
          {required && (
            <span className="text-critical-text" aria-hidden>
              {" "}
              *
            </span>
          )}
          {optional && <span className="ml-1.5 text-xs font-normal text-fg-3">(ไม่บังคับ)</span>}
        </label>
        {aside && <div className="shrink-0 text-xs text-fg-3 tabular">{aside}</div>}
      </div>
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-xs leading-5 text-critical-text">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : (
        hint && <div className="text-xs leading-5 text-fg-3">{hint}</div>
      )}
    </div>
  );
}

// ---------------- ข้อความแจ้ง / หน้าว่าง ----------------

type NoticeTone = "accent" | "warning" | "critical" | "good" | "neutral";

const NOTICE: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon }> = {
  accent: { box: "border-accent/25 bg-accent-soft", icon: "text-accent", Icon: Info },
  warning: { box: "border-warning/40 bg-warning-soft", icon: "text-warning-text", Icon: TriangleAlert },
  critical: { box: "border-critical/30 bg-critical-soft", icon: "text-critical-text", Icon: CircleAlert },
  good: { box: "border-good/30 bg-good-soft", icon: "text-good-text", Icon: CircleCheck },
  neutral: { box: "border-line bg-surface-2", icon: "text-fg-3", Icon: Info },
};

/** กล่องแจ้งเตือนในหน้า — มีไอคอนตามโทนให้เอง (icon={false} เพื่อซ่อน) */
export function Notice({
  tone = "accent",
  children,
  title,
  icon,
  actions,
  className,
}: {
  tone?: NoticeTone;
  children?: ReactNode;
  title?: ReactNode;
  icon?: ReactNode | false;
  actions?: ReactNode;
  className?: string;
}) {
  const s = NOTICE[tone];
  return (
    <div className={cx("flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-sm leading-6 text-fg", s.box, className)}>
      {icon !== false && (
        <span className={cx("mt-[3px] shrink-0 [&_svg]:size-[18px]", s.icon)}>{icon ?? <s.Icon aria-hidden />}</span>
      )}
      <div className="min-w-0 flex-1 basis-48">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "text-fg-2" : undefined}>{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 self-center">{actions}</div>}
    </div>
  );
}

/** หน้าว่าง: บอกว่ายังไม่มีอะไร + ทำอะไรต่อ (action = ปุ่มหลัก) */
export function EmptyState({
  title,
  children,
  icon,
  action,
  compact,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center rounded-xl border border-dashed border-line-strong text-center",
        compact ? "px-4 py-8" : "px-6 py-12",
        className,
      )}
    >
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-2 text-fg-3 [&_svg]:size-5">
        {icon ?? <Inbox aria-hidden />}
      </span>
      <p className="text-base leading-6 font-semibold text-fg">{title}</p>
      {children && <div className="mt-1.5 flex max-w-md flex-col items-center text-sm leading-6 text-fg-2">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

// ---------------- แถบความคืบหน้า / รูปโปรไฟล์ / โครงร่างตอนโหลด ----------------

const BAR_TONES = { accent: "bg-accent", good: "bg-good", warning: "bg-warning", critical: "bg-critical" } as const;

export function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  size = "md",
  label,
  className,
}: {
  value: number;
  max?: number;
  tone?: keyof typeof BAR_TONES;
  size?: "sm" | "md";
  /** คำอธิบายสำหรับโปรแกรมอ่านหน้าจอ เช่น "ตั้งค่าเสร็จ 4 จาก 6 ขั้น" */
  label?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cx("w-full overflow-hidden rounded-full bg-surface-3", size === "sm" ? "h-1.5" : "h-2", className)}
    >
      <div className={cx("h-full rounded-full transition-[width] duration-500", BAR_TONES[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

const AVATAR_SIZES = { xs: "size-5 text-[10px]", sm: "size-6 text-[11px]", md: "size-8 text-xs", lg: "size-10 text-sm" } as const;

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = (w: string) => w.match(/[A-Za-z0-9ก-ฮ]/)?.[0] ?? "";
  if (words.length === 0) return "?";
  const a = first(words[0]);
  // ชื่อไทยใช้ตัวอักษรเดียว ชื่ออังกฤษใช้อักษรแรกของ 2 คำแรก
  if (/[ก-ฮ]/.test(a) || words.length === 1) return a.toUpperCase() || "?";
  return (a + first(words[1])).toUpperCase();
}

/** วงกลมตัวอักษรย่อของชื่อ สีคงที่ต่อชื่อ */
export function Avatar({ name, size = "md", className }: { name: string | null | undefined; size?: keyof typeof AVATAR_SIZES; className?: string }) {
  const n = name?.trim() || "";
  let hue = 215;
  if (n) {
    hue = 0;
    for (const ch of n) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  }
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none", AVATAR_SIZES[size], className)}
      style={{
        backgroundColor: n ? `hsl(${hue} var(--avatar-s) var(--avatar-bg-l))` : "var(--surface-3)",
        color: n ? `hsl(${hue} var(--avatar-s) var(--avatar-fg-l))` : "var(--fg-3)",
      }}
    >
      {n ? initialsOf(n) : "?"}
    </span>
  );
}

/** กล่องเทาเต้นเบาๆ ระหว่างรอข้อมูล เช่น <Skeleton className="h-4 w-32" /> */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("ui-skeleton rounded-md bg-surface-3", className)} />;
}

// ---------------- ตาราง ----------------

/**
 * คลาสตารางมาตรฐาน — ใช้ใน <Card padding="none"> เพื่อให้ตารางชิดขอบการ์ด
 * <div className={tableClass.wrap}><table className={tableClass.table}><thead className={tableClass.thead}>...
 */
export const tableClass = {
  wrap: "scroll-thin overflow-x-auto",
  table: "w-full border-collapse text-sm",
  thead: "bg-surface-2/60 text-left text-xs text-fg-3",
  th: "h-10 px-3 font-medium whitespace-nowrap first:pl-5 last:pr-5",
  tr: "border-t border-line",
  trHover: "border-t border-line transition-colors hover:bg-surface-2/50",
  td: "px-3 py-3 align-middle first:pl-5 last:pr-5",
  num: "text-right tabular",
};

// ---------------- การจัดรูปแบบตัวเลข/วันที่ ----------------

const numberFormat = new Intl.NumberFormat("th-TH");

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

export function formatPercent(n: number | null): string {
  return n === null ? "–" : `${n.toFixed(n >= 10 || n === 0 ? 0 : 1)}%`;
}

const timeZone = process.env.APP_TIMEZONE || "Asia/Bangkok";

const dateTimeFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone,
});

export function formatDateTime(d: Date | string | null): string {
  if (!d) return "–";
  return dateTimeFormat.format(typeof d === "string" ? new Date(d) : d);
}

const relativeFormat = new Intl.RelativeTimeFormat("th-TH", { numeric: "auto" });

/** "เมื่อสักครู่", "5 นาทีที่ผ่านมา", "เมื่อวาน" — เกิน 7 วันแสดงเป็นวันที่ */
export function formatRelativeTime(d: Date | string | null, now: Date = new Date()): string {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d) : d;
  const sec = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return "เมื่อสักครู่";
  if (abs < 3600) return relativeFormat.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return relativeFormat.format(Math.round(sec / 3600), "hour");
  if (abs < 7 * 86400) return relativeFormat.format(Math.round(sec / 86400), "day");
  return formatDateTime(date);
}
