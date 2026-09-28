CREATE TABLE "tax_tariffs" (
	"year" integer PRIMARY KEY NOT NULL,
	"brackets" jsonb NOT NULL,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
