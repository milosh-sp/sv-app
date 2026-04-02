CREATE TABLE "global_job_search_settings" (
	"id" text PRIMARY KEY DEFAULT 'default',
	"api_key" text NOT NULL,
	"connection_test_ok" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "global_job_search_settings" ADD CONSTRAINT "global_job_search_settings_updated_by_user_id_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;
