import { BuilderSkeleton } from "../builder/builder-skeleton";
import { RulesText } from "../rules-text";

/** สร้างกฎใหม่: แสดงโครงแผนผังทันทีระหว่างรอโพสต์ล่าสุด */
export default function NewRuleLoading() {
  return <BuilderSkeleton label={<RulesText id="loadingNew" />} />;
}
