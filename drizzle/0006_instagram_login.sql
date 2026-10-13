CREATE TABLE "instagram_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"app_scoped_id" text,
	"username" text NOT NULL,
	"name" text,
	"account_type" text,
	"access_token" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"token_expiry_estimated" boolean DEFAULT false NOT NULL,
	"token_refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token_checked_at" timestamp with time zone,
	"subscribed" boolean DEFAULT false NOT NULL,
	"last_error" text,
	"last_comment_webhook_at" timestamp with time zone,
	"last_messaging_webhook_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD COLUMN "source" text;--> statement-breakpoint
CREATE INDEX "instagram_accounts_app_scoped_idx" ON "instagram_accounts" USING btree ("app_scoped_id");