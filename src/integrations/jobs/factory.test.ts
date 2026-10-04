import { describe, expect, it } from "vite-plus/test";

import { createJobSearchProvider } from "./factory";
import { JSearchProvider } from "./providers/jsearch";

describe("createJobSearchProvider", () => {
  it("returns the JSearch provider", () => {
    expect(createJobSearchProvider("key")).toBeInstanceOf(JSearchProvider);
  });
});
