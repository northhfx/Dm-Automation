import type { ConnectedPage } from "@/lib/pages";
import { PagesListView, type PageRow } from "./pages-list-view";

/**
 * รายการเพจที่เชื่อมต่อแล้ว พร้อมสถานะการรับ webhook
 * inset = แสดงในกรอบของตัวเอง (ใช้ในหน้าคู่มือ) — ค่าเริ่มต้นชิดขอบการ์ด (Card padding="none")
 * igLoginIds = id ของบัญชี Instagram ที่เชื่อมผ่าน Instagram Login (บัญชีของเพจที่อยู่ในนี้ ระบบใช้ Instagram Login แทน)
 * ปุ่ม "เชื่อมต่อใหม่" ลิงก์ไปที่ #connect (ฟอร์มเชื่อมเพจในหน้าเดียวกัน)
 *
 * ไฟล์นี้ทำงานฝั่งเซิร์ฟเวอร์: เลือกเฉพาะข้อมูลที่ต้องแสดงส่งให้ PagesListView (Client) — ห้ามส่ง token ของเพจออกไปที่เบราว์เซอร์
 */
export function PagesList({ pages, inset, igLoginIds = [] }: { pages: ConnectedPage[]; inset?: boolean; igLoginIds?: string[] }) {
  const rows: PageRow[] = pages.map((p) => ({
    id: p.id,
    name: p.name,
    tokenOk: Boolean(p.token),
    subscribed: p.subscribed,
    igUsername: p.igUsername,
    igLogin: Boolean(p.igUserId && igLoginIds.includes(p.igUserId)),
    lastError: p.lastError,
    connectedAt: p.connectedAt,
  }));
  return <PagesListView rows={rows} inset={inset} />;
}
