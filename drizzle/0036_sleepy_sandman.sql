CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_prefs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"alerts" boolean DEFAULT false NOT NULL,
	"weekly" boolean DEFAULT false NOT NULL,
	"confirmed_email" text,
	"confirmed_at" timestamp with time zone,
	"confirm_token_hash" text,
	"confirm_expires_at" timestamp with time zone,
	"unsub_token" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_prefs" ADD CONSTRAINT "email_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_log_dedupe_key" ON "email_log" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "email_log_sent_idx" ON "email_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "email_log_user_idx" ON "email_log" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_prefs_unsub_key" ON "email_prefs" USING btree ("unsub_token");--> statement-breakpoint
CREATE UNIQUE INDEX "email_prefs_confirm_key" ON "email_prefs" USING btree ("confirm_token_hash");