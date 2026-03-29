ALTER TABLE "verification_metadata" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
UPDATE "verification_metadata" SET "action" = 'verified' WHERE "action" = 'approved';--> statement-breakpoint
DROP TYPE "metadata_action";--> statement-breakpoint
CREATE TYPE "metadata_action" AS ENUM('claimed', 'verdict_submitted', 'verified', 'rejected', 'flagged', 'overridden');--> statement-breakpoint
ALTER TABLE "verification_metadata" ALTER COLUMN "action" SET DATA TYPE "metadata_action" USING "action"::"metadata_action";--> statement-breakpoint
ALTER TABLE "verification_requests" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "verification_requests" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
UPDATE "verification_requests" SET "status" = 'verified' WHERE "status" = 'approved';--> statement-breakpoint
DROP TYPE "verification_status";--> statement-breakpoint
CREATE TYPE "verification_status" AS ENUM('pending', 'claimed', 'verdict_pending', 'verified', 'rejected', 'issue');--> statement-breakpoint
ALTER TABLE "verification_requests" ALTER COLUMN "status" SET DATA TYPE "verification_status" USING "status"::"verification_status";--> statement-breakpoint
ALTER TABLE "verification_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::"verification_status";