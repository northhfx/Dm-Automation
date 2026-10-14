"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { ArrowRight, ChevronDown, Circle, CircleCheck, Eye, EyeOff, KeyRound, LockKeyhole, RefreshCw, TriangleAlert } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Notice, cx, inputClass } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { authMessages } from "@/lib/i18n/messages/auth";
import { createPassword, login } from "./actions";

const MIN_LENGTH = 8;

// ---------------- ชิ้นส่วนที่ใช้ร่วมกัน ----------------

/** ช่องรหัสผ่าน + ปุ่มแสดง/ซ่อน + เตือนเมื่อเปิด Caps Lock (ค่าในช่องไม่ผูกกับ state — ฟอร์มล้างค่าเองได้) */
function PasswordInput({
  id,
  autoComplete,
  inputRef,
  invalid,
  describedBy,
  autoFocus,
  onValueChange,
}: {
  id: "password" | "confirm";
  autoComplete: "current-password" | "new-password";
  inputRef: RefObject<HTMLInputElement | null>;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const t = useT(authMessages);
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const capsId = `${id}-caps`;

  function checkCapsLock(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          required
          minLength={autoComplete === "new-password" ? MIN_LENGTH : undefined}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-invalid={invalid || undefined}
          aria-describedby={cx(describedBy, capsLock && capsId) || undefined}
          className={cx(inputClass, "h-11 pr-12")}
          onKeyDown={checkCapsLock}
          onKeyUp={checkCapsLock}
          onBlur={() => setCapsLock(false)}
          onChange={(e) => onValueChange?.(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={t("showPassword")}
          aria-pressed={visible}
          aria-controls={id}
          title={visible ? t("hidePassword") : t("showPassword")}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-fg-3 transition-colors hover:text-fg focus-visible:-outline-offset-2"
        >
          {visible ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
        </button>
      </div>
      {capsLock && (
        <p id={capsId} className="flex items-center gap-1.5 text-xs leading-5 text-warning-text">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          {t("capsLockOn")}
        </p>
      )}
    </>
  );
}

/** ข้อความผิดพลาดของฟอร์ม — role=alert ให้โปรแกรมอ่านหน้าจออ่านทันทีที่ขึ้น */
function FormError({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div id={id} role="alert">
      <Notice tone="critical" title={title}>
        {children}
      </Notice>
    </div>
  );
}

/** คำใบ้ใต้ช่อง: วงกลม → เครื่องหมายถูกเมื่อผ่านเงื่อนไข */
function CheckHint({ id, ok, warn, children }: { id: string; ok: boolean; warn?: boolean; children: ReactNode }) {
  return (
    <span id={id} className={cx("inline-flex items-center gap-1.5", ok ? "text-good-text" : warn ? "text-warning-text" : "text-fg-3")}>
      {ok ? <CircleCheck className="size-3.5 shrink-0" aria-hidden /> : <Circle className="size-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

// ---------------- เข้าสู่ระบบ ----------------

export function LoginForm() {
  const t = useT(authMessages);
  const [state, formAction, pending] = useActionState(login, undefined);
  const [clientError, setClientError] = useState<string | null>(null);
  // พิมพ์ใหม่แล้ว → ซ่อนข้อความผิดพลาดเดิม จนกว่าจะกดเข้าสู่ระบบอีกครั้ง
  const [edited, setEdited] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // รหัสผิด: ฟอร์มถูกล้างค่าอัตโนมัติ → พาไปที่ช่องให้พิมพ์ใหม่ได้ทันที
  useEffect(() => {
    if (state?.error) inputRef.current?.focus();
  }, [state]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    setEdited(false);
    if (!inputRef.current?.value) {
      e.preventDefault();
      setClientError(t("enterPasswordFirst"));
      inputRef.current?.focus();
      return;
    }
    setClientError(null);
  }

  const error = pending || edited ? null : (clientError ?? state?.error ?? null);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-5">
      {/* ช่องชื่อผู้ใช้ที่ซ่อนไว้ ให้ตัวจำรหัสผ่านของเบราว์เซอร์/มือถือบันทึกได้ถูกต้อง */}
      <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden />
      <Field label={t("passwordLabel")} htmlFor="password">
        <PasswordInput
          id="password"
          autoComplete="current-password"
          inputRef={inputRef}
          autoFocus
          invalid={Boolean(error)}
          describedBy={error ? "login-error" : undefined}
          onValueChange={() => setEdited(true)}
        />
      </Field>
      {error && (
        <FormError id="login-error" title={error}>
          {clientError ? undefined : t("wrongPasswordHint")}
        </FormError>
      )}
      <SubmitButton block size="lg" pendingText={t("loggingIn")} iconRight={pending ? undefined : <ArrowRight aria-hidden />}>
        {t("loginButton")}
      </SubmitButton>
    </form>
  );
}

/** "ลืมรหัสผ่าน?" — ตั้งรหัสใหม่ได้ทาง Variable ADMIN_PASSWORD ใน Railway */
export function ForgotPassword() {
  const t = useT(authMessages);
  return (
    <details className="group">
      <summary className="-mx-2 flex h-12 list-none items-center justify-between gap-2 rounded-lg px-2 text-sm font-medium text-fg-2 transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <KeyRound className="size-4 text-fg-3" aria-hidden />
          {t("forgotPassword")}
        </span>
        <ChevronDown className="size-4 text-fg-3 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-5 text-sm leading-6 text-fg-2">
        <p>{t("forgotIntro")}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 marker:text-fg-3 [&_b]:font-semibold [&_b]:text-fg">
          <li>{t.rich("forgotStep1", { variables: <b>Variables</b> })}</li>
          <li>
            {t.rich("forgotStep2", {
              newVariable: <b>+ New Variable</b>,
              name: <code className="rounded bg-surface-2 px-1 font-mono text-[13px] text-fg">ADMIN_PASSWORD</code>,
            })}
          </li>
          <li>{t.rich("forgotStep3", { deploy: <b>Deploy</b> })}</li>
        </ol>
        <p className="mt-2 text-xs leading-5 text-fg-3">{t("forgotNote")}</p>
      </div>
    </details>
  );
}

// ---------------- ตั้งรหัสผ่านครั้งแรก ----------------

type FieldError = { field: "password" | "confirm"; message: string };

export function CreatePasswordForm() {
  const t = useT(authMessages);
  const [state, formAction, pending] = useActionState(createPassword, undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [clientError, setClientError] = useState<FieldError | null>(null);
  const [edited, setEdited] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.error) passwordRef.current?.focus();
  }, [state]);

  const longEnough = password.length >= MIN_LENGTH;
  const matches = confirm.length > 0 && confirm === password;

  // ตรวจในเครื่องก่อนส่ง (ข้อความตามภาษาที่เลือก + ค่าที่พิมพ์ไม่หาย) — เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    setEdited(false);
    const problem: FieldError | null = !password
      ? { field: "password", message: t("choosePasswordFirst") }
      : !longEnough
        ? { field: "password", message: t("passwordTooShort", { min: MIN_LENGTH }) }
        : !confirm
          ? { field: "confirm", message: t("typeConfirm") }
          : confirm !== password
            ? { field: "confirm", message: t("passwordsDontMatch") }
            : null;
    setClientError(problem);
    if (problem) {
      e.preventDefault();
      (problem.field === "password" ? passwordRef : confirmRef).current?.focus();
    }
  }

  const serverError: FieldError | null = state?.error ? { field: "password", message: state.error } : null;
  const error = pending || edited ? null : (clientError ?? serverError);

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      // หลังส่งฟอร์ม React ล้างค่าในช่องให้เอง → ล้างคำใบ้ตามด้วย
      onReset={() => {
        setPassword("");
        setConfirm("");
      }}
      noValidate
      className="space-y-5"
    >
      <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden />
      <Field
        label={t("newPasswordLabel")}
        htmlFor="password"
        hint={
          <CheckHint id="password-hint" ok={longEnough}>
            {t("minLengthHint", { min: MIN_LENGTH })}
            {password.length > 0 && !longEnough && <span className="tabular">{t("charsToGo", { count: MIN_LENGTH - password.length })}</span>}
          </CheckHint>
        }
      >
        <PasswordInput
          id="password"
          autoComplete="new-password"
          inputRef={passwordRef}
          autoFocus
          invalid={error?.field === "password"}
          describedBy={cx("password-hint", error?.field === "password" && "create-error")}
          onValueChange={(v) => {
            setPassword(v);
            setEdited(true);
          }}
        />
      </Field>
      <Field
        label={t("confirmLabel")}
        htmlFor="confirm"
        hint={
          <CheckHint id="confirm-hint" ok={matches} warn={!matches && confirm.length >= Math.max(password.length, 1)}>
            {matches ? t("confirmMatches") : confirm.length > 0 && confirm.length >= password.length ? t("confirmNoMatch") : t("confirmTypeSame")}
          </CheckHint>
        }
      >
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          inputRef={confirmRef}
          invalid={error?.field === "confirm"}
          describedBy={cx("confirm-hint", error?.field === "confirm" && "create-error")}
          onValueChange={(v) => {
            setConfirm(v);
            setEdited(true);
          }}
        />
      </Field>
      {error && <FormError id="create-error" title={error.message} />}
      <SubmitButton block size="lg" pendingText={t("saving")} iconRight={pending ? undefined : <ArrowRight aria-hidden />}>
        {t("saveAndStart")}
      </SubmitButton>
      <p className="flex items-start justify-center gap-1.5 text-center text-xs leading-5 text-fg-3">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("storedSafely")}
      </p>
    </form>
  );
}

// ---------------- ยังไม่ได้เชื่อมฐานข้อมูล ----------------

/** โหลดหน้าใหม่ เพื่อตรวจว่าเชื่อมฐานข้อมูลได้แล้วหรือยัง */
export function ReloadButton() {
  const t = useT(authMessages);
  const [loading, setLoading] = useState(false);
  return (
    <Button
      block
      size="lg"
      icon={<RefreshCw aria-hidden />}
      loading={loading}
      onClick={() => {
        setLoading(true);
        window.location.reload();
      }}
    >
      {t("checkAgain")}
    </Button>
  );
}
