CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"route" text NOT NULL,
	"locale" text NOT NULL,
	"referrer_host" text,
	"device" text NOT NULL,
	"signed_in" boolean DEFAULT false NOT NULL,
	"visitor_hash" text NOT NULL,
	"viewed_on" date NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE INDEX "page_views_day_idx" ON "page_views" USING btree ("viewed_on");--> statement-breakpoint
CREATE INDEX "page_views_route_idx" ON "page_views" USING btree ("viewed_on","route");--> statement-breakpoint
CREATE INDEX "page_views_path_idx" ON "page_views" USING btree ("viewed_on","path");--> statement-breakpoint
CREATE INDEX "page_views_visitor_idx" ON "page_views" USING btree ("viewed_on","visitor_hash");