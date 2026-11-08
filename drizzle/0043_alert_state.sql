CREATE TABLE "percent_alert_state" (
	"alert_id" uuid PRIMARY KEY NOT NULL,
	"armed_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"notify_attempts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_alert_state" (
	"alert_id" uuid PRIMARY KEY NOT NULL,
	"armed_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"notify_attempts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "percent_alert_state" ADD CONSTRAINT "percent_alert_state_alert_id_percent_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."percent_alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alert_state" ADD CONSTRAINT "price_alert_state_alert_id_price_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."price_alerts"("id") ON DELETE cascade ON UPDATE no action;