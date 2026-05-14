import { describe, expect, it } from "vite-plus/test";

import { getIsMobile, MOBILE_BREAKPOINT, MOBILE_QUERY } from "./use-mobile";

describe("mobile breakpoint helpers", () => {
  it("matches the builder mobile breakpoint", () => {
    expect(MOBILE_BREAKPOINT).toBe(768);
    expect(MOBILE_QUERY).toBe("(max-width: 767px)");
  });

  it.each([
    [320, true],
    [375, true],
    [390, true],
    [430, true],
    [767, true],
    [768, false],
    [1024, false],
  ])("returns %s mobile=%s", (width, expected) => {
    expect(getIsMobile(width)).toBe(expected);
  });
});
