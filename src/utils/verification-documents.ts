export const ALLOWED_VERIFICATION_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

export const MAX_VERIFICATION_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

export function validateVerificationDocumentFile(file: File) {
  if (!ALLOWED_VERIFICATION_DOCUMENT_TYPES.includes(file.type as (typeof ALLOWED_VERIFICATION_DOCUMENT_TYPES)[number])) {
    throw new Error("Only PDF, JPG, JPEG, and PNG files are allowed");
  }

  if (file.size > MAX_VERIFICATION_DOCUMENT_SIZE_BYTES) {
    throw new Error("File size must be under 5MB");
  }
}
