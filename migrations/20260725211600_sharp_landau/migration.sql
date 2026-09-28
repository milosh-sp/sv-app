CREATE TYPE "company_contact_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "company_saved_list_type" AS ENUM('favorite', 'to_contact');--> statement-breakpoint
ALTER TYPE "admin_role" ADD VALUE 'company';--> statement-breakpoint
CREATE TABLE "company_contact_requests" (
	"id" uuid PRIMARY KEY,
	"company_user_id" uuid NOT NULL,
	"candidate_user_id" uuid NOT NULL,
	"resume_id" uuid,
	"status" "company_contact_status" DEFAULT 'pending'::"company_contact_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "company_saved_candidates" (
	"id" uuid PRIMARY KEY,
	"company_user_id" uuid NOT NULL,
	"candidate_user_id" uuid NOT NULL,
	"resume_id" uuid,
	"list_type" "company_saved_list_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "company_contact_requests_company_user_id_index" ON "company_contact_requests" ("company_user_id");--> statement-breakpoint
CREATE INDEX "company_contact_requests_candidate_user_id_index" ON "company_contact_requests" ("candidate_user_id");--> statement-breakpoint
CREATE INDEX "company_contact_requests_status_index" ON "company_contact_requests" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "company_contact_requests_pending_pair" ON "company_contact_requests" ("company_user_id","candidate_user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "company_saved_candidates_company_user_id_index" ON "company_saved_candidates" ("company_user_id");--> statement-breakpoint
CREATE INDEX "company_saved_candidates_candidate_user_id_index" ON "company_saved_candidates" ("candidate_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_saved_candidates_pair_list" ON "company_saved_candidates" ("company_user_id","candidate_user_id","list_type");--> statement-breakpoint
ALTER TABLE "company_contact_requests" ADD CONSTRAINT "company_contact_requests_company_user_id_user_id_fkey" FOREIGN KEY ("company_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "company_contact_requests" ADD CONSTRAINT "company_contact_requests_candidate_user_id_user_id_fkey" FOREIGN KEY ("candidate_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "company_contact_requests" ADD CONSTRAINT "company_contact_requests_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "company_saved_candidates" ADD CONSTRAINT "company_saved_candidates_company_user_id_user_id_fkey" FOREIGN KEY ("company_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "company_saved_candidates" ADD CONSTRAINT "company_saved_candidates_candidate_user_id_user_id_fkey" FOREIGN KEY ("candidate_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "company_saved_candidates" ADD CONSTRAINT "company_saved_candidates_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE SET NULL;