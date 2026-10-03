import { describe, expect, it } from "vite-plus/test";

import { toSafeDocxLink } from "./link-utils";

describe("toSafeDocxLink", () => {
  it("keeps https and mailto links", () => {
    expect(toSafeDocxLink("https://example.com/a")).toBe("https://example.com/a");
    expect(toSafeDocxLink("  mailto: a@b.com ")).toBe("mailto:a@b.com");
  });

  it("drops javascript and empty values", () => {
    expect(toSafeDocxLink("javascript:alert(1)")).toBeNull();
    expect(toSafeDocxLink("")).toBeNull();
    expect(toSafeDocxLink("   ")).toBeNull();
    expect(toSafeDocxLink("mailto:")).toBeNull();
  });
});
