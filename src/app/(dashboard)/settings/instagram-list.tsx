import {
  INSTAGRAM_ERRORS,
  instagramAccountHealth,
  instagramHealthLevel,
  needsNewInstagramToken,
  type InstagramAccount,
  type InstagramAccountHealth,
} from "@/lib/instagram/accounts";
import type { ConnectedPage } from "@/lib/pages";
import { InstagramAccountsView, type InstagramAccountRow, type InstagramProblem } from "./instagram-list-view";

/*
 * รายการบัญชี Instagram ที่เชื่อมผ่าน Instagram Login (Server Component)
 * คำนวณสถานะที่นี่ แล้วส่งเฉพาะข้อมูลที่ต้องแสดงให้ InstagramAccountsView (Client) — ห้ามส่ง token ออกไปที่เบราว์เซอร์
 */

/** บัญชีนี้ต้องแก้ไข/ตรวจสอบอะไรไหม (จุดเตือนในเมนูและป้ายหัวการ์ดของหน้าตั้งค่า) */
export function instagramNeedsAttention(accounts: InstagramAccount[], now: Date = new Date()): boolean {
  return accounts.length === 0 || accounts.some((a) => instagramHealthLevel(instagramAccountHealth(a, now)) !== "ok");
}

/** ปัญหาที่แสดงใต้ชื่อบัญชี (null = ไม่มีปัญหา) — ข้อความแปลตามภาษาใน InstagramAccountsView */
function problemOf(account: InstagramAccount, health: InstagramAccountHealth): InstagramProblem | null {
  if (health === "invalid") return { kind: "invalid" };
  if (!account.lastError) return null;
  // ต่ออายุไม่สำเร็จชั่วคราว: token ยังใช้ได้ ระบบลองใหม่เอง
  if (health === "warning" && account.lastError.startsWith(INSTAGRAM_ERRORS.refreshPrefix)) {
    return { kind: "retrying", error: account.lastError };
  }
  return { kind: "error", error: account.lastError };
}

/**
 * inset = แสดงในกรอบของตัวเอง (ใช้ในหน้าคู่มือ) — ค่าเริ่มต้นชิดขอบการ์ด
 * ปุ่ม "วาง token ใหม่" ลิงก์ไปที่ #connect-instagram (ฟอร์มวาง token ในหน้าเดียวกัน)
 */
export function InstagramAccountsList({
  accounts,
  pages,
  inset,
}: {
  accounts: InstagramAccount[];
  pages: ConnectedPage[];
  inset?: boolean;
}) {
  const now = new Date();
  const rows: InstagramAccountRow[] = accounts.map((a) => {
    const health = instagramAccountHealth(a, now);
    const needsNewToken = needsNewInstagramToken(health);
    return {
      id: a.id,
      username: a.username,
      name: a.name,
      health,
      level: instagramHealthLevel(health),
      needsNewToken,
      // subscribe webhook ซ้ำไม่สำเร็จ (บัญชียังรับ webhook อยู่) → ให้กดลองใหม่ได้เอง
      canResubscribe: !needsNewToken && (!a.subscribed || Boolean(a.lastError?.startsWith(INSTAGRAM_ERRORS.subscribePrefix))),
      linkedPageName: pages.find((p) => p.igUserId === a.id)?.name ?? null,
      problem: problemOf(a, health),
      tokenExpiresAt: a.tokenExpiresAt,
      tokenExpiryEstimated: a.tokenExpiryEstimated,
      lastCommentWebhookAt: a.lastCommentWebhookAt,
      lastMessagingWebhookAt: a.lastMessagingWebhookAt,
    };
  });
  return <InstagramAccountsView rows={rows} inset={inset} />;
}
