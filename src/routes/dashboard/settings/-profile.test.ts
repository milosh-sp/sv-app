import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: unknown }) => children ?? null,
}));

import { identityVerificationPhase } from "./profile";

describe("identity verification phase", () => {
  it("maps claimed and verdict_pending onto the pending phase", () => {
    expect(identityVerificationPhase("pending")).toBe("pending");
    expect(identityVerificationPhase("claimed")).toBe("pending");
    expect(identityVerificationPhase("verdict_pending")).toBe("pending");
  });

  it("keeps a first request, a verified identity, and a retry apart", () => {
    expect(identityVerificationPhase("not_requested")).toBe("request");
    expect(identityVerificationPhase("verified")).toBe("verified");
    expect(identityVerificationPhase("rejected")).toBe("retry");
    expect(identityVerificationPhase("issue")).toBe("retry");
  });
});
