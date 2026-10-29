CREATE TABLE "puzzle_players" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"nickname" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "puzzle_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"guesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'playing' NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "puzzle_players" ADD CONSTRAINT "puzzle_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puzzle_runs" ADD CONSTRAINT "puzzle_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "puzzle_runs_user_day_key" ON "puzzle_runs" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "puzzle_runs_day_idx" ON "puzzle_runs" USING btree ("day","status");