import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: unknown }) => children ?? null,
}));

import { hasAssessmentSolutionInput } from "@/utils/verification-assessment-solution";

import {
  blocksNewVerificationRequest,
  canRetryVerification,
  countVerifiedItems,
  findVerificationItemStatus,
  verificationDisplayStatus,
  verificationDocumentRejection,
  visibleExperienceItems,
  visibleNamedItems,
} from "./index";

describe("verification dashboard rules", () => {
  it("rejects a document with the wrong type or a size over 5MB", () => {
    expect(verificationDocumentRejection({ type: "application/pdf", size: 1024 })).toBeNull();
    expect(verificationDocumentRejection({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(verificationDocumentRejection({ type: "image/png", size: 5 * 1024 * 1024 })).toBeNull();
    expect(verificationDocumentRejection({ type: "text/plain", size: 10 })).toBe("type");
    expect(verificationDocumentRejection({ type: "application/pdf", size: 5 * 1024 * 1024 + 1 })).toBe("size");
  });

  it("labels claimed and verdict_pending reviews", () => {
    expect(verificationDisplayStatus("claimed")).toBe("assessment in progress");
    expect(verificationDisplayStatus("verdict_pending")).toBe("awaiting final review");
    expect(verificationDisplayStatus("verified")).toBe("verified");
    expect(verificationDisplayStatus("rejected")).toBe("rejected");
    expect(verificationDisplayStatus("pending")).toBe("pending");
  });

  it("blocks a new request unless the previous one can be retried", () => {
    expect(blocksNewVerificationRequest("pending")).toBe(true);
    expect(blocksNewVerificationRequest("claimed")).toBe(true);
    expect(blocksNewVerificationRequest("verdict_pending")).toBe(true);
    expect(blocksNewVerificationRequest("verified")).toBe(true);
    expect(blocksNewVerificationRequest("rejected")).toBe(false);
    expect(blocksNewVerificationRequest("issue")).toBe(false);
    expect(blocksNewVerificationRequest(undefined)).toBe(false);
    expect(canRetryVerification("rejected")).toBe(true);
    expect(canRetryVerification("issue")).toBe(true);
    expect(canRetryVerification("pending")).toBe(false);
    expect(canRetryVerification(undefined)).toBe(false);
  });

  it("requires a file or a solution url", () => {
    expect(hasAssessmentSolutionInput({})).toBe(false);
    expect(hasAssessmentSolutionInput({ solutionUrl: "   " })).toBe(false);
    expect(hasAssessmentSolutionInput({ file: new File(["a"], "solution.zip", { type: "application/zip" }) })).toBe(
      true,
    );
    expect(hasAssessmentSolutionInput({ solutionUrl: "https://github.com/you/repo" })).toBe(true);
  });

  it("lists visible projects and experience labels", () => {
    expect(
      visibleNamedItems([
        { id: "p1", name: "Portfolio", hidden: false },
        { id: "p2", name: "Hidden", hidden: true },
      ]),
    ).toEqual([{ id: "p1", label: "Portfolio" }]);

    expect(
      visibleExperienceItems([
        { id: "e1", company: "Acme Corp", position: "Engineer", hidden: false },
        { id: "e2", company: "Freelance", position: "", hidden: false },
        { id: "e3", company: "Hidden Inc", position: "Intern", hidden: true },
      ]),
    ).toEqual([
      { id: "e1", label: "Acme Corp — Engineer" },
      { id: "e2", label: "Freelance" },
    ]);
  });

  it("looks up a status on the selected resume and counts verified items", () => {
    const statuses = [
      { itemId: "s1", status: "verified", resumeId: "r1" },
      { itemId: "s1", status: "pending", resumeId: "r2" },
    ];

    expect(findVerificationItemStatus(statuses, "s1", "r1")?.status).toBe("verified");
    expect(findVerificationItemStatus(statuses, "s1", "r2")?.status).toBe("pending");
    expect(findVerificationItemStatus(statuses, "unknown", "r1")).toBeUndefined();

    const items = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
    expect(
      countVerifiedItems(items, (id) => statuses.find((status) => status.itemId === id && status.resumeId === "r1")),
    ).toBe(1);
  });
});
