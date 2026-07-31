CREATE TABLE "candles_cache" (
	"symbol" text NOT NULL,
	"timeframe" text NOT NULL,
	"bars" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candles_cache_symbol_timeframe_pk" PRIMARY KEY("symbol","timeframe")
);
--> statement-breakpoint
CREATE TABLE "daily_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brief_date" date NOT NULL,
	"locale" text NOT NULL,
	"headline" text NOT NULL,
	"body_md" text NOT NULL,
	"generated_by" text DEFAULT 'rules' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earnings_calendar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"report_date" date NOT NULL,
	"hour" text,
	"eps_estimate" double precision,
	"eps_actual" double precision,
	"revenue_estimate" double precision,
	"revenue_actual" double precision,
	"quarter" integer,
	"year" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "economic_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_date" date NOT NULL,
	"event_time_et" text,
	"slug" text NOT NULL,
	"title_tr" text NOT NULL,
	"title_en" text NOT NULL,
	"importance" text DEFAULT 'medium' NOT NULL,
	"actual" text,
	"forecast" text,
	"previous" text,
	"unit" text,
	"fred_series_id" text,
	"source" text DEFAULT 'seed' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "macro_series" (
	"series_id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_tr" text NOT NULL,
	"title_en" text NOT NULL,
	"latest_value" double precision,
	"prev_value" double precision,
	"unit" text,
	"period_label" text,
	"observations" jsonb,
	"next_release_at" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_holidays" (
	"date" date PRIMARY KEY NOT NULL,
	"name_tr" text NOT NULL,
	"name_en" text NOT NULL,
	"early_close_et" text
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"headline" text NOT NULL,
	"summary" text,
	"url" text NOT NULL,
	"image_url" text,
	"source" text,
	"category" text,
	"symbols" text[],
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes_cache" (
	"symbol" text PRIMARY KEY NOT NULL,
	"price" double precision,
	"change" double precision,
	"change_pct" double precision,
	"open" double precision,
	"high" double precision,
	"low" double precision,
	"prev_close" double precision,
	"volume" double precision,
	"traded_at" timestamp with time zone,
	"source" text DEFAULT 'alpaca' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symbols" (
	"symbol" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"exchange" text,
	"sector" text,
	"industry" text,
	"logo_url" text,
	"description" text,
	"country" text,
	"currency" text DEFAULT 'USD',
	"market_cap" double precision,
	"share_outstanding" double precision,
	"ipo_date" date,
	"weburl" text,
	"is_index_proxy" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"locale" text DEFAULT 'tr' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchlist_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'primary' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_briefs_date_locale_key" ON "daily_briefs" USING btree ("brief_date","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "earnings_symbol_date_key" ON "earnings_calendar" USING btree ("symbol","report_date");--> statement-breakpoint
CREATE INDEX "earnings_date_idx" ON "earnings_calendar" USING btree ("report_date");--> statement-breakpoint
CREATE UNIQUE INDEX "economic_events_slug_date_key" ON "economic_events" USING btree ("slug","event_date");--> statement-breakpoint
CREATE INDEX "economic_events_date_idx" ON "economic_events" USING btree ("event_date");--> statement-breakpoint
CREATE UNIQUE INDEX "news_provider_id_key" ON "news" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "news_published_idx" ON "news" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_items_unique" ON "watchlist_items" USING btree ("watchlist_id","symbol");--> statement-breakpoint
CREATE INDEX "watchlist_items_symbol_idx" ON "watchlist_items" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "watchlists_user_idx" ON "watchlists" USING btree ("user_id","sort_order");