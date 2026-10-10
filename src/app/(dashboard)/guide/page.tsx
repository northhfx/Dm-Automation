import { getDb } from "@/db/client";
import { getSetupStatus } from "@/lib/config";
import { listConnectedPages } from "@/lib/pages";
import { GuideView } from "./guide-view";

export default async function GuidePage() {
  const db = getDb();
  const [status, pages] = await Promise.all([getSetupStatus(db), listConnectedPages(db)]);
  return <GuideView status={status} pages={pages} />;
}
