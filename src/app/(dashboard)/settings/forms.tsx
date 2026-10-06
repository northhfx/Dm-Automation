"use client";

import { useActionState, useState } from "react";
import { buttonClass, Field, inputClass, Notice } from "@/components/ui";
import { changePasswordAction, saveBaseUrlAction, saveMetaAppAction, type FormResult } from "./actions";

export function MetaAppForm({ appId, hasSecret, fromEnv }: { appId: string | null; hasSecret: boolean; fromEnv: boolean }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(saveMetaAppAction, {});
  // ช่องแบบ controlled เพื่อไม่ให้ค่าที่พิมพ์หายเมื่อบันทึกไม่ผ่าน
  const [id, setId] = useState(appId ?? "");
  const [secret, setSecret] = useState("");
  if (fromEnv) {
    return <Notice>ตั้งค่า App ID / App Secret ไว้ใน Variables ของ Railway แล้ว (แก้ไขที่นั่น)</Notice>;
  }
  return (
    <form action={action} className="space-y-4">
      <Field label="App ID" htmlFor="appId">
        <input
          id="appId"
          name="appId"
          inputMode="numeric"
          required
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="เช่น 1234567890123456"
          className={inputClass}
        />
      </Field>
      <Field
        label="App Secret"
        hint={hasSecret ? "บันทึกไว้แล้ว — เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน" : "กดปุ่ม Show ข้างช่อง App secret ในหน้า Meta ก่อนคัดลอก"}
        htmlFor="appSecret"
      >
        <input
          id="appSecret"
          name="appSecret"
          type="password"
          required={!hasSecret}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="off"
          placeholder={hasSecret ? "••••••••••••••••" : "ตัวอักษร 32 ตัว"}
          className={inputClass}
        />
      </Field>
      {state.error && <Notice tone="critical">{state.error}</Notice>}
      {state.ok && <Notice tone="good">✓ บันทึกแล้ว</Notice>}
      <button className={buttonClass.primary} disabled={pending}>
        {pending ? "กำลังบันทึก…" : "บันทึก"}
      </button>
    </form>
  );
}

export function BaseUrlForm({ baseUrl }: { baseUrl: string | null }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(saveBaseUrlAction, {});
  const [url, setUrl] = useState(baseUrl ?? "");
  return (
    <form action={action} className="space-y-3">
      <Field label="URL ของระบบ" hint="ดูได้จาก Railway → กล่องแอป → Settings → Networking (Public domain)" htmlFor="baseUrl">
        <input
          id="baseUrl"
          name="baseUrl"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          className={inputClass}
        />
      </Field>
      {state.error && <Notice tone="critical">{state.error}</Notice>}
      {state.ok && <Notice tone="good">✓ บันทึกแล้ว</Notice>}
      <button className={buttonClass.secondary} disabled={pending}>
        บันทึก URL
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormResult, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="space-y-3">
      <Field label="รหัสผ่านปัจจุบัน" htmlFor="current">
        <input id="current" name="current" type="password" required className={inputClass} />
      </Field>
      <Field label="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)" htmlFor="next">
        <input id="next" name="next" type="password" required minLength={8} className={inputClass} />
      </Field>
      {state.error && <Notice tone="critical">{state.error}</Notice>}
      {state.ok && <Notice tone="good">✓ เปลี่ยนรหัสผ่านแล้ว</Notice>}
      <button className={buttonClass.secondary} disabled={pending}>
        เปลี่ยนรหัสผ่าน
      </button>
    </form>
  );
}
