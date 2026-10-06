CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"platform_user_id" text NOT NULL,
	"page_id" text NOT NULL,
	"name" text,
	"username" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_inbound_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dedup_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"platform" text,
	"page_id" text,
	"rule_id" integer,
	"contact_id" integer,
	"actor_id" text,
	"post_id" text,
	"text" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"target_url" text NOT NULL,
	"rule_id" integer,
	"contact_id" integer,
	"platform" text,
	"clicks" integer DEFAULT 0 NOT NULL,
	"first_clicked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"page_id" text NOT NULL,
	"contact_id" integer,
	"rule_id" integer,
	"source" text NOT NULL,
	"mid" text,
	"status" text NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"access_token" text NOT NULL,
	"ig_user_id" text,
	"ig_username" text,
	"subscribed" boolean DEFAULT false NOT NULL,
	"last_error" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"trigger" text NOT NULL,
	"platforms" text[] NOT NULL,
	"match_type" text DEFAULT 'contains' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"post_ids" text[] DEFAULT '{}' NOT NULL,
	"public_replies" text[] DEFAULT '{}' NOT NULL,
	"dm_text" text NOT NULL,
	"link_url" text,
	"once_per_user" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"object" text,
	"body" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_platform_user_idx" ON "contacts" USING btree ("platform","platform_user_id");--> statement-breakpoint
CREATE INDEX "contacts_first_seen_idx" ON "contacts" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "events_type_created_idx" ON "events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "events_rule_created_idx" ON "events" USING btree ("rule_id","created_at");--> statement-breakpoint
CREATE INDEX "events_created_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_run_at_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "links_code_idx" ON "links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "links_rule_idx" ON "links" USING btree ("rule_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_sent_at_idx" ON "messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "messages_rule_idx" ON "messages" USING btree ("rule_id","sent_at");--> statement-breakpoint
CREATE INDEX "messages_contact_idx" ON "messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "messages_mid_idx" ON "messages" USING btree ("mid");--> statement-breakpoint
CREATE INDEX "webhook_logs_received_idx" ON "webhook_logs" USING btree ("received_at");