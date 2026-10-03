import { describe, expect, it } from "vite-plus/test";

import type { VerificationStatus } from "./verification-context";

import { findVerificationStatus } from "./verification-context";

const statuses: VerificationStatus[] = [
  { id: "1", sectionType: "skill", itemId: "s1", itemLabel: "TypeScript", status: "verified", badgeVisible: true },
  { id: "3", sectionType: "experience", itemId: "e1", itemLabel: "Acme", status: "verified", badgeVisible: false },
];

describe("findVerificationStatus", () => {
  it("finds a status by item id", () => {
    expect(findVerificationStatus(statuses, "s1")?.status).toBe("verified");
    expect(findVerificationStatus(statuses, "e1")?.badgeVisible).toBe(false);
    expect(findVerificationStatus(statuses, "nonexistent")).toBeUndefined();
  });
});
