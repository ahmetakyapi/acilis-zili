CREATE TABLE "earnings_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"period" text NOT NULL,
	"report_date" date NOT NULL,
	"choice" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "earnings_votes" ADD CONSTRAINT "earnings_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "earnings_votes_user_target_key" ON "earnings_votes" USING btree ("user_id","symbol","period");--> statement-breakpoint
CREATE INDEX "earnings_votes_target_idx" ON "earnings_votes" USING btree ("symbol","period");--> statement-breakpoint
CREATE INDEX "earnings_votes_report_idx" ON "earnings_votes" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX "earnings_votes_user_report_idx" ON "earnings_votes" USING btree ("user_id","report_date");