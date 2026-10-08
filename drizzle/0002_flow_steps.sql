ALTER TABLE "links" ADD COLUMN "step_id" text;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "button_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "step_id" text;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "steps" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- ย้ายกฎเดิม (ข้อความเดียว + ลิงก์) ให้เป็นข้อความขั้นแรกของ flow
UPDATE "rules" SET "steps" = jsonb_build_array(jsonb_build_object(
  'id', 'step1',
  'text', btrim(replace("dm_text", '{link}', '')),
  'buttons', CASE
    WHEN "link_url" IS NOT NULL AND "link_url" <> '' THEN
      jsonb_build_array(jsonb_build_object('id', 'btn1', 'title', 'เปิดลิงก์', 'type', 'link', 'url', "link_url"))
    ELSE '[]'::jsonb
  END
)) WHERE "steps" = '[]'::jsonb;
