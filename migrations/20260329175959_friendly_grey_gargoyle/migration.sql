CREATE TYPE "admin_role" AS ENUM('skill_verdict_admin', 'reviewer_admin');--> statement-breakpoint
CREATE TYPE "change_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "document_type" AS ENUM('payslip', 'contract', 'freelancer_link');--> statement-breakpoint
CREATE TYPE "metadata_action" AS ENUM('claimed', 'verdict_submitted', 'approved', 'rejected', 'flagged', 'overridden');--> statement-breakpoint
CREATE TYPE "verification_method" AS ENUM('document_upload', 'freelancer_link', 'identity_call');--> statement-breakpoint
CREATE TYPE "verification_section_type" AS ENUM('skill', 'experience', 'project', 'identity');--> statement-breakpoint
CREATE TYPE "verification_status" AS ENUM('pending', 'claimed', 'verdict_pending', 'approved', 'rejected', 'issue');--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL UNIQUE,
	"role" "admin_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_verification_settings" (
	"id" uuid PRIMARY KEY,
	"resume_id" uuid NOT NULL UNIQUE,
	"show_timeline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviewer_profile_change_requests" (
	"id" uuid PRIMARY KEY,
	"admin_id" uuid NOT NULL,
	"requested_first_name" text,
	"requested_title" text,
	"status" "change_request_status" DEFAULT 'pending'::"change_request_status" NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_admin_id" uuid,
	"rejection_reason" text
);
--> statement-breakpoint
CREATE TABLE "reviewer_profiles" (
	"id" uuid PRIMARY KEY,
	"admin_id" uuid NOT NULL UNIQUE,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"title" text NOT NULL,
	"public_profile_url" text NOT NULL UNIQUE,
	"consent_given" boolean DEFAULT false NOT NULL,
	"consent_given_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_documents" (
	"id" uuid PRIMARY KEY,
	"verification_request_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"document_type" "document_type" NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_metadata" (
	"id" uuid PRIMARY KEY,
	"verification_request_id" uuid NOT NULL,
	"admin_id" uuid NOT NULL,
	"admin_role" "admin_role" NOT NULL,
	"action" "metadata_action" NOT NULL,
	"notes" text,
	"reviewer_snapshot_first_name" text,
	"reviewer_snapshot_last_name" text,
	"reviewer_snapshot_title" text,
	"reviewer_public_profile_url" text,
	"acted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"resume_id" uuid,
	"section_type" "verification_section_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"item_label" text NOT NULL,
	"status" "verification_status" DEFAULT 'pending'::"verification_status" NOT NULL,
	"method" "verification_method",
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by_admin_id" uuid,
	"resolved_at" timestamp with time zone,
	"reviewer_note" text,
	"badge_visible" boolean DEFAULT true NOT NULL,
	"calendar_link_sent_at" timestamp with time zone,
	CONSTRAINT "verification_requests_user_id_resume_id_item_id_unique" UNIQUE("user_id","resume_id","item_id")
);
--> statement-breakpoint
CREATE INDEX "admin_roles_user_id_index" ON "admin_roles" ("user_id");--> statement-breakpoint
CREATE INDEX "reviewer_profile_change_requests_admin_id_index" ON "reviewer_profile_change_requests" ("admin_id");--> statement-breakpoint
CREATE INDEX "reviewer_profile_change_requests_status_index" ON "reviewer_profile_change_requests" ("status");--> statement-breakpoint
CREATE INDEX "reviewer_profiles_admin_id_index" ON "reviewer_profiles" ("admin_id");--> statement-breakpoint
CREATE INDEX "verification_documents_verification_request_id_index" ON "verification_documents" ("verification_request_id");--> statement-breakpoint
CREATE INDEX "verification_metadata_verification_request_id_index" ON "verification_metadata" ("verification_request_id");--> statement-breakpoint
CREATE INDEX "verification_metadata_admin_id_index" ON "verification_metadata" ("admin_id");--> statement-breakpoint
CREATE INDEX "verification_requests_user_id_index" ON "verification_requests" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_requests_resume_id_index" ON "verification_requests" ("resume_id");--> statement-breakpoint
CREATE INDEX "verification_requests_status_index" ON "verification_requests" ("status");--> statement-breakpoint
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resume_verification_settings" ADD CONSTRAINT "resume_verification_settings_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reviewer_profile_change_requests" ADD CONSTRAINT "reviewer_profile_change_requests_psq72m0MG070_fkey" FOREIGN KEY ("admin_id") REFERENCES "reviewer_profiles"("admin_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reviewer_profiles" ADD CONSTRAINT "reviewer_profiles_admin_id_user_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_FfL5PfMcY6MN_fkey" FOREIGN KEY ("verification_request_id") REFERENCES "verification_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "verification_metadata" ADD CONSTRAINT "verification_metadata_noOYdMdSYxZ2_fkey" FOREIGN KEY ("verification_request_id") REFERENCES "verification_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE SET NULL;