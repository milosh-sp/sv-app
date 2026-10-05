import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { getIsMobile, MOBILE_BREAKPOINT, MOBILE_QUERY, useIsMobile } from "./use-mobile";

function ServerProbe() {
  return createElement("span", null, String(useIsMobile()));
}

describe("mobile breakpoint helpers", () => {
  it("matches the builder mobile breakpoint", () => {
    expect(MOBILE_BREAKPOINT).toBe(768);
    expect(MOBILE_QUERY).toBe("(max-width: 767px)");
    expect(renderToString(createElement(ServerProbe))).toContain("false");
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
