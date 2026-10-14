"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/toast";

/**
 * ปุ่มโหลดสถานะใหม่ (แทนการกดรีเฟรชทั้งหน้า) เช่น รอ Meta ยืนยัน Webhook
 * children = ชื่อปุ่ม, doneMessage = ข้อความแจ้งเมื่อโหลดเสร็จ (GuideView แปลมาให้)
 */
export function RefreshButton({ children, doneMessage }: { children: string; doneMessage: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const wasPending = useRef(false);

  // โหลดเสร็จ → แจ้งว่าสถานะบนหน้าเป็นค่าล่าสุดแล้ว
  useEffect(() => {
    if (wasPending.current && !pending) toast(doneMessage, { duration: 2500 });
    wasPending.current = pending;
  }, [pending, doneMessage]);

  return (
    <Button variant="secondary" size="sm" icon={<RefreshCw />} loading={pending} onClick={() => startTransition(() => router.refresh())}>
      {children}
    </Button>
  );
}
