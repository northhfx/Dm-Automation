import { BuilderSkeleton } from "../builder/builder-skeleton";
import { RulesText } from "../rules-text";

/** เปิดกฎ: แสดงโครงแผนผังทันทีระหว่างรอข้อมูล */
export default function EditRuleLoading() {
  return <BuilderSkeleton label={<RulesText id="loadingEdit" />} />;
}
