import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { legalMessages } from "@/lib/i18n/messages/legal";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT("legal"))("privacyTitle") };
}

/** หน้านโยบายความเป็นส่วนตัว — Meta บังคับให้มีตอนส่ง App Review (ภาษาตามคุกกี้ lang ไม่มีคุกกี้ = ไทย) */
export default async function PrivacyPage() {
  const t = await getT("legal");
  const businessName = process.env.BUSINESS_NAME;
  const business = businessName || t("privacyBusinessFallback");
  const email = process.env.CONTACT_EMAIL;
  return (
    <LegalPage
      title={t("privacyTitle")}
      subtitle={legalMessages.en.privacyTitle}
      current="/privacy"
      brand={businessName || undefined}
      locale={t.locale}
    >
      <p>{t("privacyIntro", { business })}</p>

      <h2>{t("privacyCollectHeading")}</h2>
      <ul>
        <li>{t("privacyCollectProfile")}</li>
        <li>{t("privacyCollectMessages")}</li>
        <li>{t("privacyCollectClicks")}</li>
      </ul>

      <h2>{t("privacyUseHeading")}</h2>
      <ul>
        <li>{t("privacyUseReply")}</li>
        <li>{t("privacyUseStats")}</li>
      </ul>
      <p>{t("privacySharing")}</p>

      <h2>{t("privacyRetentionHeading")}</h2>
      <p>{t.rich("privacyRetention", { link: <Link href="/data-deletion">{t("privacyRetentionLink")}</Link> })}</p>

      <h2>{t("privacyContactHeading")}</h2>
      <p>
        {email
          ? t.rich("privacyContactEmail", { email: <a href={`mailto:${email}`}>{email}</a> })
          : t("privacyContact")}
      </p>
    </LegalPage>
  );
}
