"use client";

import { useActionState, useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Field, inputClass, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { changePasswordAction, saveBaseUrlAction, saveMetaAppAction, type FormResult } from "./actions";

/** แสดง toast เมื่อบันทึกสำเร็จ (ข้อผิดพลาดแสดงใต้ช่องในฟอร์มแทน) */
function useSuccessToast(state: FormResult, message: string) {
  useEffect(() => {
    if (state.ok) toast(message, { tone: "good" });
  }, [state, message]);
}

/** ข้อผิดพลาดของช่องนี้ (ถ้า action ระบุว่าผิดที่ช่องนี้) */
function fieldError(state: FormResult, field: string): string | undefined {
  return state.field === field ? state.error : undefined;
}

/** ข้อผิดพลาดที่ไม่ได้ผูกกับช่องใด → แสดงเป็นกล่องแจ้งเหนือปุ่ม */
function FormError({ state, fields }: { state: FormResult; fields: string[] }) {
  if (!state.error || (state.field && fields.includes(state.field))) return null;
  return <Notice tone="critical">{state.error}</Notice>;
}

export function MetaAppForm({ appId, hasSecret, fromEnv }: { appId: string | null; hasSecret: boolean; fromEnv: boolean }) {
  const [state, action] = useActionState<FormResult, FormData>(saveMetaAppAction, {});
  // ช่องแบบ controlled เพื่อไม่ให้ค่าที่พิมพ์หายเมื่อบันทึกไม่ผ่าน
  const [id, setId] = useState(appId ?? "");
  const [secret, setSecret] = useState("");
  // บันทึกสำเร็จ → ล้างช่อง secret (ค่าถูกเก็บแล้ว ช่องจะแสดงเป็นจุดแทน)
  const [handled, setHandled] = useState(state);
  if (handled !== state) {
    setHandled(state);
    if (state.ok) setSecret("");
  }
  useSuccessToast(state, "บันทึก Meta App แล้ว");

  if (fromEnv) {
    return (
      <Notice tone="neutral" title="ตั้งค่าไว้ใน Railway แล้ว">
        App ID / App Secret อยู่ใน Variables ของ Railway (แก้ไขที่นั่น){appId && <> · App ID {appId}</>}
      </Notice>
    );
  }

  const idError = fieldError(state, "appId");
  const secretError = fieldError(state, "appSecret");
  return (
    <form action={action} className="space-y-5">
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field label="App ID" htmlFor="appId" hint="ตัวเลขล้วน อยู่บนสุดของหน้า App settings → Basic" error={idError}>
          <input
            id="appId"
            name="appId"
            inputMode="numeric"
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="เช่น 1234567890123456"
            autoComplete="off"
            aria-invalid={Boolean(idError) || undefined}
            className={`${inputClass} tabular`}
          />
        </Field>
        <Field
          label="App Secret"
          htmlFor="appSecret"
          aside={
            hasSecret ? (
              <span className="inline-flex items-center gap-1 text-good-text">
                <LockKeyhole className="size-3.5" aria-hidden />
                บันทึกไว้แล้ว
              </span>
            ) : undefined
          }
          hint={hasSecret ? "ซ่อนไว้เพื่อความปลอดภัย — เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน" : "กด Show ข้างช่อง App secret ในหน้า Meta ก่อนคัดลอก"}
          error={secretError}
        >
          <input
            id="appSecret"
            name="appSecret"
            type="password"
            required={!hasSecret}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={hasSecret ? "••••••••••••••••••••••••" : "ตัวอักษรและตัวเลข 32 ตัว"}
            aria-invalid={Boolean(secretError) || undefined}
            className={`${inputClass} font-mono`}
          />
        </Field>
      </div>
      <FormError state={state} fields={["appId", "appSecret"]} />
      <div className="flex justify-end">
        <SubmitButton pendingText="กำลังบันทึก…" className="max-sm:w-full">
          บันทึก
        </SubmitButton>
      </div>
    </form>
  );
}

export function BaseUrlForm({ baseUrl }: { baseUrl: string | null }) {
  const [state, action] = useActionState<FormResult, FormData>(saveBaseUrlAction, {});
  const [url, setUrl] = useState(baseUrl ?? "");
  useSuccessToast(state, "บันทึกที่อยู่เว็บแล้ว");
  const error = fieldError(state, "baseUrl");
  return (
    <form action={action} className="space-y-5">
      <Field
        label="ที่อยู่เว็บ (URL) ของระบบ"
        htmlFor="baseUrl"
        hint="ลิงก์ที่ใช้เปิดหน้านี้ ดูได้จากแถบที่อยู่ของเบราว์เซอร์ หรือ Railway → กล่องแอป → Settings → Networking (Public domain)"
        error={error}
      >
        <input
          id="baseUrl"
          name="baseUrl"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error) || undefined}
          className={inputClass}
        />
      </Field>
      <FormError state={state} fields={["baseUrl"]} />
      <div className="flex justify-end">
        <SubmitButton variant="secondary" pendingText="กำลังบันทึก…" className="max-sm:w-full">
          บันทึก URL
        </SubmitButton>
      </div>
    </form>
  );
}

export function ChangePasswordForm({ managedByEnv }: { managedByEnv?: boolean }) {
  const [state, action] = useActionState<FormResult, FormData>(changePasswordAction, {});
  useSuccessToast(state, "เปลี่ยนรหัสผ่านแล้ว");

  if (managedByEnv) {
    return (
      <Notice tone="neutral" title="รหัสผ่านตั้งไว้ใน Railway">
        รหัสผ่านถูกตั้งผ่าน ADMIN_PASSWORD ใน Variables ของ Railway — เปลี่ยนที่นั่นแทน
      </Notice>
    );
  }

  const currentError = fieldError(state, "current");
  const nextError = fieldError(state, "next");
  return (
    <form action={action} className="space-y-5">
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field label="รหัสผ่านปัจจุบัน" htmlFor="current" error={currentError}>
          <input
            id="current"
            name="current"
            type="password"
            required
            autoComplete="current-password"
            aria-invalid={Boolean(currentError) || undefined}
            className={inputClass}
          />
        </Field>
        <Field label="รหัสผ่านใหม่" htmlFor="next" hint="อย่างน้อย 8 ตัวอักษร" error={nextError}>
          <input
            id="next"
            name="next"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={Boolean(nextError) || undefined}
            className={inputClass}
          />
        </Field>
      </div>
      <FormError state={state} fields={["current", "next"]} />
      <div className="flex justify-end">
        <SubmitButton variant="secondary" pendingText="กำลังเปลี่ยน…" className="max-sm:w-full">
          เปลี่ยนรหัสผ่าน
        </SubmitButton>
      </div>
    </form>
  );
}
