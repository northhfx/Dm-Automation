"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/dialog";
import { toFormData } from "@/components/action";
import { toast } from "@/components/toast";
import { disconnectPage, resubscribePage } from "./actions";

/*
 * ปุ่มจัดการเพจในรายการเพจที่เชื่อมต่อ
 * เรียก action ด้วย FormData ที่สร้างในโค้ด (ไม่ใส่ hidden input ที่มีค่าเป็น Page ID ลงในหน้า
 * เพื่อไม่ให้ชนกับช่องเลือกเพจ input[value="<Page ID>"] ในฟอร์มเชื่อมต่อเพจ)
 */

/** ปุ่ม "ลองใหม่" ให้เพจส่งคอมเมนต์/ข้อความมาที่ระบบอีกครั้ง พร้อมแจ้งผลตามจริง */
export function ResubscribeButton({ pageId, pageName }: { pageId: string; pageName: string }) {
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
            if (result.ok) toast(`${pageName} พร้อมใช้งานแล้ว`, { tone: "good" });
            else toast("ยังเชื่อมต่อไม่สำเร็จ", { tone: "critical", description: result.error });
          } catch {
            toast("ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง", { tone: "critical" });
          }
        })
      }
    >
      {pending ? "กำลังลอง…" : "ลองใหม่"}
    </Button>
  );
}

/** ปุ่มยกเลิกการเชื่อมต่อเพจ (ถามยืนยันก่อน) */
export function DisconnectButton({ pageId, pageName }: { pageId: string; pageName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" icon={<Unplug />} className="max-sm:flex-1" onClick={() => setOpen(true)}>
        ยกเลิกการเชื่อมต่อ
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => disconnectPage(toFormData({ pageId }))}
        title={`ยกเลิกการเชื่อมต่อ ${pageName}?`}
        description="ระบบจะหยุดตอบคอมเมนต์และข้อความของเพจนี้ทันที กฎ รายชื่อลูกค้า และสถิติเดิมยังอยู่ครบ เชื่อมต่อกลับได้ทุกเมื่อ"
        confirmLabel="ยกเลิกการเชื่อมต่อ"
        cancelLabel="ไม่ใช่ตอนนี้"
        successMessage="ยกเลิกการเชื่อมต่อแล้ว"
      />
    </>
  );
}
