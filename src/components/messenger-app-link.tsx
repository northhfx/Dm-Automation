"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { commonMessages } from "@/lib/i18n/messages/common";
import { messengerAppUrl } from "@/lib/inbox/links";
import { toast } from "./toast";

/*
 * ปุ่มเปิดแอป Messenger บนมือถือ (แชท Facebook ในหน้าข้อความรอตอบ + หน้ารายชื่อลูกค้า)
 * Facebook ไม่มีลิงก์ที่พาเข้าห้องแชทของลูกค้าในนามเพจ จึงทำได้แค่:
 * - เปิดแอป (iPhone: fb-messenger:// · Android: intent ที่ไม่มีแอปแล้วไปห้องแชทใน Business Suite แทน)
 * - คัดลอกชื่อลูกค้าไว้ให้ค้นหา (ถ้ารู้ชื่อ) แล้วขึ้น toast บอกวิธีสลับเป็นเพจ + ปุ่มเปิดใน Business Suite
 *   (toast ไม่นับเวลาตอนอยู่ในแอป Messenger — กลับมาที่หน้านี้แล้วยังเห็นอยู่)
 * เปิดในแท็บเดิม (ไม่ใช้ target="_blank": ลิงก์แอปจะทิ้งแท็บว่างไว้)
 */

const noopSubscribe = () => () => {};

/** user agent ของเบราว์เซอร์ (ตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ = "" → ลิงก์แบบ iPhone ไปก่อน) */
function useUserAgent(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => navigator.userAgent,
    () => "",
  );
}

function copyName(name: string | null): Promise<boolean> {
  if (!name || typeof navigator === "undefined" || !navigator.clipboard) return Promise.resolve(false);
  return navigator.clipboard.writeText(name).then(
    () => true,
    () => false,
  );
}

export function MessengerAppLink({
  chatUrl,
  name,
  ariaLabel,
  className,
  children,
}: {
  /** ห้องแชทนั้นใน Meta Business Suite (ทางสำรอง) */
  chatUrl: string;
  /** ชื่อจริงของลูกค้าที่ใช้ค้นหาในแอป — null = Meta ไม่ส่งชื่อมา (ไม่คัดลอก) */
  name: string | null;
  /** ต้องมีคำเดียวกับปุ่ม เช่น "ตอบ …" / "เปิดแชท …" */
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useT(commonMessages);
  const href = messengerAppUrl(useUserAgent(), chatUrl);

  function onClick() {
    // เรียก clipboard ทันทีในจังหวะที่กด (เบราว์เซอร์อนุญาตเฉพาะตอนผู้ใช้กด) แล้วปล่อยให้ลิงก์เปิดแอปตามปกติ
    void copyName(name).then((copied) =>
      toast(t("messengerOpening"), {
        tone: "accent",
        description: copied && name ? t("messengerStepsCopied", { person: name }) : t("messengerSteps"),
        duration: 15000,
        action: { label: t("messengerOpenBusinessSuite"), onClick: () => window.open(chatUrl, "_blank", "noopener,noreferrer") },
      }),
    );
  }

  return (
    <a href={href} onClick={onClick} aria-label={ariaLabel} className={className}>
      {children}
    </a>
  );
}
