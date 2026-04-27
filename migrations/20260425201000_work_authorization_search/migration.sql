ALTER TABLE "resume"
ADD COLUMN IF NOT EXISTS "work_auth_eu_status" text NOT NULL DEFAULT 'prefer_not_to_say',
ADD COLUMN IF NOT EXISTS "work_auth_usa_status" text NOT NULL DEFAULT 'prefer_not_to_say',
ADD COLUMN IF NOT EXISTS "work_auth_uk_status" text NOT NULL DEFAULT 'prefer_not_to_say',
ADD COLUMN IF NOT EXISTS "work_auth_eu_sponsorship_required" text NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS "work_auth_usa_sponsorship_required" text NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS "work_auth_uk_sponsorship_required" text NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS "work_auth_consent_to_share" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "work_auth_updated_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "work_auth_search_tokens" text[] NOT NULL DEFAULT '{}';

UPDATE "resume"
SET
  "work_auth_eu_status" = COALESCE("data"->'workAuthorization'->'eu'->>'status', 'prefer_not_to_say'),
  "work_auth_usa_status" = COALESCE("data"->'workAuthorization'->'usa'->>'status', 'prefer_not_to_say'),
  "work_auth_uk_status" = COALESCE("data"->'workAuthorization'->'uk'->>'status', 'prefer_not_to_say'),
  "work_auth_eu_sponsorship_required" = COALESCE("data"->'workAuthorization'->'eu'->>'sponsorshipRequired', 'unknown'),
  "work_auth_usa_sponsorship_required" = COALESCE("data"->'workAuthorization'->'usa'->>'sponsorshipRequired', 'unknown'),
  "work_auth_uk_sponsorship_required" = COALESCE("data"->'workAuthorization'->'uk'->>'sponsorshipRequired', 'unknown'),
  "work_auth_consent_to_share" = (
    COALESCE(("data"->'workAuthorization'->'eu'->>'consentToShareWithEmployers')::boolean, false)
    OR COALESCE(("data"->'workAuthorization'->'usa'->>'consentToShareWithEmployers')::boolean, false)
    OR COALESCE(("data"->'workAuthorization'->'uk'->>'consentToShareWithEmployers')::boolean, false)
    OR COALESCE(("data"->'workAuthorization'->>'consentToShareWithEmployers')::boolean, false)
  ),
  "work_auth_updated_at" = (
    SELECT MAX(ts)
    FROM (
      VALUES
        (NULLIF("data"->'workAuthorization'->'eu'->>'updatedAt', '')::timestamp with time zone),
        (NULLIF("data"->'workAuthorization'->'usa'->>'updatedAt', '')::timestamp with time zone),
        (NULLIF("data"->'workAuthorization'->'uk'->>'updatedAt', '')::timestamp with time zone),
        (NULLIF("data"->'workAuthorization'->>'updatedAt', '')::timestamp with time zone)
    ) AS timestamps(ts)
  ),
  "work_auth_search_tokens" = COALESCE(
    ARRAY(
      SELECT DISTINCT token
      FROM (
        SELECT jsonb_array_elements_text(COALESCE("data"->'workAuthorization'->'eu'->'searchTokens', '[]'::jsonb)) AS token
        UNION
        SELECT jsonb_array_elements_text(COALESCE("data"->'workAuthorization'->'usa'->'searchTokens', '[]'::jsonb)) AS token
        UNION
        SELECT jsonb_array_elements_text(COALESCE("data"->'workAuthorization'->'uk'->'searchTokens', '[]'::jsonb)) AS token
        UNION
        SELECT jsonb_array_elements_text(COALESCE("data"->'workAuthorization'->'searchTokens', '[]'::jsonb)) AS token
      ) AS tokens
    ),
    ARRAY[]::text[]
  );

CREATE INDEX IF NOT EXISTS "resume_work_auth_eu_status_idx" ON "resume" ("work_auth_consent_to_share", "work_auth_eu_status");
CREATE INDEX IF NOT EXISTS "resume_work_auth_usa_status_idx" ON "resume" ("work_auth_consent_to_share", "work_auth_usa_status");
CREATE INDEX IF NOT EXISTS "resume_work_auth_uk_status_idx" ON "resume" ("work_auth_consent_to_share", "work_auth_uk_status");
CREATE INDEX IF NOT EXISTS "resume_work_auth_search_tokens_idx" ON "resume" ("work_auth_consent_to_share", "work_auth_search_tokens");
CREATE INDEX IF NOT EXISTS "resume_work_auth_updated_at_idx" ON "resume" ("work_auth_updated_at");
