import { BuilderSkeleton } from "../builder/builder-skeleton";

/** สร้างกฎใหม่: แสดงโครงแผนผังทันทีระหว่างรอโพสต์ล่าสุด */
export default function NewRuleLoading() {
  return <BuilderSkeleton label="กำลังเตรียมกฎใหม่…" />;
}
