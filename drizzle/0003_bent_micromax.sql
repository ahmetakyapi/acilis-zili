CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"locale" text DEFAULT 'tr' NOT NULL,
	"title" text NOT NULL,
	"dek" text NOT NULL,
	"body_md" text NOT NULL,
	"event_date" date NOT NULL,
	"symbols" jsonb,
	"sources" jsonb,
	"read_minutes" integer,
	"generated_by" text DEFAULT 'claude' NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "stories_slug_locale_key" ON "stories" USING btree ("slug","locale");--> statement-breakpoint
CREATE INDEX "stories_event_date_idx" ON "stories" USING btree ("event_date");