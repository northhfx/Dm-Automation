CREATE TABLE "link_checks" (
	"url" text PRIMARY KEY NOT NULL,
	"ok" boolean NOT NULL,
	"status" integer,
	"error" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
