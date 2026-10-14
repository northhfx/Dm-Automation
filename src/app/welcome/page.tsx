import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui";
import { getDb } from "@/db/client";
import { isPasswordSet } from "@/lib/config";
import { getT } from "@/lib/i18n/server";
import { AuthCard, MissingDatabase } from "../login/auth-card";
import { CreatePasswordForm } from "../login/login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT("auth"))("welcomePageTitle") };
}
export const dynamic = "force-dynamic";

/** หน้าแรกสุดหลัง deploy: ให้ตั้งรหัสผ่านของแดชบอร์ด */
export default async function WelcomePage() {
  if (!process.env.DATABASE_URL) return <MissingDatabase />;
  if (await isPasswordSet(getDb())) redirect("/login");
  const t = await getT("auth");
  return (
    <AuthCard
      eyebrow={
        <Badge tone="accent" size="md" icon={<Sparkles aria-hidden />}>
          {t("welcomeBadge")}
        </Badge>
      }
      title={t("welcomeTitle")}
      description={t("welcomeDescription")}
    >
      <CreatePasswordForm />
    </AuthCard>
  );
}
