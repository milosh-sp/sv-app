import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));

import { Badge } from "@/components/ui/badge";

import { ContactStatusBadge, getContactStatusFilterOptions, getContactStatusLabel } from "./contact-status";

describe("contact status", () => {
  it("labels every status and renders a badge", () => {
    expect(["pending", "accepted", "declined"].map((status) => getContactStatusLabel(status as "pending"))).toEqual([
      "Pending",
      "Accepted",
      "Declined",
    ]);
    expect(getContactStatusFilterOptions().map((option) => option.value)).toEqual([
      "all",
      "pending",
      "accepted",
      "declined",
    ]);

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<ContactStatusBadge status="accepted" />);
    });
    expect(container.textContent).toContain("Accepted");
    expect(container.querySelector("[data-slot], span, div")).toBeTruthy();
    expect(Badge).toBeTruthy();
    root.unmount();
  });
});
