CREATE TABLE "congress_filings" (
	"doc_id" text PRIMARY KEY NOT NULL,
	"member" text NOT NULL,
	"filed_at" date NOT NULL,
	"trade_count" integer NOT NULL,
	"parsed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "congress_trades" (
	"doc_id" text NOT NULL,
	"row_no" integer NOT NULL,
	"member" text NOT NULL,
	"ticker" text,
	"asset" text NOT NULL,
	"asset_type" text,
	"tx_type" text NOT NULL,
	"tx_date" date NOT NULL,
	"notified_date" date,
	"amount_low" double precision,
	"amount_high" double precision,
	"owner" text,
	"description" text,
	CONSTRAINT "congress_trades_doc_id_row_no_pk" PRIMARY KEY("doc_id","row_no")
);
--> statement-breakpoint
CREATE TABLE "cusip_tickers" (
	"cusip" text PRIMARY KEY NOT NULL,
	"ticker" text,
	"figi" text,
	"name" text,
	"security_type" text,
	"resolved_at" timestamp with time zone,
	"tried_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investor" text NOT NULL,
	"cik" integer NOT NULL,
	"accession" text NOT NULL,
	"form" text NOT NULL,
	"amendment" text,
	"period" date NOT NULL,
	"filed_at" date NOT NULL,
	"value_total" double precision NOT NULL,
	"entry_count" integer NOT NULL,
	"value_scaled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_holdings" (
	"filing_id" uuid NOT NULL,
	"cusip" text NOT NULL,
	"position" text NOT NULL,
	"issuer" text NOT NULL,
	"title_of_class" text,
	"amount" double precision NOT NULL,
	"amount_type" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "investor_holdings_filing_id_cusip_position_pk" PRIMARY KEY("filing_id","cusip","position")
);
--> statement-breakpoint
ALTER TABLE "congress_trades" ADD CONSTRAINT "congress_trades_doc_id_congress_filings_doc_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."congress_filings"("doc_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_holdings" ADD CONSTRAINT "investor_holdings_filing_id_investor_filings_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."investor_filings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "congress_trades_member_date_idx" ON "congress_trades" USING btree ("member","tx_date");--> statement-breakpoint
CREATE INDEX "congress_trades_ticker_idx" ON "congress_trades" USING btree ("ticker");--> statement-breakpoint
CREATE UNIQUE INDEX "investor_filings_accession_unique" ON "investor_filings" USING btree ("accession");--> statement-breakpoint
CREATE INDEX "investor_filings_investor_period_idx" ON "investor_filings" USING btree ("investor","period");--> statement-breakpoint
CREATE INDEX "investor_holdings_cusip_idx" ON "investor_holdings" USING btree ("cusip");