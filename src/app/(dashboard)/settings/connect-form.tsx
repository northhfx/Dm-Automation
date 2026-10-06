"use client";

import { useActionState } from "react";
import { buttonClass, Field, inputClass, Notice } from "@/components/ui";
import { connectAction, type ConnectState } from "./actions";

export function ConnectForm() {
  const [state, action, pending] = useActionState<ConnectState, FormData>(connectAction, { step: "token" });

  if (state.step === "pick" && state.pages) {
    return (
      <form action={action} className="space-y-4">
        <input type="hidden" name="userToken" value={state.userToken} />
        <p className="text-sm text-fg-2">เลือกเพจที่ต้องการให้ระบบตอบอัตโนมัติ</p>
        <div className="space-y-2">
          {state.pages.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 hover:bg-surface-2">
              <input type="checkbox" name="pageIds" value={p.id} defaultChecked={state.pages!.length === 1} />
              <span className="text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="block text-xs text-fg-3">
                  {p.igUsername ? `Instagram: @${p.igUsername}` : "ไม่มี Instagram ที่ผูกไว้ (ใช้ได้เฉพาะ Facebook)"}
                </span>
              </span>
            </label>
          ))}
        </div>
        {state.error && <Notice tone="critical">{state.error}</Notice>}
        <div className="flex gap-2">
          <button className={buttonClass.primary} name="intent" value="save" disabled={pending}>
            {pending ? "กำลังเชื่อมต่อ…" : "เชื่อมต่อเพจที่เลือก"}
          </button>
          <button className={buttonClass.secondary} name="intent" value="reset" formNoValidate>
            ย้อนกลับ
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="intent" value="fetch" />
      {state.step === "done" && state.message && <Notice tone="good">✓ {state.message}</Notice>}
      {state.error && <Notice tone={state.step === "done" ? "warning" : "critical"}>{state.error}</Notice>}
      <Field
        label="User Access Token"
        hint="สร้างได้จาก Graph API Explorer (ดูขั้นตอนใน README หัวข้อ 'เชื่อมต่อเพจ') — ระบบจะแลกเป็น token ระยะยาวให้อัตโนมัติ และไม่เก็บ token นี้ไว้"
        htmlFor="token"
      >
        <textarea id="token" name="token" rows={3} required placeholder="EAAG..." className={`${inputClass} font-mono text-xs`} />
      </Field>
      <button className={buttonClass.primary} disabled={pending}>
        {pending ? "กำลังตรวจสอบ…" : "ดึงรายชื่อเพจ"}
      </button>
    </form>
  );
}
