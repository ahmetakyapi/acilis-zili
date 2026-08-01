DROP INDEX "daily_briefs_date_locale_key";--> statement-breakpoint
ALTER TABLE "daily_briefs" ADD COLUMN "period" text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_briefs_date_locale_period_key" ON "daily_briefs" USING btree ("brief_date","locale","period");