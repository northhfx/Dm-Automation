"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/dialog";
import { toFormData } from "@/components/action";
import { toast } from "@/components/toast";
import { useT } from "@/lib/i18n/client";
import { commonMessages } from "@/lib/i18n/messages/common";
import { settingsMessages } from "@/lib/i18n/messages/settings";
import { disconnectPage, resubscribePage } from "./actions";

/*
 * ปุ่มจัดการเพจในรายการเพจที่เชื่อมต่อ
 * เรียก action ด้วย FormData ที่สร้างในโค้ด (ไม่ใส่ hidden input ที่มีค่าเป็น Page ID ลงในหน้า
 * เพื่อไม่ให้ชนกับช่องเลือกเพจ input[value="<Page ID>"] ในฟอร์มเชื่อมต่อเพจ)
 */

/** ปุ่ม "ลองใหม่" ให้เพจส่งคอมเมนต์/ข้อความมาที่ระบบอีกครั้ง พร้อมแจ้งผลตามจริง */
export function ResubscribeButton({ pageId, pageName }: { pageId: string; pageName: string }) {
  const t = useT(settingsMessages);
  const tCommon = useT(commonMessages);
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      icon={<RefreshCw />}
      loading={pending}
      className="max-sm:flex-1"
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await resubscribePage(toFormData({ pageId }));
            if (result.ok) toast(t("pageReady", { page: pageName }), { tone: "good" });
            else toast(t("stillNotConnected"), { tone: "critical", description: result.error });
          } catch {
            toast(tCommon("actionFailed"), { tone: "critical" });
          }
        })
      }
    >
      {pending ? t("trying") : tCommon("retry")}
    </Button>
  );
}

/** ปุ่มยกเลิกการเชื่อมต่อเพจ (ถามยืนยันก่อน) */
export function DisconnectButton({ pageId, pageName }: { pageId: string; pageName: string }) {
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
        onConfirm={() => disconnectPage(toFormData({ pageId }))}
        title={t("pageDisconnectTitle", { page: pageName })}
        description={t("pageDisconnectBody")}
        confirmLabel={t("disconnect")}
        cancelLabel={t("notNow")}
        successMessage={t("disconnected")}
      />
    </>
  );
}
