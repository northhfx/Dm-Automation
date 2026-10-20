-- โฟลเดอร์ชื่อซ้ำที่อาจมีอยู่แล้ว (สร้างพร้อมกัน) → ต่อท้ายด้วย id ก่อน ไม่งั้นสร้าง unique index ไม่ได้
UPDATE "rule_folders" f SET "name" = f."name" || ' (' || f."id" || ')'
WHERE EXISTS (SELECT 1 FROM "rule_folders" g WHERE lower(g."name") = lower(f."name") AND g."id" < f."id");--> statement-breakpoint
CREATE UNIQUE INDEX "rule_folders_name_idx" ON "rule_folders" USING btree (lower("name"));
