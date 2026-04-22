import { describe, expect, it } from "vite-plus/test";

import type { VerificationStatus } from "./verification-context";

describe("Badge display rules", () => {
  const statuses: VerificationStatus[] = [
    { id: "1", sectionType: "skill", itemId: "s1", itemLabel: "TypeScript", status: "verified", badgeVisible: true },
    { id: "2", sectionType: "skill", itemId: "s2", itemLabel: "React", status: "pending", badgeVisible: true },
    { id: "3", sectionType: "experience", itemId: "e1", itemLabel: "Acme", status: "verified", badgeVisible: false },
    { id: "4", sectionType: "project", itemId: "p1", itemLabel: "MyApp", status: "rejected", badgeVisible: true },
    { id: "5", sectionType: "skill", itemId: "s3", itemLabel: "Go", status: "claimed", badgeVisible: true },
    { id: "6", sectionType: "skill", itemId: "s4", itemLabel: "Rust", status: "verdict_pending", badgeVisible: true },
  ];

  const shouldShowBadge = (status: VerificationStatus): string | null => {
    if (!status.badgeVisible) return null;
    if (status.status === "verified") return "checkmark";
    if (["pending", "claimed", "verdict_pending"].includes(status.status)) return "clock";
    return null;
  };

  it("approved + visible = checkmark", () => {
    expect(shouldShowBadge(statuses[0]!)).toBe("checkmark");
  });

  it("pending + visible = clock", () => {
    expect(shouldShowBadge(statuses[1]!)).toBe("clock");
  });

  it("approved + invisible = nothing", () => {
    expect(shouldShowBadge(statuses[2]!)).toBeNull();
  });

  it("rejected = nothing", () => {
    expect(shouldShowBadge(statuses[3]!)).toBeNull();
  });

  it("claimed displays as clock", () => {
    expect(shouldShowBadge(statuses[4]!)).toBe("clock");
  });

  it("verdict_pending displays as clock", () => {
    expect(shouldShowBadge(statuses[5]!)).toBe("clock");
  });

  it("should find correct status by itemId", () => {
    const findStatus = (itemId: string) => statuses.find((s) => s.itemId === itemId);
    expect(findStatus("s1")?.status).toBe("verified");
    expect(findStatus("e1")?.badgeVisible).toBe(false);
    expect(findStatus("nonexistent")).toBeUndefined();
  });
});
