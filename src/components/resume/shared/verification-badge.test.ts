import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

import { shouldShowVerificationBadge, showsReviewerProfileLink } from "./verification-badge";

describe("VerificationBadge display rules", () => {
  it("shows a checkmark only for a visible verified badge", () => {
    expect(shouldShowVerificationBadge("verified", true)).toBe(true);
  });

  it("shows nothing for pending, claimed, and verdict_pending", () => {
    expect(shouldShowVerificationBadge("pending", true)).toBe(false);
    expect(shouldShowVerificationBadge("claimed", true)).toBe(false);
    expect(shouldShowVerificationBadge("verdict_pending", true)).toBe(false);
  });

  it("shows nothing for rejected, issue, and unknown statuses", () => {
    expect(shouldShowVerificationBadge("rejected", true)).toBe(false);
    expect(shouldShowVerificationBadge("issue", true)).toBe(false);
    expect(shouldShowVerificationBadge("unknown", true)).toBe(false);
  });

  it("shows nothing when the badge is hidden", () => {
    expect(shouldShowVerificationBadge("verified", false)).toBe(false);
    expect(shouldShowVerificationBadge("pending", false)).toBe(false);
  });
});

describe("Badge tooltip variants", () => {
  it("links a reviewer profile only when a profile url is present", () => {
    expect(showsReviewerProfileLink("/reviewer/admin-1")).toBe(true);
    expect(showsReviewerProfileLink(null)).toBe(false);
    expect(showsReviewerProfileLink(undefined)).toBe(false);
  });
});
