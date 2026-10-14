"use client";

import { useActionState, useEffect, useEffectEvent, useState } from "react";
import { ChevronRight, LockKeyhole } from "lucide-react";
import { Field, inputClass, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { useT } from "@/lib/i18n/client";
import { commonMessages } from "@/lib/i18n/messages/common";
import { settingsMessages } from "@/lib/i18n/messages/settings";
import { changePasswordAction, saveBaseUrlAction, saveInstagramAppAction, saveMetaAppAction, type FormResult } from "./actions";

/** แสดง toast เมื่อบันทึกสำเร็จ (ข้อผิดพลาดแสดงใต้ช่องในฟอร์มแทน) — เปลี่ยนภาษาทีหลังไม่ทำให้ toast ขึ้นซ้ำ */
function useSuccessToast(state: FormResult, message: string) {
  const show = useEffectEvent(() => toast(message, { tone: "good" }));
  useEffect(() => {
    if (state.ok) show();
  }, [state]);
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
  const t = useT(settingsMessages);
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
  useSuccessToast(state, t("metaAppSaved"));

  if (fromEnv) {
    return (
      <Notice tone="neutral" title={t("fromRailwayTitle")}>
        {t("metaFromEnvBody")}
        {appId && <> · App ID {appId}</>}
      </Notice>
    );
  }

  const idError = fieldError(state, "appId");
  const secretError = fieldError(state, "appSecret");
  return (
    <form action={action} className="space-y-5">
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field label="App ID" htmlFor="appId" hint={t("appIdHint")} error={idError}>
          <input
            id="appId"
            name="appId"
            inputMode="numeric"
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder={t("appIdPlaceholder")}
            autoComplete="off"
            aria-invalid={Boolean(idError) || undefined}
            className={`${inputClass} tabular`}
          />
        </Field>
        <Field
          label="App Secret"
          htmlFor="appSecret"
          aside={hasSecret ? <SavedMark /> : undefined}
          hint={hasSecret ? t("secretSavedHint") : t("appSecretHint")}
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
            placeholder={hasSecret ? "••••••••••••••••••••••••" : t("secret32Placeholder")}
            aria-invalid={Boolean(secretError) || undefined}
            className={`${inputClass} font-mono`}
          />
        </Field>
      </div>
      <FormError state={state} fields={["appId", "appSecret"]} />
      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}

/** ป้าย "บันทึกไว้แล้ว" ข้างชื่อช่อง secret */
function SavedMark() {
  const t = useT(settingsMessages);
  return (
    <span className="inline-flex items-center gap-1 text-good-text">
      <LockKeyhole className="size-3.5" aria-hidden />
      {t("savedMark")}
    </span>
  );
}

/** ปุ่ม "บันทึก" ของฟอร์ม secret */
function SaveButton() {
  const t = useT(commonMessages);
  return (
    <SubmitButton pendingText={t("saving")} className="max-sm:w-full">
      {t("save")}
    </SubmitButton>
  );
}

/**
 * Instagram app secret จากหน้า API setup with Instagram login + App secret (App settings → Basic) ของแอป Instagram ที่แยกไว้
 * Meta อาจใช้ secret ตัวไหนก็ได้ลงลายเซ็น webhook ระบบจึงตรวจกับทั้งสองตัว
 * separateApp = คู่มือขั้นที่ 5 (สร้างแอปแยกเสมอ): แสดงช่องที่สองเลยและต้องกรอก
 * ไม่งั้น (หน้าตั้งค่า) ช่องที่สองพับไว้ เพราะถ้าใช้แอป Facebook เดิม ไม่ต้องกรอก
 */
export function InstagramAppForm({
  hasSecret,
  hasMetaAppSecret,
  fromEnv,
  separateApp,
}: {
  hasSecret: boolean;
  hasMetaAppSecret: boolean;
  fromEnv: boolean;
  separateApp?: boolean;
}) {
  const t = useT(settingsMessages);
  const [state, action] = useActionState<FormResult, FormData>(saveInstagramAppAction, {});
  const [secret, setSecret] = useState("");
  const [metaSecret, setMetaSecret] = useState("");
  const [moreOpen, setMoreOpen] = useState(hasMetaAppSecret);
  // บันทึกสำเร็จ → ล้างช่อง (ค่าถูกเก็บแล้ว) / ช่องที่ซ่อนอยู่ผิด → เปิดให้เห็น
  const [handled, setHandled] = useState(state);
  if (handled !== state) {
    setHandled(state);
    if (state.ok) {
      setSecret("");
      setMetaSecret("");
    }
    if (state.field === "igMetaAppSecret") setMoreOpen(true);
  }
  useSuccessToast(state, t("igSecretSaved"));

  if (fromEnv) {
    return (
      <Notice tone="neutral" title={t("fromRailwayTitle")}>
        {t("igFromEnvBody")}
      </Notice>
    );
  }

  const secretError = fieldError(state, "igAppSecret");
  const metaError = fieldError(state, "igMetaAppSecret");
  const metaField = (
    <Field
      label={t("igMetaSecretLabel")}
      htmlFor="igMetaAppSecret"
      optional={!separateApp}
      aside={hasMetaAppSecret ? <SavedMark /> : undefined}
      hint={hasMetaAppSecret ? t("secretSavedHint") : separateApp ? t("igMetaSecretHintGuide") : t("igMetaSecretHint")}
      error={metaError}
    >
      <input
        id="igMetaAppSecret"
        name="igMetaAppSecret"
        type="password"
        required={separateApp && !hasMetaAppSecret}
        value={metaSecret}
        onChange={(e) => setMetaSecret(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder={hasMetaAppSecret ? "••••••••••••••••••••••••" : t("secret32Placeholder")}
        aria-invalid={Boolean(metaError) || undefined}
        className={`${inputClass} font-mono`}
      />
    </Field>
  );
  return (
    <form action={action} className="space-y-5">
      <Field
        label={separateApp ? "Instagram app secret (API setup with Instagram login)" : "Instagram app secret"}
        htmlFor="igAppSecret"
        aside={hasSecret ? <SavedMark /> : undefined}
        hint={hasSecret ? t("secretSavedHint") : t("igSecretHint")}
        error={secretError}
      >
        <input
          id="igAppSecret"
          name="igAppSecret"
          type="password"
          required={!hasSecret}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={hasSecret ? "••••••••••••••••••••••••" : t("igSecretPlaceholder")}
          aria-invalid={Boolean(secretError) || undefined}
          className={`${inputClass} font-mono`}
        />
      </Field>
      {separateApp ? (
        metaField
      ) : (
        <details open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)} className="group/more rounded-lg border border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-fg hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 shrink-0 text-fg-3 transition-transform group-open/more:rotate-90" aria-hidden />
            <span className="flex-1">{t("igSeparateAppSummary")}</span>
            {hasMetaAppSecret && <span className="text-xs font-normal text-good-text">{t("savedMark")}</span>}
          </summary>
          <div className="border-t border-line p-3.5">{metaField}</div>
        </details>
      )}
      <FormError state={state} fields={["igAppSecret", "igMetaAppSecret"]} />
      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}

export function BaseUrlForm({ baseUrl }: { baseUrl: string | null }) {
  const t = useT(settingsMessages);
  const tCommon = useT(commonMessages);
  const [state, action] = useActionState<FormResult, FormData>(saveBaseUrlAction, {});
  const [url, setUrl] = useState(baseUrl ?? "");
  useSuccessToast(state, t("baseUrlSaved"));
  const error = fieldError(state, "baseUrl");
  return (
    <form action={action} className="space-y-5">
      <Field
        label={t("baseUrlLabel")}
        htmlFor="baseUrl"
        hint={t("baseUrlHint")}
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
        <SubmitButton variant="secondary" pendingText={tCommon("saving")} className="max-sm:w-full">
          {t("baseUrlSave")}
        </SubmitButton>
      </div>
    </form>
  );
}

export function ChangePasswordForm({ managedByEnv }: { managedByEnv?: boolean }) {
  const t = useT(settingsMessages);
  const [state, action] = useActionState<FormResult, FormData>(changePasswordAction, {});
  useSuccessToast(state, t("passwordChanged"));

  if (managedByEnv) {
    return (
      <Notice tone="neutral" title={t("passwordFromEnvTitle")}>
        {t("passwordFromEnvBody")}
      </Notice>
    );
  }

  const currentError = fieldError(state, "current");
  const nextError = fieldError(state, "next");
  return (
    <form action={action} className="space-y-5">
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field label={t("currentPassword")} htmlFor="current" error={currentError}>
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
        <Field label={t("newPassword")} htmlFor="next" hint={t("newPasswordHint")} error={nextError}>
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
        <SubmitButton variant="secondary" pendingText={t("passwordChanging")} className="max-sm:w-full">
          {t("passwordSubmit")}
        </SubmitButton>
      </div>
    </form>
  );
}
