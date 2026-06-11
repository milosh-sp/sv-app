ALTER TYPE "document_type" ADD VALUE 'assessment_solution';--> statement-breakpoint
ALTER TYPE "document_type" ADD VALUE 'assessment_solution_link';--> statement-breakpoint
ALTER TYPE "metadata_action" ADD VALUE 'solution_submitted' BEFORE 'verified';