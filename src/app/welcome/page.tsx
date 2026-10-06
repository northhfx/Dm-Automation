import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { isPasswordSet } from "@/lib/config";
import { AuthCard, MissingDatabase } from "../login/auth-card";
import { CreatePasswordForm } from "../login/login-form";

export const dynamic = "force-dynamic";

/** หน้าแรกสุดหลัง deploy: ให้ตั้งรหัสผ่านของแดชบอร์ด */
export default async function WelcomePage() {
  if (!process.env.DATABASE_URL) return <MissingDatabase />;
  if (await isPasswordSet(getDb())) redirect("/login");
  return (
    <AuthCard
      title="ยินดีต้อนรับ 👋"
      description="ระบบติดตั้งเสร็จแล้ว ตั้งรหัสผ่านสำหรับเข้าหน้าจัดการ (ทำครั้งเดียว) จากนั้นระบบจะพาตั้งค่าทีละขั้น"
    >
      <CreatePasswordForm />
    </AuthCard>
  );
}
