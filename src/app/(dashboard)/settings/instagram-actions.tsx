"use client";

import { useState, useTransition, type ReactNode } from "react";
import { KeyRound, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/dialog";
import { toFormData } from "@/components/action";
import { toast } from "@/components/toast";
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
            toast("ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง", { tone: "critical" });
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
  return (
    <ResultButton
      run={() => refreshInstagramTokenAction(toFormData({ accountId }))}
      icon={<KeyRound />}
      pendingText="กำลังต่ออายุ…"
      success="ต่ออายุ token แล้ว"
      failure="ยังต่ออายุไม่ได้"
    >
      ต่ออายุ token
    </ResultButton>
  );
}

/** ลองให้ Meta ส่งคอมเมนต์/ข้อความของบัญชีนี้มาที่ระบบอีกครั้ง */
export function ResubscribeInstagramButton({ accountId, username }: { accountId: string; username: string }) {
  return (
    <ResultButton
      run={() => resubscribeInstagramAction(toFormData({ accountId }))}
      icon={<RefreshCw />}
      pendingText="กำลังลอง…"
      success={`@${username} พร้อมใช้งานแล้ว`}
      failure="ยังเชื่อมต่อไม่สำเร็จ"
    >
      ลองใหม่
    </ResultButton>
  );
}

/** ยกเลิกการเชื่อมต่อบัญชี (ถามยืนยันก่อน) */
export function DisconnectInstagramButton({ accountId, username }: { accountId: string; username: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" icon={<Unplug />} className="max-sm:flex-1" onClick={() => setOpen(true)}>
        ยกเลิกการเชื่อมต่อ
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => disconnectInstagramAction(toFormData({ accountId }))}
        title={`ยกเลิกการเชื่อมต่อ @${username}?`}
        description="ระบบจะหยุดใช้ Instagram Login กับบัญชีนี้ ถ้าเพจ Facebook ผูกบัญชีนี้ไว้ ระบบจะกลับไปใช้การเชื่อมผ่านเพจแทน กฎ รายชื่อลูกค้า และสถิติเดิมยังอยู่ครบ"
        confirmLabel="ยกเลิกการเชื่อมต่อ"
        cancelLabel="ไม่ใช่ตอนนี้"
        successMessage="ยกเลิกการเชื่อมต่อแล้ว"
      />
    </>
  );
}
