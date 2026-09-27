CREATE TABLE "app_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"kind" text NOT NULL,
	"route" text NOT NULL,
	"digest" text,
	"fingerprint" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"count" integer DEFAULT 1 NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earnings_analysis_extras" (
	"analysis_id" uuid PRIMARY KEY NOT NULL,
	"takeaways" jsonb,
	"segments" jsonb,
	"segments_source" text,
	"kpis" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"cost_usd" numeric(20, 6) NOT NULL,
	"bought_at" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symbol_metrics" (
	"symbol" text PRIMARY KEY NOT NULL,
	"sector" text,
	"currency" text,
	"metrics" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "earnings_analysis_extras" ADD CONSTRAINT "earnings_analysis_extras_analysis_id_earnings_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."earnings_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_positions" ADD CONSTRAINT "portfolio_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_errors_unique" ON "app_errors" USING btree ("day","kind","route","fingerprint");--> statement-breakpoint
CREATE INDEX "app_errors_last_idx" ON "app_errors" USING btree ("last_at");--> statement-breakpoint
CREATE INDEX "portfolio_positions_user_idx" ON "portfolio_positions" USING btree ("user_id","bought_at");--> statement-breakpoint
CREATE INDEX "symbol_metrics_sector_idx" ON "symbol_metrics" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "symbol_metrics_updated_idx" ON "symbol_metrics" USING btree ("updated_at");