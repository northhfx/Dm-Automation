"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { EllipsisVertical } from "lucide-react";
import { buttonStyle, cx, Spinner, type ButtonSize, type ButtonVariant } from "./ui";
import { ConfirmDialog, type ConfirmOptions } from "./dialog";
import { runAction, toFormData, type ActionFields, type FormAction } from "./action";

/*
 * เมนูตัวเลือกเพิ่มเติม (ปุ่มจุดสามจุด) — ลอยอยู่ชั้นบนสุด ไม่โดนตัดในตาราง/การ์ด
 * คีย์บอร์ด: Enter/Space/ลูกศรลง เปิด, ลูกศรขึ้น/ลง เลื่อน, Esc ปิด; คลิกนอกเมนูเพื่อปิด
 *
 * <Menu label="ตัวเลือกของกฎนี้">
 *   <MenuItem href={`/rules/${id}`} icon={<Pencil />}>แก้ไข</MenuItem>
 *   <MenuItem action={duplicateRule} fields={{ id }} icon={<Copy />} successMessage="ทำสำเนาแล้ว">ทำสำเนา</MenuItem>
 *   <MenuSeparator />
 *   <MenuItem action={deleteRule} fields={{ id }} icon={<Trash2 />} tone="danger"
 *     confirm={{ title: "ลบกฎนี้?", description: "ลบแล้วกู้คืนไม่ได้", confirmLabel: "ลบกฎ" }} successMessage="ลบกฎแล้ว">ลบ</MenuItem>
 * </Menu>
 */

interface PendingConfirm extends ConfirmOptions {
  action?: FormAction;
  fields?: ActionFields;
  onConfirm?: () => unknown;
}

interface MenuContextValue {
  close: () => void;
  run: (fn: () => Promise<void>) => void;
  requestConfirm: (c: PendingConfirm) => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenu(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("MenuItem ต้องอยู่ใน <Menu>");
  return ctx;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

export function Menu({
  children,
  label = "ตัวเลือกเพิ่มเติม",
  icon,
  triggerLabel,
  triggerVariant = "ghost",
  triggerSize = "md",
  align = "end",
  className,
  menuClassName,
}: {
  children: ReactNode;
  /** ชื่อปุ่ม (โปรแกรมอ่านหน้าจอ + คำใบ้) */
  label?: string;
  /** ไอคอนปุ่ม (ค่าเริ่มต้น จุดสามจุดแนวตั้ง) */
  icon?: ReactNode;
  /** ถ้าใส่ ปุ่มจะมีข้อความด้วย เช่น "เพิ่มเติม" */
  triggerLabel?: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  /** ชิดขอบขวา (end) หรือซ้าย (start) ของปุ่ม */
  align?: "start" | "end";
  className?: string;
  menuClassName?: string;
}) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<"first" | "last">("first");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const position = useCallback(() => {
    const btn = btnRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    let left = align === "end" ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
  }, [align]);

  const items = () => Array.from(popRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);

  useEffect(() => {
    const pop = popRef.current;
    if (!pop) return;
    const onToggle = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (isOpen) {
        position();
        const list = items();
        (focusOnOpen.current === "last" ? list[list.length - 1] : list[0])?.focus();
        focusOnOpen.current = "first";
      }
    };
    pop.addEventListener("toggle", onToggle);
    return () => pop.removeEventListener("toggle", onToggle);
  }, [position]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => position();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, position]);

  const close = useCallback(() => {
    const pop = popRef.current;
    if (pop?.matches(":popover-open")) pop.hidePopover();
  }, []);

  const ctx: MenuContextValue = {
    close,
    run: (fn) => startTransition(fn),
    requestConfirm: (c) => {
      setConfirm(c);
      setConfirmOpen(true);
    },
  };

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focusOnOpen.current = e.key === "ArrowUp" ? "last" : "first";
      popRef.current?.showPopover();
    }
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    if (e.key === "ArrowDown") next = list[(i + 1) % list.length];
    else if (e.key === "ArrowUp") next = list[(i - 1 + list.length) % list.length];
    else if (e.key === "Home") next = list[0];
    else if (e.key === "End") next = list[list.length - 1];
    else if (e.key === "Tab") close();
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  return (
    <MenuContext.Provider value={ctx}>
      <span className={cx("relative inline-flex", className)}>
        <button
          ref={btnRef}
          type="button"
          popoverTarget={id}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={id}
          aria-label={triggerLabel ? undefined : label}
          title={triggerLabel ? undefined : label}
          aria-busy={pending || undefined}
          onKeyDown={onTriggerKeyDown}
          className={cx(buttonStyle(triggerVariant, triggerSize, { iconOnly: !triggerLabel }), open && "bg-surface-2 text-fg")}
        >
          {pending ? <Spinner /> : (icon ?? <EllipsisVertical aria-hidden />)}
          {triggerLabel}
        </button>
        <div
          ref={popRef}
          id={id}
          popover="auto"
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cx(
            "ui-popover fixed inset-auto m-0 min-w-48 max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border border-line bg-surface p-1 text-sm text-fg shadow-lg",
            menuClassName,
          )}
        >
          {children}
        </div>
      </span>
      {confirm && (
        <ConfirmDialog
          {...confirm}
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          action={confirm.action}
          fields={confirm.fields}
          onConfirm={confirm.onConfirm}
        />
      )}
    </MenuContext.Provider>
  );
}

const itemClass = (danger?: boolean, disabled?: boolean) =>
  cx(
    "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left whitespace-nowrap outline-none transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
    danger ? "text-critical-text hover:bg-critical-soft focus-visible:bg-critical-soft focus:bg-critical-soft" : "text-fg hover:bg-surface-2 focus:bg-surface-2",
    !danger && "[&_svg]:text-fg-3",
    disabled && "pointer-events-none opacity-50",
  );

/**
 * รายการในเมนู เลือกแบบใดแบบหนึ่ง:
 * - href: ไปหน้าอื่น
 * - onSelect: เรียกฟังก์ชัน (Client Component)
 * - action (+ fields): เรียก Server Action พร้อม toast (successMessage) — ใส่ confirm เพื่อถามยืนยันก่อน
 */
export function MenuItem({
  children,
  icon,
  tone,
  disabled,
  hint,
  href,
  external,
  onSelect,
  action,
  fields,
  confirm,
  successMessage,
  errorMessage,
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** ข้อความเล็กด้านขวา */
  hint?: ReactNode;
  href?: string;
  /** เปิดลิงก์ในแท็บใหม่ */
  external?: boolean;
  onSelect?: () => void;
  action?: FormAction;
  fields?: ActionFields;
  confirm?: ConfirmOptions;
  successMessage?: string;
  errorMessage?: string;
}) {
  const menu = useMenu();
  const danger = tone === "danger";
  const inner = (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="ml-4 text-xs text-fg-3">{hint}</span>}
    </>
  );

  if (href && !disabled) {
    return external ? (
      <a role="menuitem" tabIndex={-1} href={href} target="_blank" rel="noreferrer" className={itemClass(danger)} onClick={menu.close}>
        {inner}
      </a>
    ) : (
      <Link role="menuitem" tabIndex={-1} href={href} className={itemClass(danger)} onClick={menu.close}>
        {inner}
      </Link>
    );
  }

  function select() {
    if (disabled) return;
    menu.close();
    if (confirm) {
      menu.requestConfirm({ ...confirm, action, fields, onConfirm: onSelect, successMessage, errorMessage });
      return;
    }
    if (action) {
      menu.run(async () => {
        await runAction(() => action(toFormData(fields)), { success: successMessage, error: errorMessage });
      });
      return;
    }
    onSelect?.();
  }

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onClick={select}
      className={itemClass(danger, disabled)}
    >
      {inner}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-line" />;
}

/** หัวข้อกลุ่มเล็กๆ ในเมนู */
export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-fg-3">{children}</div>;
}
