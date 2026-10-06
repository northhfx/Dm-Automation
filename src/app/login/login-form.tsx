"use client";

import { useActionState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { createPassword, login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium">
          รหัสผ่าน
        </label>
        <input id="password" name="password" type="password" required autoFocus className={inputClass} />
      </div>
      {state?.error && <p className="text-sm text-critical-text">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full`}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}

export function CreatePasswordForm() {
  const [state, action, pending] = useActionState(createPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium">
          ตั้งรหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
        </label>
        <input id="password" name="password" type="password" required minLength={8} autoFocus className={inputClass} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="block text-sm font-medium">
          พิมพ์รหัสผ่านอีกครั้ง
        </label>
        <input id="confirm" name="confirm" type="password" required minLength={8} className={inputClass} />
      </div>
      {state?.error && <p className="text-sm text-critical-text">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full`}>
        {pending ? "กำลังบันทึก…" : "บันทึกและเริ่มใช้งาน"}
      </button>
    </form>
  );
}
