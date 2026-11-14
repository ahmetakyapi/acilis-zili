ALTER TABLE "portfolio_positions" ADD CONSTRAINT "portfolio_positions_quantity_positive" CHECK ("portfolio_positions"."quantity" > 0) NOT VALID;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "portfolio_positions" WHERE "quantity" <= 0) THEN
    ALTER TABLE "portfolio_positions" VALIDATE CONSTRAINT "portfolio_positions_quantity_positive";
  END IF;
END $$;
