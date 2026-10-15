CREATE TABLE "chat_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"page_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"text" text NOT NULL,
	"mid" text,
	"status" text NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chat_replies_thread_idx" ON "chat_replies" USING btree ("platform","page_id","recipient_id","sent_at");--> statement-breakpoint
CREATE INDEX "chat_replies_sent_at_idx" ON "chat_replies" USING btree ("sent_at");