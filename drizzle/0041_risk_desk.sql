CREATE TABLE "risk_access" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "risk_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"session" date NOT NULL,
	"message" text NOT NULL,
	"symbols" jsonb NOT NULL,
	"delivered" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"tone" text NOT NULL,
	"symbol" text,
	"conditions" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"last_session" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "risk_access" ADD CONSTRAINT "risk_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_access" ADD CONSTRAINT "risk_access_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_rule_id_risk_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."risk_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_rules" ADD CONSTRAINT "risk_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "risk_alerts_rule_session_key" ON "risk_alerts" USING btree ("rule_id","session");--> statement-breakpoint
CREATE INDEX "risk_alerts_user_idx" ON "risk_alerts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "risk_rules_user_idx" ON "risk_rules" USING btree ("user_id");