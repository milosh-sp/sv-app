CREATE TABLE "global_ai_settings" (
	"id" text PRIMARY KEY DEFAULT 'default',
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"api_key" text NOT NULL,
	"base_url" text DEFAULT '' NOT NULL,
	"connection_test_ok" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "global_ai_settings" ADD CONSTRAINT "global_ai_settings_updated_by_user_id_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;