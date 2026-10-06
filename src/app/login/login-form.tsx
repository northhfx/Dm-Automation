"use client";

import { useActionState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { login } from "./actions";

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
