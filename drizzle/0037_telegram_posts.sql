CREATE TABLE "telegram_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedupe_key" text NOT NULL,
	"kind" text NOT NULL,
	"locale" text NOT NULL,
	"status" text DEFAULT 'claimed' NOT NULL,
	"message_id" integer,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_posts_dedupe_key" ON "telegram_posts" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "telegram_posts_created_idx" ON "telegram_posts" USING btree ("created_at");