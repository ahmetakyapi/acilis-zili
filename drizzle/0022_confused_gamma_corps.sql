CREATE TABLE "ark_holdings" (
	"as_of" date NOT NULL,
	"fund" text NOT NULL,
	"cusip" text NOT NULL,
	"ticker" text,
	"company" text NOT NULL,
	"shares" double precision NOT NULL,
	"market_value" double precision NOT NULL,
	"weight" double precision NOT NULL,
	CONSTRAINT "ark_holdings_as_of_fund_cusip_pk" PRIMARY KEY("as_of","fund","cusip")
);
--> statement-breakpoint
CREATE INDEX "ark_holdings_ticker_idx" ON "ark_holdings" USING btree ("ticker");