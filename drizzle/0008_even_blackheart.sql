CREATE TABLE "earnings_analysis_cards" (
	"symbol" text NOT NULL,
	"period" text NOT NULL,
	"locale" text DEFAULT 'tr' NOT NULL,
	"mime_type" text DEFAULT 'image/png' NOT NULL,
	"data_base64" text NOT NULL,
	"width" integer,
	"height" integer,
	"byte_size" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "earnings_analysis_cards_symbol_period_locale_pk" PRIMARY KEY("symbol","period","locale")
);
