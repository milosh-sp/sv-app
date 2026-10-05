import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useQuery: () => ({ data: undefined }) };
});

import type { VerificationStatus } from "./verification-context";

import { HeaderNameWithVerification } from "./header-name-with-verification";
import { VerificationProvider } from "./verification-context";

const identity: VerificationStatus = {
  id: "id-1",
  sectionType: "identity",
  itemId: "me",
  itemLabel: "Me",
  status: "verified",
  badgeVisible: true,
};

function render(statuses: VerificationStatus[]) {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      <VerificationProvider statuses={statuses}>
        <HeaderNameWithVerification name="Ada Lovelace" />
      </VerificationProvider>,
    );
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("HeaderNameWithVerification", () => {
  it("shows a badge only for a verified identity", () => {
    const hidden = render([{ ...identity, status: "pending" }]);
    expect(hidden.container.textContent).toContain("Ada Lovelace");
    expect(hidden.container.querySelector("[data-testid='verification-badge-verified']")).toBeNull();
    hidden.unmount();

    const shown = render([identity, { ...identity, id: "skill-1", sectionType: "skill", itemId: "s1" }]);
    expect(shown.container.querySelector("[data-testid='verification-badge-verified']")).toBeTruthy();
    shown.unmount();
  });
});
