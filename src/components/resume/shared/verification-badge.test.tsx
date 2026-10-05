import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

type BadgeDetail = {
  type: "identity" | "experience" | "reviewer";
  label: string;
  profileUrl?: string | null;
};

const detail = vi.hoisted(() => ({ current: undefined as BadgeDetail | undefined }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useQuery: () => ({ data: detail.current }) };
});

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ render }: { render?: React.ReactElement }) => render ?? null,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: React.ReactNode }) => <a href={to}>{children}</a>,
}));

import { shouldShowVerificationBadge, showsReviewerProfileLink, VerificationBadge } from "./verification-badge";

function renderBadge(status: string, badgeVisible: boolean) {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(<VerificationBadge requestId="req-1" status={status} badgeVisible={badgeVisible} />);
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

  it("renders each tooltip variant", () => {
    detail.current = undefined;
    const hidden = renderBadge("pending", true);
    expect(hidden.container.innerHTML).toBe("");
    hidden.unmount();

    const plain = renderBadge("verified", true);
    expect(plain.container.querySelector("[data-testid='verification-badge-verified']")).toBeTruthy();
    expect(plain.container.querySelector("[data-testid='tooltip-identity']")).toBeNull();
    plain.unmount();

    detail.current = { type: "identity", label: "Identity verified" };
    const identity = renderBadge("verified", true);
    expect(identity.container.querySelector("[data-testid='tooltip-identity']")?.textContent).toBe("Identity verified");
    identity.unmount();

    detail.current = { type: "experience", label: "Experience verified" };
    const experience = renderBadge("verified", true);
    expect(experience.container.querySelector("[data-testid='tooltip-experience']")?.textContent).toBe(
      "Experience verified",
    );
    experience.unmount();

    detail.current = { type: "reviewer", label: "Reviewed", profileUrl: null };
    const reviewer = renderBadge("verified", true);
    expect(reviewer.container.querySelector("[data-testid='tooltip-reviewer']")?.textContent).toBe("Reviewed");
    expect(reviewer.container.querySelector("a")).toBeNull();
    reviewer.unmount();

    detail.current = { type: "reviewer", label: "Reviewed", profileUrl: "/reviewer/ada" };
    const linked = renderBadge("verified", true);
    expect(linked.container.querySelector("a")?.getAttribute("href")).toBe("/reviewer/ada");
    expect(linked.container.textContent).toContain("View profile");
    linked.unmount();
  });
});
