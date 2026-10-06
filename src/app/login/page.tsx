import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { isPasswordSet } from "@/lib/config";
import { AuthCard, MissingDatabase } from "./auth-card";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!process.env.DATABASE_URL) return <MissingDatabase />;
  if (!(await isPasswordSet(getDb()))) redirect("/welcome");
  return (
    <AuthCard title="DM Automation" description="เข้าสู่ระบบด้วยรหัสผ่านที่คุณตั้งไว้">
      <LoginForm />
    </AuthCard>
  );
}
