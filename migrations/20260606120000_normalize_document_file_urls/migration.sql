UPDATE "verification_documents"
SET "file_url" = regexp_replace("file_url", '^https?://[^/]+/', '')
WHERE "file_url" LIKE 'http%' AND "document_type" != 'freelancer_link';
