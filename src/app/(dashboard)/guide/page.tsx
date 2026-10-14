import { getDb } from "@/db/client";
import { getInstagramConfig, getSetupStatus } from "@/lib/config";
import { getLocale } from "@/lib/i18n/server";
import { listInstagramAccounts } from "@/lib/instagram/accounts";
import { listConnectedPages } from "@/lib/pages";
import { GuideView } from "./guide-view";

export default async function GuidePage() {
  const db = getDb();
  const [status, pages, igAccounts, igConfig, locale] = await Promise.all([
    getSetupStatus(db),
    listConnectedPages(db),
    listInstagramAccounts(db),
    getInstagramConfig(db),
    getLocale(),
  ]);
  return (
    <GuideView
      status={status}
      pages={pages}
      igAccounts={igAccounts}
      igHasMetaAppSecret={Boolean(igConfig.metaAppSecret)}
      locale={locale}
    />
  );
}
