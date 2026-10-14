import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { isPasswordSet } from "@/lib/config";
import { getT } from "@/lib/i18n/server";
import { AuthCard, MissingDatabase } from "./auth-card";
import { ForgotPassword, LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT("auth"))("loginPageTitle") };
}
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!process.env.DATABASE_URL) return <MissingDatabase />;
  if (!(await isPasswordSet(getDb()))) redirect("/welcome");
  const t = await getT("auth");
  return (
    <AuthCard title={t("loginTitle")} description={t("loginDescription")} footer={<ForgotPassword />}>
      <LoginForm />
    </AuthCard>
  );
}
