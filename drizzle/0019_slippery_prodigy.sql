ALTER TABLE "user_avatars" ALTER COLUMN "icon" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_avatars" ADD COLUMN "color" text;