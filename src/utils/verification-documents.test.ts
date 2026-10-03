import { describe, expect, it } from "vite-plus/test";

import { MAX_VERIFICATION_DOCUMENT_SIZE_BYTES, validateVerificationDocumentFile } from "./verification-documents";

function file(type: string, size: number): File {
  return { type, size } as File;
}

describe("validateVerificationDocumentFile", () => {
  it("accepts PDF, JPEG, and PNG under the size cap", () => {
    expect(() => validateVerificationDocumentFile(file("application/pdf", 1024))).not.toThrow();
    expect(() => validateVerificationDocumentFile(file("image/jpeg", 1024))).not.toThrow();
    expect(() =>
      validateVerificationDocumentFile(file("image/png", MAX_VERIFICATION_DOCUMENT_SIZE_BYTES)),
    ).not.toThrow();
  });

  it("rejects other types and files over the cap", () => {
    expect(() => validateVerificationDocumentFile(file("text/plain", 10))).toThrow(/PDF, JPG, JPEG, and PNG/);
    expect(() =>
      validateVerificationDocumentFile(file("application/pdf", MAX_VERIFICATION_DOCUMENT_SIZE_BYTES + 1)),
    ).toThrow(/under 5MB/);
  });
});
