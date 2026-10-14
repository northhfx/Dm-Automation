"use client";

import Link from "next/link";
import { useActionState, useEffect, useEffectEvent, useState } from "react";
import { KeyRound, Link2 } from "lucide-react";
import { buttonStyle, cx, Field, Notice, textareaClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { useT } from "@/lib/i18n/client";
import { settingsMessages } from "@/lib/i18n/messages/settings";
import { connectInstagramAction, type InstagramConnectState } from "./actions";

/**
 * ฟอร์มวาง token ของ Instagram (Instagram Login) — ใช้ทั้งเชื่อมบัญชีใหม่และวาง token ใหม่ให้บัญชีเดิม
 * hasAppSecret = บันทึก Instagram app secret แล้ว (ยังไม่มี → ปิดปุ่มและชี้ไปที่ #instagram-app)
 * inGuide = อยู่ในหน้าคู่มือ (ไม่ต้องมีลิงก์กลับไปคู่มือ)
 */
export function InstagramConnectForm({ hasAppSecret, inGuide }: { hasAppSecret: boolean; inGuide?: boolean }) {
  const t = useT(settingsMessages);
  const [state, action] = useActionState<InstagramConnectState, FormData>(connectInstagramAction, {});
  const [token, setToken] = useState("");
  // เชื่อมต่อสำเร็จ → ล้างช่อง token (ระบบเก็บแบบเข้ารหัสไว้แล้ว)
  const [handled, setHandled] = useState(state);
  if (handled !== state) {
    setHandled(state);
    if (state.ok) setToken("");
  }

  // useEffectEvent: เปลี่ยนภาษาทีหลัง (t เปลี่ยน) ไม่ทำให้ toast ขึ้นซ้ำ
  const showResult = useEffectEvent((s: InstagramConnectState) => {
    if (!s.ok || !s.message) return;
    if (s.subscribed === false) toast(s.message, { tone: "warning", description: t("igConnectPartialToast") });
    else toast(s.message, { tone: "good" });
  });
  useEffect(() => showResult(state), [state]);

  // แจ้งว่าบัญชีนี้ผูกกับเพจด้วย = เรื่องปกติ (แสดงแยกเป็นข้อความสีเขียว ไม่ใช่คำเตือน)
  // action แปลข้อความแจ้งเป็นภาษาของหน้าแล้ว จึงเทียบกับส่วนต้นในภาษาเดียวกัน
  const linkedNotice = state.linkedPage ? t("igLinkedPrefix", { page: state.linkedPage }) : null;
  const warnings = (state.notices ?? []).filter((n) => !(linkedNotice && n.startsWith(linkedNotice)));
  const tokenError = state.field === "token" ? state.error : undefined;
  const otherError = state.error && state.field !== "token" ? state.error : undefined;

  return (
    <form action={action} className="space-y-4">
      {!hasAppSecret && (
        <Notice
          tone="warning"
          title={t("igNeedSecretTitle")}
          actions={
            <a href="#instagram-app" className={buttonStyle("secondary", "sm")}>
              {t("igNeedSecretAction")}
            </a>
          }
        >
          {t("igNeedSecretBody")}
        </Notice>
      )}

      {state.ok && state.message && (
        <Notice tone={warnings.length ? "warning" : "good"} title={state.message}>
          {state.linkedPage && <p>{t("igLinkedBody", { page: state.linkedPage })}</p>}
          {!state.linkedPage && warnings.length === 0 && <p>{t("igConnectedBody")}</p>}
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
        label={t("igTokenLabel")}
        htmlFor="igToken"
        error={tokenError}
        hint={
          inGuide
            ? t("igTokenHintGuide")
            : t.rich("igTokenHint", {
                link: (
                  <Link href="/guide#step-5-token" className="font-medium text-accent hover:underline">
                    {t("igTokenHintLink")}
                  </Link>
                ),
              })
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
                {t("igEnterSecret")}
              </a>
            ) : undefined
          }
        >
          {otherError}
        </Notice>
      )}

      <div className="flex justify-end">
        <SubmitButton icon={<Link2 />} pendingText={t("connecting")} disabled={!hasAppSecret} className="max-sm:w-full">
          {t("igConnectSubmit")}
        </SubmitButton>
      </div>
    </form>
  );
}
