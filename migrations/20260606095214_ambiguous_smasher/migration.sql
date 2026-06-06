CREATE TYPE "proposed_verdict" AS ENUM('verified', 'rejected', 'issue');--> statement-breakpoint
ALTER TYPE "document_type" ADD VALUE 'assessment_instructions';--> statement-breakpoint
ALTER TABLE "verification_requests" ADD COLUMN "proposed_verdict" "proposed_verdict";--> statement-breakpoint
ALTER TABLE "verification_requests" ADD COLUMN "assessment_accepted_at" timestamp with time zone;