import { getDb } from "@/db/client";
import { getInstagramConfig, getSetupStatus } from "@/lib/config";
import { listInstagramAccounts } from "@/lib/instagram/accounts";
import { listConnectedPages } from "@/lib/pages";
import { GuideView } from "./guide-view";

export default async function GuidePage() {
  const db = getDb();
  const [status, pages, igAccounts, igConfig] = await Promise.all([
    getSetupStatus(db),
    listConnectedPages(db),
    listInstagramAccounts(db),
    getInstagramConfig(db),
  ]);
  return (
    <GuideView status={status} pages={pages} igAccounts={igAccounts} igHasMetaAppSecret={Boolean(igConfig.metaAppSecret)} />
  );
}
