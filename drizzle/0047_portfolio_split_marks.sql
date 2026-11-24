CREATE TABLE "portfolio_split_marks" (
	"position_id" uuid PRIMARY KEY NOT NULL,
	"through" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_split_marks" ADD CONSTRAINT "portfolio_split_marks_position_id_portfolio_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."portfolio_positions"("id") ON DELETE cascade ON UPDATE no action;