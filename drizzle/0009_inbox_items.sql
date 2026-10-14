CREATE TABLE "inbox_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"page_id" text NOT NULL,
	"kind" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_name" text,
	"sender_username" text,
	"text" text DEFAULT '' NOT NULL,
	"mid" text,
	"post_id" text,
	"comment_id" text,
	"permalink" text,
	"details_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "inbox_items_open_idx" ON "inbox_items" USING btree ("handled_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inbox_items_created_idx" ON "inbox_items" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inbox_items_sender_idx" ON "inbox_items" USING btree ("platform","sender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_items_comment_idx" ON "inbox_items" USING btree ("kind","comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_items_mid_idx" ON "inbox_items" USING btree ("kind","mid");