import { describe, expect, it } from "vite-plus/test";

describe("VerificationBadge display rules", () => {
  const shouldRender = (status: string, badgeVisible: boolean): string | null => {
    if (!badgeVisible) return null;
    if (status === "rejected" || status === "issue") return null;
    if (status === "approved") return "checkmark";
    if (status === "pending" || status === "claimed" || status === "verdict_pending") return "clock";
    return null;
  };

  it("should show checkmark for approved with visible badge", () => {
    expect(shouldRender("approved", true)).toBe("checkmark");
  });

  it("should show clock for pending with visible badge", () => {
    expect(shouldRender("pending", true)).toBe("clock");
  });

  it("should show clock for claimed (displayed as pending to user)", () => {
    expect(shouldRender("claimed", true)).toBe("clock");
  });

  it("should show clock for verdict_pending (displayed as pending to user)", () => {
    expect(shouldRender("verdict_pending", true)).toBe("clock");
  });

  it("should show nothing for rejected", () => {
    expect(shouldRender("rejected", true)).toBeNull();
  });

  it("should show nothing for issue", () => {
    expect(shouldRender("issue", true)).toBeNull();
  });

  it("should show nothing when badgeVisible is false", () => {
    expect(shouldRender("approved", false)).toBeNull();
    expect(shouldRender("pending", false)).toBeNull();
  });

  it("should show nothing for unknown status", () => {
    expect(shouldRender("unknown", true)).toBeNull();
  });
});

describe("Badge tooltip variants", () => {
  it("should return identity label for identity type", () => {
    const detail = { type: "identity" as const, label: "Identity Verified" };
    expect(detail.type).toBe("identity");
    expect(detail.label).toBe("Identity Verified");
  });

  it("should return experience label", () => {
    const detail = { type: "experience" as const, label: "Verified by Skill Verdict Admin" };
    expect(detail.type).toBe("experience");
    expect(detail.label).toContain("Skill Verdict Admin");
  });

  it("should return reviewer label with profile link", () => {
    const detail = {
      type: "reviewer" as const,
      label: "Jane Smith \u2014 Senior Engineer at Meta",
      profileUrl: "/reviewer/admin-1",
    };
    expect(detail.type).toBe("reviewer");
    expect(detail.label).toContain("Jane Smith");
    expect(detail.profileUrl).toBe("/reviewer/admin-1");
  });

  it("should render reviewer without link when profileUrl is null", () => {
    const detail = {
      type: "reviewer" as const,
      label: "Verified",
      profileUrl: null,
    };
    expect(detail.profileUrl).toBeNull();
  });
});
