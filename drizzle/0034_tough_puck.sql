CREATE TABLE "user_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"locale" text DEFAULT 'tr' NOT NULL,
	"title" text NOT NULL,
	"dek" text NOT NULL,
	"body_md" text NOT NULL,
	"symbols" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_posts" ADD CONSTRAINT "user_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_posts_slug_key" ON "user_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "user_posts_user_idx" ON "user_posts" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "user_posts_status_idx" ON "user_posts" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "user_posts_published_idx" ON "user_posts" USING btree ("status","published_at");