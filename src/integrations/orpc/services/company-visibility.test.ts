import { expect, test } from "vite-plus/test";

import { emailSharedOnAccept } from "./company-visibility";

test("emailSharedOnAccept returns the address only after accept", () => {
  expect(emailSharedOnAccept("accepted", "ada@example.com")).toBe("ada@example.com");
  expect(emailSharedOnAccept("pending", "ada@example.com")).toBeNull();
  expect(emailSharedOnAccept("declined", "ada@example.com")).toBeNull();
  expect(emailSharedOnAccept(null, "ada@example.com")).toBeNull();
  expect(emailSharedOnAccept("accepted", null)).toBeNull();
});
