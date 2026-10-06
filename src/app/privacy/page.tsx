import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "นโยบายความเป็นส่วนตัว" };
export const dynamic = "force-dynamic";

/** หน้านโยบายความเป็นส่วนตัว — Meta บังคับให้มีตอนส่ง App Review */
export default function PrivacyPage() {
  const business = process.env.BUSINESS_NAME || "ผู้ให้บริการเพจ";
  const email = process.env.CONTACT_EMAIL;
  return (
    <LegalPage title="นโยบายความเป็นส่วนตัว (Privacy Policy)">
      <p>
        {business} (&quot;เรา&quot;) ใช้ระบบนี้เพื่อตอบคอมเมนต์และข้อความบน Facebook และ Instagram ของเราโดยอัตโนมัติ
        นโยบายนี้อธิบายว่าเราเก็บและใช้ข้อมูลของคุณอย่างไร
      </p>
      <h2>ข้อมูลที่เราเก็บ</h2>
      <ul>
        <li>ชื่อ, ชื่อผู้ใช้ และรหัสผู้ใช้ที่ Facebook/Instagram ส่งให้เรา เมื่อคุณคอมเมนต์หรือส่งข้อความถึงเพจ</li>
        <li>ข้อความในคอมเมนต์หรือแชทที่คุณส่งถึงเพจ</li>
        <li>ข้อมูลการกดลิงก์ที่เราส่งให้ (จำนวนครั้งและเวลา)</li>
      </ul>
      <h2>เราใช้ข้อมูลเพื่อ</h2>
      <ul>
        <li>ตอบคอมเมนต์และส่งข้อมูลที่คุณขอทางข้อความ</li>
        <li>ดูสถิติภาพรวม เช่น จำนวนข้อความที่ส่งและอัตราการคลิก เพื่อปรับปรุงการบริการ</li>
      </ul>
      <p>เราไม่ขายหรือเปิดเผยข้อมูลของคุณให้บุคคลภายนอก นอกจากผู้ให้บริการที่จำเป็นต่อการทำงานของระบบ (เช่น ผู้ให้บริการเซิร์ฟเวอร์)</p>
      <h2>การเก็บรักษาและการลบข้อมูล</h2>
      <p>
        ข้อมูลจะถูกเก็บไว้ตราบเท่าที่จำเป็นต่อการให้บริการ คุณสามารถขอลบข้อมูลได้ตามขั้นตอนใน{" "}
        <a href="/data-deletion" className="text-accent underline">
          หน้าการลบข้อมูล
        </a>
      </p>
      <h2>ติดต่อเรา</h2>
      <p>
        ส่งข้อความหาเพจของเราโดยตรง{email && (
          <>
            {" "}หรืออีเมล{" "}
            <a href={`mailto:${email}`} className="text-accent underline">
              {email}
            </a>
          </>
        )}
      </p>
    </LegalPage>
  );
}
