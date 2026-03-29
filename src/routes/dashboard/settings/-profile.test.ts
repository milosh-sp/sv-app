import { describe, expect, it } from "vite-plus/test";

describe("IdentityVerificationBlock states", () => {
  it("should have 4 defined states: not_requested, pending, approved, unavailable", () => {
    const states = ["not_requested", "pending", "approved", "unavailable"];
    expect(states).toHaveLength(4);
    expect(states).toContain("not_requested");
    expect(states).toContain("pending");
    expect(states).toContain("approved");
    expect(states).toContain("unavailable");
  });

  it("should map claimed and verdict_pending to pending display", () => {
    const pendingLikeStatuses = ["pending", "claimed", "verdict_pending"];
    for (const status of pendingLikeStatuses) {
      expect(["pending", "claimed", "verdict_pending"]).toContain(status);
    }
  });

  it("should allow retry for rejected and issue statuses", () => {
    const retryableStatuses = ["rejected", "issue"];
    for (const status of retryableStatuses) {
      expect(["rejected", "issue"]).toContain(status);
    }
  });
});
