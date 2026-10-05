import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import type { VerificationStatus } from "./verification-context";

import { findVerificationStatus, useIdentityVerificationStatus, VerificationProvider } from "./verification-context";

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

describe("useIdentityVerificationStatus", () => {
  it("returns the identity status and ignores other sections", () => {
    function Probe() {
      const status = useIdentityVerificationStatus();
      return <p>{status?.id ?? "none"}</p>;
    }

    const identity: VerificationStatus = {
      id: "id-1",
      sectionType: "identity",
      itemId: "me",
      itemLabel: "Me",
      status: "verified",
      badgeVisible: true,
    };
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <VerificationProvider statuses={[...statuses, identity]}>
          <Probe />
        </VerificationProvider>,
      );
    });

    expect(container.textContent).toBe("id-1");
    act(() => {
      root.unmount();
    });
  });
});
