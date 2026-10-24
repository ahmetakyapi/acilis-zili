CREATE TABLE "daily_charts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chart_date" date NOT NULL,
	"locale" text DEFAULT 'tr' NOT NULL,
	"title" text NOT NULL,
	"chart_md" text NOT NULL,
	"body_md" text NOT NULL,
	"sources" jsonb,
	"generated_by" text DEFAULT 'claude' NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_charts_date_locale_key" ON "daily_charts" USING btree ("chart_date","locale");--> statement-breakpoint
CREATE INDEX "daily_charts_date_idx" ON "daily_charts" USING btree ("chart_date");