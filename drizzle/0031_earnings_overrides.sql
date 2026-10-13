CREATE TABLE "earnings_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"report_date" date NOT NULL,
	"timing" text NOT NULL,
	"source_url" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"closed_reason" text,
	"provider_date" date,
	"provider_hour" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "earnings_overrides_symbol_date_key" ON "earnings_overrides" USING btree ("symbol","report_date");--> statement-breakpoint
CREATE INDEX "earnings_overrides_status_idx" ON "earnings_overrides" USING btree ("status");