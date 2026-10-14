"use client";

import { useState, useTransition, type ReactNode } from "react";
import { KeyRound, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/dialog";
import { toFormData } from "@/components/action";
import { toast } from "@/components/toast";
import { useT } from "@/lib/i18n/client";
import { commonMessages } from "@/lib/i18n/messages/common";
import { settingsMessages } from "@/lib/i18n/messages/settings";
import { disconnectInstagramAction, refreshInstagramTokenAction, resubscribeInstagramAction, type FormResult } from "./actions";

/*
 * ปุ่มจัดการบัญชี Instagram (Instagram Login) ในรายการบัญชี
 * รับแค่ accountId และ username — token ไม่ถูกส่งมาที่เบราว์เซอร์เลย
 */

/** ปุ่มที่เรียก action แล้วแจ้งผลตามจริง (สำเร็จ / ไม่สำเร็จพร้อมสาเหตุ) */
function ResultButton({
  run,
  icon,
  pendingText,
  success,
  failure,
  children,
}: {
  run: () => Promise<FormResult>;
  icon: ReactNode;
  pendingText: string;
  success: string;
  failure: string;
  children: string;
}) {
  const tCommon = useT(commonMessages);
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      icon={icon}
      loading={pending}
      className="max-sm:flex-1"
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await run();
            if (result.ok) toast(success, { tone: "good" });
            else toast(failure, { tone: "critical", description: result.error });
          } catch {
            toast(tCommon("actionFailed"), { tone: "critical" });
          }
        })
      }
    >
      {pending ? pendingText : children}
    </Button>
  );
}

/** ต่ออายุ token ทันที (ปกติระบบต่ออายุให้เองก่อนหมดอายุ) */
export function RefreshInstagramTokenButton({ accountId }: { accountId: string }) {
  const t = useT(settingsMessages);
  return (
    <ResultButton
      run={() => refreshInstagramTokenAction(toFormData({ accountId }))}
      icon={<KeyRound />}
      pendingText={t("renewing")}
      success={t("renewed")}
      failure={t("renewFailed")}
    >
      {t("renewToken")}
    </ResultButton>
  );
}

/** ลองให้ Meta ส่งคอมเมนต์/ข้อความของบัญชีนี้มาที่ระบบอีกครั้ง */
export function ResubscribeInstagramButton({ accountId, username }: { accountId: string; username: string }) {
  const t = useT(settingsMessages);
  const tCommon = useT(commonMessages);
  return (
    <ResultButton
      run={() => resubscribeInstagramAction(toFormData({ accountId }))}
      icon={<RefreshCw />}
      pendingText={t("trying")}
      success={t("accountReady", { username })}
      failure={t("stillNotConnected")}
    >
      {tCommon("retry")}
    </ResultButton>
  );
}

/** ยกเลิกการเชื่อมต่อบัญชี (ถามยืนยันก่อน) */
export function DisconnectInstagramButton({ accountId, username }: { accountId: string; username: string }) {
  const t = useT(settingsMessages);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" icon={<Unplug />} className="max-sm:flex-1" onClick={() => setOpen(true)}>
        {t("disconnect")}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => disconnectInstagramAction(toFormData({ accountId }))}
        title={t("igDisconnectTitle", { username })}
        description={t("igDisconnectBody")}
        confirmLabel={t("disconnect")}
        cancelLabel={t("notNow")}
        successMessage={t("disconnected")}
      />
    </>
  );
}
