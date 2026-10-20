import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { ruleFolders } from "@/db/schema";
import { parseFolderFilter } from "@/lib/rules/folders";
import { loadRecentPosts } from "../recent-posts";
import { RuleBuilder } from "../builder/rule-builder";
import { parseTemplateId, ruleTemplate } from "../templates";

export default async function NewRulePage({ searchParams }: PageProps<"/rules/new">) {
  const params = await searchParams;
  const template = parseTemplateId(params.template);
  const db = getDb();
  const folderFilter = parseFolderFilter(params.folder);
  const [{ posts, error }, folder] = await Promise.all([
    loadRecentPosts(db),
    // สร้างจากในโฟลเดอร์ (?folder=id) → กฎใหม่อยู่ในโฟลเดอร์นั้น
    typeof folderFilter === "number"
      ? db.query.ruleFolders.findFirst({ where: eq(ruleFolders.id, folderFilter), columns: { id: true, name: true } })
      : undefined,
  ]);
  // key = แม่แบบ: เปลี่ยนแม่แบบแล้วเริ่มใหม่ทั้งหมด
  return <RuleBuilder key={template} initial={ruleTemplate(template)} recentPosts={posts} postsError={error} folder={folder ?? null} />;
}
