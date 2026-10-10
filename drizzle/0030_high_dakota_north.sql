CREATE TABLE "ai_analysis_access" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"daily_limit" integer DEFAULT 5,
	"used_day" date,
	"used_count" integer DEFAULT 0 NOT NULL,
	"lock_id" uuid,
	"lock_until" timestamp with time zone,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_analysis_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"admin_id" uuid,
	"enabled" boolean NOT NULL,
	"daily_limit" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_analysis_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"horizon" text NOT NULL,
	"locale" text NOT NULL,
	"status" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_analysis_access" ADD CONSTRAINT "ai_analysis_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_access" ADD CONSTRAINT "ai_analysis_access_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_audit" ADD CONSTRAINT "ai_analysis_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_audit" ADD CONSTRAINT "ai_analysis_audit_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_requests" ADD CONSTRAINT "ai_analysis_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_analysis_requests_user_created_idx" ON "ai_analysis_requests" USING btree ("user_id","created_at");--> statement-breakpoint
-- Yalnızca mevcut yönetici hesabına, kalıcı kullanıcı kimliği üzerinden sınırsız hak.
INSERT INTO ai_analysis_access (user_id, enabled, daily_limit, updated_by)
SELECT id, true, NULL, id FROM users WHERE username = 'ahmetakyapi' AND role = 'admin'
ON CONFLICT (user_id) DO NOTHING;
