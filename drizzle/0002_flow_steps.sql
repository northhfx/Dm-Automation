ALTER TABLE "links" ADD COLUMN "step_id" text;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "button_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "step_id" text;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "steps" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
-- ย้ายกฎเดิม (ข้อความเดียว + ลิงก์) ให้เป็นข้อความแรกของ flow
-- ข้อความที่มีปุ่มส่งได้ไม่เกิน 640 ตัวอักษรและห้ามว่าง ถ้าเกิน/ว่าง ให้ใส่ลิงก์ไว้ในข้อความแบบเดิมแทนปุ่ม
UPDATE "rules" SET "steps" = jsonb_build_array(
  CASE
    WHEN coalesce("link_url", '') <> '' AND char_length(btrim(replace("dm_text", '{link}', ''))) BETWEEN 1 AND 640 THEN
      jsonb_build_object(
        'id', 'step1',
        'text', btrim(replace("dm_text", '{link}', '')),
        'buttons', jsonb_build_array(jsonb_build_object('id', 'btn1', 'title', 'เปิดลิงก์', 'type', 'link', 'url', "link_url"))
      )
    WHEN coalesce("link_url", '') <> '' THEN
      jsonb_build_object(
        'id', 'step1',
        'text', btrim(CASE
          WHEN position('{link}' in "dm_text") > 0 THEN replace("dm_text", '{link}', "link_url")
          ELSE "dm_text" || E'\n\n' || "link_url"
        END),
        'buttons', '[]'::jsonb
      )
    ELSE
      jsonb_build_object('id', 'step1', 'text', btrim(replace("dm_text", '{link}', '')), 'buttons', '[]'::jsonb)
  END
) WHERE "steps" = '[]'::jsonb;
--> statement-breakpoint
-- สถิติย้อนหลังของกฎเดิมนับเป็นของข้อความแรก
UPDATE "messages" SET "step_id" = 'step1' WHERE "step_id" IS NULL AND "rule_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "links" SET "step_id" = 'step1', "button_id" = 'btn1' WHERE "step_id" IS NULL AND "rule_id" IS NOT NULL;
