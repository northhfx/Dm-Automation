import { formatDateTime } from "@/components/ui";
import {
  instagramAccountHealth,
  isInstagramAccountUsable,
  needsNewInstagramToken,
  type InstagramAccount,
} from "@/lib/instagram/accounts";

/** "token ใช้ได้ถึง 11 ธ.ค. 20:04 (โดยประมาณ)" — วันหมดอายุของบัญชี */
function expiryText(a: Pick<InstagramAccount, "tokenExpiresAt" | "tokenExpiryEstimated">): string {
  return `${formatDateTime(a.tokenExpiresAt)}${a.tokenExpiryEstimated ? " (โดยประมาณ)" : ""}`;
}

/**
 * สถานะของขั้นที่ 5 ในคู่มือ (เชื่อมต่อ Instagram): เสร็จเมื่อมีบัญชีที่ใช้งานได้จริง
 * (รับ webhook แล้ว และ token ยังไม่หมดอายุ/ไม่ถูก Meta ปฏิเสธ) — กติกาเดียวกับหน้าตั้งค่าและแถบเมนู
 * ถ้า token ตายหมดแล้ว ขั้นนี้กลับเป็น "ยังไม่เสร็จ" (การ์ดเปิดอยู่) และบอกให้วาง token ใหม่ในข้อ 7
 */
export function instagramStepStatus(accounts: InstagramAccount[], now: Date = new Date()): { done: boolean; summary: string } {
  const ready = accounts.filter((a) => isInstagramAccountUsable(a, now));
  if (ready.length > 0) {
    return {
      done: true,
      summary: `เชื่อมแล้ว: ${ready.map((a) => `@${a.username} (token ใช้ได้ถึง ${expiryText(a)})`).join(", ")}`,
    };
  }
  const dead = accounts.find((a) => needsNewInstagramToken(instagramAccountHealth(a, now)));
  if (dead) {
    const health = instagramAccountHealth(dead, now);
    return {
      done: false,
      summary:
        health === "expired"
          ? `token ของ @${dead.username} หมดอายุเมื่อ ${expiryText(dead)} — วาง token ใหม่ในข้อ 7`
          : `token ของ @${dead.username} ใช้ไม่ได้แล้ว — วาง token ใหม่ในข้อ 7`,
    };
  }
  if (accounts.length > 0) {
    return {
      done: false,
      summary: `เชื่อม @${accounts[0].username} แล้ว แต่ยังไม่รับ webhook — กด "ลองใหม่" ในรายการบัญชีที่ข้อ 7`,
    };
  }
  return { done: false, summary: "ให้ระบบตอบคอมเมนต์และ DM ของ Instagram โดยเชื่อมตรงกับ Instagram แยกจาก Facebook" };
}
