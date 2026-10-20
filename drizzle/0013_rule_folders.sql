CREATE TABLE "rule_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "folder_id" integer;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_folder_id_rule_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."rule_folders"("id") ON DELETE set null ON UPDATE no action;