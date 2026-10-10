"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { TriangleAlert, X } from "lucide-react";
import { Button, cx, IconButton, type ButtonSize, type ButtonVariant } from "./ui";
import { SubmitButton } from "./submit-button";
import { HiddenFields, runAction, type ActionFields, type FormAction } from "./action";

/*
 * หน้าต่างซ้อน (ใช้ <dialog> ของเบราว์เซอร์: กด Esc ปิดได้ โฟกัสวนอยู่ในหน้าต่าง หน้าหลังเลื่อนไม่ได้)
 * - Dialog: หน้าต่างทั่วไป (ควบคุมด้วย open/onClose) บนมือถือจะโผล่จากด้านล่าง
 * - ConfirmDialog / ConfirmSubmit: ถามยืนยันก่อนทำสิ่งที่ย้อนกลับไม่ได้ เช่น ลบ
 * ใส่ data-autofocus ที่ช่อง/ปุ่มที่ต้องการให้โฟกัสเมื่อเปิด
 */

type DialogSize = "sm" | "md" | "lg" | "xl";

const SIZES: Record<DialogSize, string> = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  iconTone = "neutral",
  children,
  footer,
  size = "md",
  placement = "center",
  ariaLabel,
  hideClose,
  formAction,
  className,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  /** ไอคอนวงกลมหน้าหัวข้อ */
  icon?: ReactNode;
  iconTone?: "danger" | "accent" | "good" | "neutral";
  children?: ReactNode;
  /** ปุ่มด้านล่าง (ปุ่มหลักใส่ไว้ท้ายสุด) */
  footer?: ReactNode;
  size?: DialogSize;
  /** "left" = ลิ้นชักเลื่อนจากซ้าย (เมนูบนมือถือ) */
  placement?: "center" | "left";
  /** ชื่อหน้าต่างเมื่อไม่มี title */
  ariaLabel?: string;
  hideClose?: boolean;
  /** ห่อเนื้อหา + footer ด้วย <form action={formAction}> (ปุ่มใน footer ใช้ SubmitButton ได้) */
  formAction?: (formData: FormData) => void | Promise<void>;
  className?: string;
  bodyClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const restoreRef = useRef<HTMLElement | null>(null);
  const downOnBackdrop = useRef(false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handleClose = () => {
      onCloseRef.current();
      const el = restoreRef.current;
      restoreRef.current = null;
      if (el?.isConnected && (!document.activeElement || document.activeElement === document.body)) el.focus();
    };
    d.addEventListener("close", handleClose);
    // ไม่สั่ง close() ตอนถอดคอมโพเนนต์: StrictMode จะถอด/ใส่ effect ซ้ำทันที แล้ว event "close" ที่ค้างจะปิดหน้าต่างที่เพิ่งเปิด
    return () => d.removeEventListener("close", handleClose);
  }, []);

  const hasHeader = Boolean(title) || !hideClose;
  const hasBody = children !== undefined && children !== null && children !== false;
  const content = (
    <>
      {hasHeader && (
        <header className={cx("flex shrink-0 items-start gap-3 px-5 pt-5", !title && "justify-end", !hasBody && "pb-5")}>
          {icon && (
            <span
              className={cx(
                "flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
                { danger: "bg-critical-soft text-critical-text", accent: "bg-accent-soft text-accent", good: "bg-good-soft text-good-text", neutral: "bg-surface-2 text-fg-2" }[iconTone],
              )}
            >
              {icon}
            </span>
          )}
          {title && (
            <div className="min-w-0 flex-1 pt-px">
              <h2 id={titleId} className="text-[17px] leading-7 font-semibold text-fg">
                {title}
              </h2>
              {description && (
                <div id={descId} className="mt-0.5 text-sm leading-6 text-fg-2">
                  {description}
                </div>
              )}
            </div>
          )}
          {!hideClose && <IconButton icon={<X />} label="ปิดหน้าต่าง" size="sm" className="-mt-1 -mr-2" onClick={() => ref.current?.close()} />}
        </header>
      )}
      {hasBody && (
        <div className={cx("scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5", bodyClassName)}>{children}</div>
      )}
      {footer && (
        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-surface-2/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          {footer}
        </footer>
      )}
    </>
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={title && description ? descId : undefined}
      aria-label={!title ? ariaLabel : undefined}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // คลิกพื้นหลังมืด (นอกกล่อง) = ปิด
        if (downOnBackdrop.current && e.target === e.currentTarget) ref.current?.close();
        downOnBackdrop.current = false;
      }}
      className={cx(
        "overflow-hidden border-line bg-surface p-0 text-fg shadow-lg",
        placement === "left"
          ? "ui-drawer m-0 h-dvh max-h-dvh w-[min(86vw,320px)] max-w-none rounded-r-2xl border-r"
          : cx(
              "ui-dialog mx-auto mt-auto mb-0 max-h-[92dvh] w-full max-w-none rounded-t-2xl border pb-[env(safe-area-inset-bottom)] sm:my-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100%-2rem)] sm:rounded-2xl sm:pb-0",
              SIZES[size],
            ),
        className,
      )}
    >
      {formAction ? (
        <form action={formAction} className={cx("flex flex-col", placement === "left" ? "h-full" : "max-h-[inherit]")}>
          {content}
        </form>
      ) : (
        <div className={cx("flex flex-col", placement === "left" ? "h-full" : "max-h-[inherit]")}>{content}</div>
      )}
    </dialog>
  );
}

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  /** ข้อความปุ่มยืนยัน เช่น "ลบกฎ" (ค่าเริ่มต้น "ยืนยัน") */
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = ปุ่มแดง + ไอคอนเตือน (ค่าเริ่มต้น) */
  tone?: "danger" | "primary";
  successMessage?: string;
  errorMessage?: string;
}

/**
 * หน้าต่างยืนยัน — กดยืนยันแล้วเรียก action (Server Action + fields) และ/หรือ onConfirm
 * ระหว่างรอ ปุ่มจะหมุน; สำเร็จแล้วปิดเองและแสดง toast successMessage (รวมถึงกรณีที่ action redirect)
 */
export function ConfirmDialog({
  open,
  onClose,
  action,
  fields,
  onConfirm,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "danger",
  successMessage,
  errorMessage,
  children,
}: ConfirmOptions & {
  open: boolean;
  onClose: () => void;
  action?: FormAction;
  fields?: ActionFields;
  onConfirm?: () => unknown;
  children?: ReactNode;
}) {
  async function submit(formData: FormData) {
    const ok = await runAction(
      async () => {
        if (action) await action(formData);
        if (onConfirm) await onConfirm();
      },
      { success: successMessage, error: errorMessage },
    );
    if (ok) onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={description}
      hideClose
      icon={tone === "danger" ? <TriangleAlert aria-hidden /> : undefined}
      iconTone="danger"
      formAction={submit}
      footer={
        <>
          <HiddenFields fields={fields} />
          <Button variant="secondary" onClick={onClose} data-autofocus className="max-sm:w-full">
            {cancelLabel}
          </Button>
          <SubmitButton variant={tone === "danger" ? "destructive" : "primary"} className="max-sm:w-full">
            {confirmLabel}
          </SubmitButton>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

/**
 * ปุ่มที่ถามยืนยันก่อนเรียก Server Action (เช่น ลบ) — ใช้ในหน้า Server ได้เลย
 * <ConfirmSubmit action={deleteRule} fields={{ id: rule.id }} title="ลบกฎนี้?" description="ลบแล้วกู้คืนไม่ได้"
 *   confirmLabel="ลบกฎ" successMessage="ลบกฎแล้ว" icon={<Trash2 />}>ลบกฎ</ConfirmSubmit>
 * iconOnly: แสดงเป็นปุ่มไอคอน (ต้องมี label)
 */
export function ConfirmSubmit({
  action,
  fields,
  children,
  icon,
  variant,
  size = "md",
  iconOnly,
  label,
  block,
  disabled,
  className,
  ...confirm
}: ConfirmOptions & {
  action: FormAction;
  fields?: ActionFields;
  /** ข้อความบนปุ่มเปิดหน้าต่าง */
  children?: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  /** ชื่อปุ่มสำหรับโปรแกรมอ่านหน้าจอ (จำเป็นเมื่อ iconOnly) */
  label?: string;
  block?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const v = variant ?? (confirm.tone === "primary" ? "secondary" : "danger");
  return (
    <>
      {iconOnly ? (
        <IconButton
          icon={icon}
          label={label ?? (typeof children === "string" ? children : "ยืนยัน")}
          variant={variant ?? "ghost"}
          size={size}
          disabled={disabled}
          className={className}
          onClick={() => setOpen(true)}
        />
      ) : (
        <Button variant={v} size={size} icon={icon} block={block} disabled={disabled} className={className} onClick={() => setOpen(true)}>
          {children}
        </Button>
      )}
      <ConfirmDialog {...confirm} open={open} onClose={() => setOpen(false)} action={action} fields={fields} />
    </>
  );
}
