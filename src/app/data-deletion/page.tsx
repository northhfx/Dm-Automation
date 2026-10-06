import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "การลบข้อมูลผู้ใช้" };
export const dynamic = "force-dynamic";

/** หน้าแจ้งวิธีขอลบข้อมูล — ใช้กรอกช่อง "Data Deletion Instructions URL" ใน Meta App */
export default function DataDeletionPage() {
  const email = process.env.CONTACT_EMAIL;
  return (
    <LegalPage title="การขอลบข้อมูล (Data Deletion Instructions)">
      <p>หากต้องการให้เราลบข้อมูลของคุณที่ได้รับผ่าน Facebook หรือ Instagram ทำได้ดังนี้</p>
      <ul>
        <li>ส่งข้อความถึงเพจของเราว่า &quot;ขอลบข้อมูล&quot; พร้อมชื่อบัญชีของคุณ</li>
        {email && (
          <li>
            หรือส่งอีเมลมาที่{" "}
            <a href={`mailto:${email}`} className="text-accent underline">
              {email}
            </a>
          </li>
        )}
      </ul>
      <p>เราจะลบชื่อ รหัสผู้ใช้ ประวัติข้อความ และข้อมูลการคลิกลิงก์ของคุณออกจากระบบภายใน 30 วัน และแจ้งกลับเมื่อดำเนินการเสร็จ</p>
      <p>
        คุณยังสามารถถอนสิทธิ์การเข้าถึงของแอปได้เองที่ Facebook: การตั้งค่า → แอปและเว็บไซต์ → เลือกแอปนี้ → ลบ
      </p>
    </LegalPage>
  );
}
