import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui";
import { getDb } from "@/db/client";
import { isPasswordSet } from "@/lib/config";
import { AuthCard, MissingDatabase } from "../login/auth-card";
import { CreatePasswordForm } from "../login/login-form";

export const metadata: Metadata = { title: "ตั้งรหัสผ่าน · DM Automation" };
export const dynamic = "force-dynamic";

/** หน้าแรกสุดหลัง deploy: ให้ตั้งรหัสผ่านของแดชบอร์ด */
export default async function WelcomePage() {
  if (!process.env.DATABASE_URL) return <MissingDatabase />;
  if (await isPasswordSet(getDb())) redirect("/login");
  return (
    <AuthCard
      eyebrow={
        <Badge tone="accent" size="md" icon={<Sparkles aria-hidden />}>
          ติดตั้งเสร็จแล้ว
        </Badge>
      }
      title="ตั้งรหัสผ่านของคุณ"
      description="ใช้รหัสนี้ทุกครั้งที่เข้าหน้าจัดการ ตั้งครั้งเดียวเท่านั้น จากนั้นระบบจะพาตั้งค่าทีละขั้น"
    >
      <CreatePasswordForm />
    </AuthCard>
  );
}
