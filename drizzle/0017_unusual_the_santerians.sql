CREATE TABLE "technical_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"session_date" date NOT NULL,
	"slot" text NOT NULL,
	"stance" text NOT NULL,
	"entry_low" double precision,
	"entry_high" double precision,
	"stop" double precision,
	"targets" jsonb NOT NULL,
	"supports" jsonb NOT NULL,
	"resistances" jsonb NOT NULL,
	"copy" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"generated_by" text DEFAULT 'claude' NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "technical_analyses_key" ON "technical_analyses" USING btree ("symbol","session_date","slot");--> statement-breakpoint
CREATE INDEX "technical_analyses_session_idx" ON "technical_analyses" USING btree ("session_date");