"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { KeyRound, Link2 } from "lucide-react";
import { buttonStyle, cx, Field, Notice, textareaClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { connectInstagramAction, type InstagramConnectState } from "./actions";

/**
 * ฟอร์มวาง token ของ Instagram (Instagram Login) — ใช้ทั้งเชื่อมบัญชีใหม่และวาง token ใหม่ให้บัญชีเดิม
 * hasAppSecret = บันทึก Instagram app secret แล้ว (ยังไม่มี → ปิดปุ่มและชี้ไปที่ #instagram-app)
 * inGuide = อยู่ในหน้าคู่มือ (ไม่ต้องมีลิงก์กลับไปคู่มือ)
 */
export function InstagramConnectForm({ hasAppSecret, inGuide }: { hasAppSecret: boolean; inGuide?: boolean }) {
  const [state, action] = useActionState<InstagramConnectState, FormData>(connectInstagramAction, {});
  const [token, setToken] = useState("");
  // เชื่อมต่อสำเร็จ → ล้างช่อง token (ระบบเก็บแบบเข้ารหัสไว้แล้ว)
  const [handled, setHandled] = useState(state);
  if (handled !== state) {
    setHandled(state);
    if (state.ok) setToken("");
  }

  useEffect(() => {
    if (!state.ok || !state.message) return;
    if (state.subscribed === false) toast(state.message, { tone: "warning", description: "แต่ยังรับคอมเมนต์และข้อความไม่ได้ ดูรายละเอียดในหน้า" });
    else toast(state.message, { tone: "good" });
  }, [state]);

  // แจ้งว่าบัญชีนี้ผูกกับเพจด้วย = เรื่องปกติ (แสดงแยกเป็นข้อความสีเขียว ไม่ใช่คำเตือน)
  const linkedNotice = state.linkedPage ? `บัญชีนี้ผูกกับเพจ ${state.linkedPage}` : null;
  const warnings = (state.notices ?? []).filter((n) => !(linkedNotice && n.startsWith(linkedNotice)));
  const tokenError = state.field === "token" ? state.error : undefined;
  const otherError = state.error && state.field !== "token" ? state.error : undefined;

  return (
    <form action={action} className="space-y-4">
      {!hasAppSecret && (
        <Notice
          tone="warning"
          title="ใส่ Instagram app secret ก่อน"
          actions={
            <a href="#instagram-app" className={buttonStyle("secondary", "sm")}>
              ไปที่ช่อง app secret
            </a>
          }
        >
          ระบบใช้ secret นี้ตรวจ token และรับข้อมูลจาก Instagram
        </Notice>
      )}

      {state.ok && state.message && (
        <Notice tone={warnings.length ? "warning" : "good"} title={state.message}>
          {state.linkedPage && (
            <p>
              บัญชีนี้คือ Instagram ที่ผูกกับเพจ {state.linkedPage} — ต่อจากนี้ระบบจะตอบคอมเมนต์และ DM ของ Instagram ผ่าน Instagram Login
              ส่วนเพจ Facebook ทำงานเหมือนเดิม ไม่ต้องแก้อะไร
            </p>
          )}
          {!state.linkedPage && warnings.length === 0 && <p>ระบบเริ่มตอบคอมเมนต์และ DM ของบัญชีนี้แล้ว token จะต่ออายุให้อัตโนมัติ</p>}
          {warnings.length > 0 && (
            <ul className={cx("list-disc space-y-1 pl-5", state.linkedPage && "mt-2")}>
              {warnings.map((n) => (
                <li key={n} className="break-words">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      <Field
        label="Access token ของ Instagram"
        htmlFor="igToken"
        error={tokenError}
        hint={
          inGuide ? (
            "หน้า API setup with Instagram login → Generate token (ขึ้นต้นด้วย IG)"
          ) : (
            <>
              หน้า API setup with Instagram login → Generate token (ขึ้นต้นด้วย IG) —{" "}
              <Link href="/guide#step-5-token" className="font-medium text-accent hover:underline">
                ดูวิธีในคู่มือ ขั้นที่ 5 ข้อ 7
              </Link>
            </>
          )
        }
      >
        <textarea
          id="igToken"
          name="token"
          rows={3}
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="IGAA..."
          spellCheck={false}
          autoComplete="off"
          aria-invalid={Boolean(tokenError) || undefined}
          className={cx(textareaClass, "font-mono text-xs leading-5 break-all")}
        />
      </Field>

      {otherError && (
        <Notice
          tone="critical"
          actions={
            state.field === "appSecret" ? (
              <a href="#instagram-app" className={buttonStyle("secondary", "sm")}>
                <KeyRound aria-hidden />
                ใส่ app secret
              </a>
            ) : undefined
          }
        >
          {otherError}
        </Notice>
      )}

      <div className="flex justify-end">
        <SubmitButton icon={<Link2 />} pendingText="กำลังเชื่อมต่อ…" disabled={!hasAppSecret} className="max-sm:w-full">
          เชื่อมต่อ Instagram
        </SubmitButton>
      </div>
    </form>
  );
}
