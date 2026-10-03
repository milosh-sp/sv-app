import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: unknown }) => children ?? null,
}));

import { verifiedBadgeItems } from "./privacy";

describe("Privacy Settings", () => {
  it("keeps only verified items for badge toggles", () => {
    const statuses = [
      { id: "1", status: "verified", itemLabel: "TypeScript" },
      { id: "2", status: "pending", itemLabel: "React" },
      { id: "3", status: "verified", itemLabel: "My Project" },
      { id: "4", status: "rejected", itemLabel: "Node.js" },
    ];

    expect(verifiedBadgeItems(statuses).map((item) => item.itemLabel)).toEqual(["TypeScript", "My Project"]);
  });

  it("is empty when nothing is verified", () => {
    const statuses = [
      { id: "1", status: "pending", itemLabel: "TypeScript" },
      { id: "2", status: "rejected", itemLabel: "React" },
    ];

    expect(verifiedBadgeItems(statuses)).toEqual([]);
  });
});
