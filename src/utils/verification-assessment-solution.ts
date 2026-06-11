export const ALLOWED_ASSESSMENT_SOLUTION_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/zip",
  "application/x-zip-compressed",
] as const;

export const MAX_ASSESSMENT_SOLUTION_SIZE_BYTES = 25 * 1024 * 1024;

export function validateAssessmentSolutionFile(file: File) {
  if (!ALLOWED_ASSESSMENT_SOLUTION_TYPES.includes(file.type as (typeof ALLOWED_ASSESSMENT_SOLUTION_TYPES)[number])) {
    throw new Error("Only PDF, JPG, JPEG, PNG, and ZIP files are allowed");
  }

  if (file.size > MAX_ASSESSMENT_SOLUTION_SIZE_BYTES) {
    throw new Error("File size must be under 25MB");
  }
}

export function hasAssessmentSolutionInput(input: { file?: File; solutionUrl?: string }) {
  return Boolean(input.file || input.solutionUrl?.trim());
}
