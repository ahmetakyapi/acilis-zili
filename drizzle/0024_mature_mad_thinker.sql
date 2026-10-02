CREATE TABLE "analyst_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"as_of" date NOT NULL,
	"mean" double precision NOT NULL,
	"median" double precision,
	"high" double precision,
	"low" double precision,
	"analyst_count" integer,
	"source" text NOT NULL,
	"source_url" text,
	"price_at_write" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "analyst_targets_symbol_day_key" ON "analyst_targets" USING btree ("symbol","as_of");--> statement-breakpoint
CREATE INDEX "analyst_targets_symbol_idx" ON "analyst_targets" USING btree ("symbol");