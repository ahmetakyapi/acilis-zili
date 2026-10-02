CREATE TABLE "portfolio_order" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"position_ids" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_order" ADD CONSTRAINT "portfolio_order_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;