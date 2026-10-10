"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { toFormData } from "@/components/action";
import { toast } from "@/components/toast";
import { resubscribePage } from "./actions";

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
