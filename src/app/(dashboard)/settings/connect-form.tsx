"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Check, Link2 } from "lucide-react";
import { Avatar, Badge, Button, checkboxClass, cx, Field, Notice, PlatformIcon, textareaClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { connectAction, type ConnectState } from "./actions";

/** แถบบอกว่าอยู่ขั้นไหนของการเชื่อมเพจ: 1 วาง token → 2 เลือกเพจ */
function ConnectSteps({ current }: { current: 1 | 2 }) {
  const steps = ["วาง token", "เลือกเพจ"];
  return (
    <ol className="flex items-center gap-2 text-[13px]" aria-label="ขั้นตอนการเชื่อมต่อเพจ">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            {i > 0 && <span className={cx("h-px w-6 sm:w-10", done || active ? "bg-accent/50" : "bg-line-strong")} aria-hidden />}
            <span
              className={cx(
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular [&_svg]:size-3.5",
                done ? "bg-accent text-accent-fg" : active ? "bg-accent-soft text-accent ring-1 ring-accent/40" : "bg-surface-2 text-fg-3",
              )}
              aria-hidden
            >
              {done ? <Check strokeWidth={2.5} /> : n}
            </span>
            <span className={cx(active ? "font-medium text-fg" : "text-fg-3")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** ปุ่มในขั้นเลือกเพจ — หมุนเฉพาะปุ่มที่ถูกกด (ฟอร์มเดียวมี 2 ปุ่ม) */
function PickButtons() {
  const { pending, data } = useFormStatus();
  const saving = pending && data?.get("intent") === "save";
  return (
    // DOM: ปุ่มหลักมาก่อน (Enter = เชื่อมต่อ) แต่แสดงไว้ด้านขวา
    <div className="flex flex-row-reverse flex-wrap gap-2 max-sm:flex-col">
      <Button type="submit" name="intent" value="save" loading={saving} disabled={pending} icon={<Link2 />} className="max-sm:w-full">
        {saving ? "กำลังเชื่อมต่อ…" : "เชื่อมต่อเพจที่เลือก"}
      </Button>
      <Button
        type="submit"
        name="intent"
        value="reset"
        formNoValidate
        variant="ghost"
        disabled={pending}
        icon={<ArrowLeft />}
        className="max-sm:w-full"
      >
        ย้อนกลับ
      </Button>
    </div>
  );
}

/**
 * ฟอร์มเชื่อมเพจ 2 ขั้น: วาง User Access Token → เลือกเพจ
 * connectedIds = เพจที่เชื่อมอยู่แล้ว (แสดงป้ายให้รู้ว่าเลือกซ้ำได้เพื่อเชื่อมใหม่)
 * inGuide = อยู่ในหน้าคู่มือ (ไม่ต้องมีลิงก์กลับไปคู่มือ)
 */
export function ConnectForm({ connectedIds = [], inGuide }: { connectedIds?: string[]; inGuide?: boolean }) {
  const [state, action] = useActionState<ConnectState, FormData>(connectAction, { step: "token" });
  const [token, setToken] = useState("");
  // เชื่อมต่อสำเร็จ → ล้างช่อง token (ระบบไม่เก็บ token นี้ไว้อยู่แล้ว)
  const [handled, setHandled] = useState(state);
  if (handled !== state) {
    setHandled(state);
    if (state.step === "done") setToken("");
  }

  useEffect(() => {
    if (state.step !== "done" || !state.message) return;
    if (state.error) toast(state.message, { tone: "warning", description: "แต่บางเพจยังรับข้อความไม่ได้ ดูรายละเอียดในหน้า" });
    else toast(state.message, { tone: "good" });
  }, [state]);

  if (state.step === "pick" && state.pages) {
    const pages = state.pages;
    const connected = new Set(connectedIds);
    return (
      <form action={action} className="space-y-5">
        <input type="hidden" name="userToken" value={state.userToken} />
        <ConnectSteps current={2} />
        <fieldset className="space-y-3">
          <legend className="text-sm leading-6 font-medium text-fg">เลือกเพจที่ต้องการให้ระบบตอบอัตโนมัติ</legend>
          <p className="-mt-2 text-xs leading-5 text-fg-3">
            พบ {pages.length} เพจที่บัญชีนี้เป็นแอดมิน — เลือกได้หลายเพจ
          </p>
          <div className="space-y-2">
            {pages.map((p) => (
              <label
                key={p.id}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-surface-2 has-[:checked]:border-accent/60 has-[:checked]:bg-accent-soft/60"
              >
                <input type="checkbox" name="pageIds" value={p.id} defaultChecked={pages.length === 1} className={checkboxClass} />
                <Avatar name={p.name} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{p.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-2">
                    {p.igUsername ? (
                      <>
                        <PlatformIcon platform="instagram" size={12} />
                        <span className="truncate">Instagram @{p.igUsername}</span>
                      </>
                    ) : (
                      <span className="text-fg-3">ไม่มี Instagram ที่ผูกไว้ (ใช้ได้เฉพาะ Facebook)</span>
                    )}
                  </span>
                </span>
                {connected.has(p.id) && (
                  <Badge tone="neutral" className="max-sm:hidden">
                    เชื่อมต่ออยู่แล้ว
                  </Badge>
                )}
              </label>
            ))}
          </div>
        </fieldset>
        {state.error && <Notice tone="critical">{state.error}</Notice>}
        <PickButtons />
      </form>
    );
  }

  const tokenError = state.step === "token" ? state.error : undefined;
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="intent" value="fetch" />
      {state.step === "done" && state.message && (
        <Notice tone={state.error ? "warning" : "good"} title={state.message}>
          {state.error ?? "ระบบเริ่มตอบคอมเมนต์และข้อความของเพจนี้แล้ว"}
        </Notice>
      )}
      <ConnectSteps current={1} />
      <Field
        label="User Access Token"
        htmlFor="token"
        error={tokenError}
        hint={
          inGuide ? (
            "ระบบจะแลกเป็น token ระยะยาวให้อัตโนมัติ และไม่เก็บ token นี้ไว้"
          ) : (
            <>
              สร้างได้จาก Graph API Explorer (
              <Link href="/guide#step-4" className="font-medium text-accent hover:underline">
                ดูวิธีในคู่มือ ขั้นที่ 4
              </Link>
              ) — ระบบจะแลกเป็น token ระยะยาวให้อัตโนมัติ และไม่เก็บ token นี้ไว้
            </>
          )
        }
      >
        <textarea
          id="token"
          name="token"
          rows={3}
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="EAAG..."
          spellCheck={false}
          autoComplete="off"
          aria-invalid={Boolean(tokenError) || undefined}
          className={cx(textareaClass, "font-mono text-xs leading-5 break-all")}
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="กำลังตรวจสอบ…" className="max-sm:w-full">
          ดึงรายชื่อเพจ
        </SubmitButton>
      </div>
    </form>
  );
}
