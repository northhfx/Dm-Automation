import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "การลบข้อมูลผู้ใช้" };
export const dynamic = "force-dynamic";

/** หน้าแจ้งวิธีขอลบข้อมูล — ใช้กรอกช่อง "Data Deletion Instructions URL" ใน Meta App */
export default function DataDeletionPage() {
  const businessName = process.env.BUSINESS_NAME;
  const email = process.env.CONTACT_EMAIL;
  return (
    <LegalPage
      title="การขอลบข้อมูล"
      subtitle="Data Deletion Instructions"
      current="/data-deletion"
      brand={businessName || undefined}
    >
      <h2>วิธีขอลบข้อมูล</h2>
      <p>หากต้องการให้เราลบข้อมูลของคุณที่ได้รับผ่าน Facebook หรือ Instagram ทำได้ดังนี้</p>
      <ul>
        <li>
          ส่งข้อความถึงเพจของเราว่า <strong>&quot;ขอลบข้อมูล&quot;</strong> พร้อมชื่อบัญชีของคุณ
        </li>
        {email && (
          <li>
            หรือส่งอีเมลมาที่ <a href={`mailto:${email}`}>{email}</a>
          </li>
        )}
      </ul>

      <h2>สิ่งที่เราจะลบ</h2>
      <p>เราจะลบชื่อ รหัสผู้ใช้ ประวัติข้อความ และข้อมูลการคลิกลิงก์ของคุณออกจากระบบภายใน 30 วัน และแจ้งกลับเมื่อดำเนินการเสร็จ</p>

      <h2>ถอนสิทธิ์ของแอปด้วยตัวเอง</h2>
      <p>
        คุณยังสามารถถอนสิทธิ์การเข้าถึงของแอปได้เองที่ Facebook: <strong>การตั้งค่า</strong> → <strong>แอปและเว็บไซต์</strong> →{" "}
        <strong>เลือกแอปนี้</strong> → <strong>ลบ</strong>
      </p>
    </LegalPage>
  );
}
