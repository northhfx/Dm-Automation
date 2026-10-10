import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { isPasswordSet } from "@/lib/config";
import { AuthCard, MissingDatabase } from "./auth-card";
import { ForgotPassword, LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ · DM Automation" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!process.env.DATABASE_URL) return <MissingDatabase />;
  if (!(await isPasswordSet(getDb()))) redirect("/welcome");
  return (
    <AuthCard title="เข้าสู่ระบบ" description="ใส่รหัสผ่านที่คุณตั้งไว้ เพื่อเข้าหน้าจัดการ" footer={<ForgotPassword />}>
      <LoginForm />
    </AuthCard>
  );
}
