ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "privacy_policy_accepted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "privacy_policy_version" text;
--> statement-breakpoint
UPDATE "user"
SET "privacy_policy_accepted_at" = "created_at"
WHERE "privacy_policy_accepted_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "privacy_policy_accepted_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "privacy_policy_accepted_at" SET NOT NULL;