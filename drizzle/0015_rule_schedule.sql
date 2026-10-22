ALTER TABLE "rule_folders" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rule_folders" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rule_folders" ADD COLUMN "closed_reply" text;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "closed_reply" text;