import { describe, expect, it } from "vite-plus/test";

import {
  ALLOWED_ASSESSMENT_SOLUTION_TYPES,
  hasAssessmentSolutionInput,
  MAX_ASSESSMENT_SOLUTION_SIZE_BYTES,
  validateAssessmentSolutionFile,
} from "./verification-assessment-solution";

describe("verification assessment solution validation", () => {
  it("accepts PDF, image, and ZIP file types", () => {
    expect(ALLOWED_ASSESSMENT_SOLUTION_TYPES).toContain("application/pdf");
    expect(ALLOWED_ASSESSMENT_SOLUTION_TYPES).toContain("application/zip");
    expect(ALLOWED_ASSESSMENT_SOLUTION_TYPES).toContain("application/x-zip-compressed");
  });

  it("allows a 25MB max file size", () => {
    expect(MAX_ASSESSMENT_SOLUTION_SIZE_BYTES).toBe(25 * 1024 * 1024);
  });

  it("requires at least one of file or solution URL", () => {
    expect(hasAssessmentSolutionInput({})).toBe(false);
    expect(hasAssessmentSolutionInput({ file: new File(["a"], "a.pdf", { type: "application/pdf" }) })).toBe(true);
    expect(hasAssessmentSolutionInput({ solutionUrl: "https://github.com/you/repo" })).toBe(true);
    expect(
      hasAssessmentSolutionInput({
        file: new File(["a"], "a.pdf", { type: "application/pdf" }),
        solutionUrl: "https://github.com/you/repo",
      }),
    ).toBe(true);
  });

  it("rejects unsupported file types", () => {
    const file = new File(["a"], "notes.txt", { type: "text/plain" });
    expect(() => validateAssessmentSolutionFile(file)).toThrow("Only PDF, JPG, JPEG, PNG, and ZIP files are allowed");
  });

  it("rejects files larger than 25MB", () => {
    const file = new File([new Uint8Array(MAX_ASSESSMENT_SOLUTION_SIZE_BYTES + 1)], "big.zip", {
      type: "application/zip",
    });
    expect(() => validateAssessmentSolutionFile(file)).toThrow("File size must be under 25MB");
  });
});
