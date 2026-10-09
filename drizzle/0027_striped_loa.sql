CREATE TABLE "portfolio_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"price_usd" numeric(20, 6) NOT NULL,
	"sold_at" date NOT NULL,
	"cost_usd" numeric(20, 6) NOT NULL,
	"bought_at" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_sales" ADD CONSTRAINT "portfolio_sales_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portfolio_sales_user_idx" ON "portfolio_sales" USING btree ("user_id","sold_at");--> statement-breakpoint
CREATE INDEX "portfolio_sales_sale_idx" ON "portfolio_sales" USING btree ("sale_id");