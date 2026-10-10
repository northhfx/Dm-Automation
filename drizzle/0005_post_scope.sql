ALTER TABLE "rules" ADD COLUMN "post_scope" text DEFAULT 'any' NOT NULL;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "next_post_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "bound_posts" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- กฎเดิมที่เลือกโพสต์ไว้ = "เฉพาะโพสต์ที่เลือก" ที่เหลือ = "ทุกโพสต์"
UPDATE "rules" SET "post_scope" = 'specific' WHERE cardinality("post_ids") > 0;
