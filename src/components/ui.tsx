import type { ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, description }: { children: ReactNode; className?: string; title?: string; description?: ReactNode }) {
  return (
    <section className={cx("rounded-xl border border-line bg-surface p-5", className)}>
      {title && (
        <header className="mb-4">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-fg-2">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, detail }: { label: string; value: string; detail?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-sm text-fg-2">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight">{value}</div>
      {detail && <div className="mt-1 text-xs text-fg-3">{detail}</div>}
    </div>
  );
}

type Tone = "neutral" | "good" | "critical" | "accent" | "warning";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-2",
  good: "bg-good-soft text-good-text",
  critical: "bg-critical-soft text-critical-text",
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-fg",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone])}>
      {children}
    </span>
  );
}

export function PlatformBadge({ platform }: { platform: string }) {
  return platform === "instagram" ? <Badge>Instagram</Badge> : <Badge>Facebook</Badge>;
}

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-critical-text hover:bg-critical-soft disabled:opacity-60",
};

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-fg-3">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "accent", children }: { tone?: "accent" | "warning" | "critical" | "good"; children: ReactNode }) {
  const styles = {
    accent: "border-accent/30 bg-accent-soft",
    warning: "border-warning/50 bg-warning-soft",
    critical: "border-critical/40 bg-critical-soft",
    good: "border-good/40 bg-good-soft",
  }[tone];
  return <div className={cx("rounded-lg border px-4 py-3 text-sm", styles)}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-fg-2">{children}</div>}
    </div>
  );
}

const numberFormat = new Intl.NumberFormat("th-TH");

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

export function formatPercent(n: number | null): string {
  return n === null ? "–" : `${n.toFixed(n >= 10 || n === 0 ? 0 : 1)}%`;
}

const dateTimeFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: process.env.APP_TIMEZONE || "Asia/Bangkok",
});

export function formatDateTime(d: Date | string | null): string {
  if (!d) return "–";
  return dateTimeFormat.format(typeof d === "string" ? new Date(d) : d);
}
