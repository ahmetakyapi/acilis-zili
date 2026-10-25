CREATE TABLE "probability_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "probability_snapshots_taken_idx" ON "probability_snapshots" USING btree ("taken_at");