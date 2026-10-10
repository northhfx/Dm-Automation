"use client";

import { useId, useOptimistic, useState, useTransition, type ReactNode } from "react";
import { cx } from "./ui";
import { runAction, toFormData, type ActionFields, type FormAction } from "./action";

/*
 * สวิตช์เปิด/ปิด
 * - Switch: แบบควบคุมเอง (checked + onChange)
 * - SwitchField: ใช้ในฟอร์ม ส่งค่า name="on" เมื่อเปิด (แบบเดียวกับ checkbox)
 * - ActionSwitch: กดแล้วเรียก Server Action ทันที เช่น เปิด/ปิดกฎในหน้ารายการ
 */

type SwitchSize = "sm" | "md";

const TRACK: Record<SwitchSize, string> = { sm: "h-5 w-9", md: "h-6 w-11" };
const KNOB: Record<SwitchSize, string> = { sm: "size-4", md: "size-5" };
const SHIFT: Record<SwitchSize, string> = { sm: "translate-x-4", md: "translate-x-5" };

export function Switch({
  checked,
  onChange,
  label,
  hideLabel,
  description,
  disabled,
  busy,
  size = "md",
  id,
  className,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  /** ข้อความกำกับ (จำเป็น — ถ้าไม่อยากให้เห็นใส่ hideLabel) */
  label: ReactNode;
  hideLabel?: boolean;
  description?: ReactNode;
  disabled?: boolean;
  /** กำลังบันทึก (กดไม่ได้ชั่วคราว) */
  busy?: boolean;
  size?: SwitchSize;
  id?: string;
  className?: string;
}) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const descId = description ? `${switchId}-desc` : undefined;

  const control = (
    <button
      type="button"
      role="switch"
      id={switchId}
      aria-checked={checked}
      aria-label={hideLabel && typeof label === "string" ? label : undefined}
      aria-describedby={descId}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => !busy && onChange?.(!checked)}
      className={cx(
        "relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 before:absolute before:-inset-2 disabled:cursor-not-allowed disabled:opacity-50",
        TRACK[size],
        checked ? "bg-accent" : "bg-line-strong",
        busy && "opacity-70",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "rounded-full bg-knob shadow-sm transition-transform duration-200 ease-out",
          KNOB[size],
          checked ? SHIFT[size] : "translate-x-0",
        )}
      />
    </button>
  );

  if (hideLabel) return <span className={cx("inline-flex", className)}>{control}</span>;

  return (
    <div className={cx("flex items-start gap-3", className)}>
      <span className={cx("flex items-center", size === "md" ? "h-6" : "h-5")}>{control}</span>
      <div className="min-w-0 leading-6">
        <label htmlFor={switchId} className={cx("text-sm font-medium text-fg", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
          {label}
        </label>
        {description && (
          <p id={descId} className="text-xs leading-5 text-fg-3">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * สวิตช์ในฟอร์ม (ไม่ต้องจัดการ state เอง) — ส่ง name=value (ค่าเริ่มต้น "on") เมื่อเปิด ไม่ส่งอะไรเมื่อปิด
 * layout="row": ข้อความซ้าย สวิตช์ขวา (เหมาะกับหน้าตั้งค่า)
 */
export function SwitchField({
  name,
  defaultChecked,
  value = "on",
  label,
  description,
  disabled,
  onChange,
  layout = "inline",
  size = "md",
  className,
}: {
  name: string;
  defaultChecked?: boolean;
  value?: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  layout?: "inline" | "row";
  size?: SwitchSize;
  className?: string;
}) {
  const [checked, setChecked] = useState(Boolean(defaultChecked));
  const id = useId();
  const set = (v: boolean) => {
    setChecked(v);
    onChange?.(v);
  };
  const hidden = checked && <input type="hidden" name={name} value={value} />;

  if (layout === "row") {
    return (
      <div className={cx("flex items-start justify-between gap-4", className)}>
        <div className="min-w-0 leading-6">
          <label htmlFor={id} className="cursor-pointer text-sm font-medium text-fg">
            {label}
          </label>
          {description && <p className="text-xs leading-5 text-fg-3">{description}</p>}
        </div>
        <span className="flex h-6 items-center">
          <Switch id={id} checked={checked} onChange={set} label={label} hideLabel disabled={disabled} size={size} />
        </span>
        {hidden}
      </div>
    );
  }
  return (
    <>
      <Switch id={id} checked={checked} onChange={set} label={label} description={description} disabled={disabled} size={size} className={className} />
      {hidden}
    </>
  );
}

/**
 * สวิตช์ที่เรียก Server Action ทันทีเมื่อกด (เปลี่ยนสถานะบนจอก่อน แล้วค่อยยืนยันกับเซิร์ฟเวอร์)
 * <ActionSwitch action={toggleRule} fields={{ id: rule.id }} checked={rule.active} label="เปิดใช้กฎนี้" hideLabel
 *   onMessage="เปิดกฎแล้ว" offMessage="ปิดกฎแล้ว" />
 * หมายเหตุ: action ต้องสลับค่า (toggle) และ revalidatePath ให้หน้าโหลดค่าใหม่
 */
export function ActionSwitch({
  action,
  fields,
  checked,
  onMessage,
  offMessage,
  errorMessage,
  ...rest
}: {
  action: FormAction;
  fields?: ActionFields;
  checked: boolean;
  onMessage?: string;
  offMessage?: string;
  errorMessage?: string;
  label: ReactNode;
  hideLabel?: boolean;
  description?: ReactNode;
  disabled?: boolean;
  size?: SwitchSize;
  className?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    startTransition(async () => {
      setOptimistic(next);
      await runAction(() => action(toFormData(fields)), { success: next ? onMessage : offMessage, error: errorMessage });
    });
  }

  return <Switch {...rest} checked={optimistic} onChange={toggle} busy={pending} />;
}
