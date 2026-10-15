import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalMessages } from "@/lib/i18n/messages/legal";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT("legal"))("deletionMetaTitle") };
}

/** หน้าแจ้งวิธีขอลบข้อมูล — ใช้กรอกช่อง "Data Deletion Instructions URL" ใน Meta App (ภาษาตามคุกกี้ lang ไม่มีคุกกี้ = ไทย) */
export default async function DataDeletionPage() {
  const t = await getT("legal");
  const businessName = process.env.BUSINESS_NAME;
  const email = process.env.CONTACT_EMAIL;
  return (
    <LegalPage
      title={t("deletionTitle")}
      subtitle={legalMessages.en.deletionTitle}
      current="/data-deletion"
      brand={businessName || undefined}
      locale={t.locale}
    >
      <h2>{t("deletionHowHeading")}</h2>
      <p>{t("deletionHowIntro")}</p>
      <ul>
        <li>{t.rich("deletionHowMessage", { phrase: <strong>{t("deletionHowPhrase")}</strong> })}</li>
        {email && <li>{t.rich("deletionHowEmail", { email: <a href={`mailto:${email}`}>{email}</a> })}</li>}
      </ul>

      <h2>{t("deletionWhatHeading")}</h2>
      <p>{t("deletionWhat")}</p>

      <h2>{t("deletionSelfHeading")}</h2>
      <p>
        {t.rich("deletionSelf", {
          settings: <strong>{t("deletionSelfSettings")}</strong>,
          apps: <strong>{t("deletionSelfApps")}</strong>,
          select: <strong>{t("deletionSelfSelect")}</strong>,
          remove: <strong>{t("deletionSelfRemove")}</strong>,
        })}
      </p>
    </LegalPage>
  );
}
