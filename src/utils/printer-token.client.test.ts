import { describe, expect, it } from "vite-plus/test";

import { verifyPrinterToken } from "./printer-token";

describe("printer token in the browser", () => {
  it("does not verify tokens outside the server", () => {
    expect(verifyPrinterToken("token")).toBeUndefined();
  });
});
