import { describe, expect, it } from "vite-plus/test";

import { canExportResume } from "./resume-access";
import { isInternalServerCall } from "./server-call";

const base = {
  viewerId: null as string | null,
  ownerId: "owner",
  isPublic: false,
  hasPassword: false,
  hasPasswordAccess: false,
};

describe("canExportResume", () => {
  it("allows the owner", () => {
    expect(canExportResume({ ...base, viewerId: "owner", isPublic: false })).toBe(true);
  });

  it("allows a public resume with no password", () => {
    expect(canExportResume({ ...base, isPublic: true })).toBe(true);
    expect(canExportResume({ ...base, viewerId: "someone-else", isPublic: true })).toBe(true);
  });

  it("requires the password grant for a protected public resume", () => {
    expect(canExportResume({ ...base, isPublic: true, hasPassword: true, hasPasswordAccess: false })).toBe(false);
    expect(canExportResume({ ...base, isPublic: true, hasPassword: true, hasPasswordAccess: true })).toBe(true);
  });

  it("hides a private resume from everyone else", () => {
    expect(canExportResume({ ...base, viewerId: "someone-else" })).toBe(false);
    expect(canExportResume(base)).toBe(false);
  });
});

describe("isInternalServerCall", () => {
  it("rejects a forged x-server-side-call header", () => {
    const forged = new Headers({ "x-server-side-call": "true" });
    expect(forged.get("x-server-side-call")).toBe("true");
    expect(isInternalServerCall({ internalCall: false }, false)).toBe(false);
    expect(isInternalServerCall({}, false)).toBe(false);
  });

  it("accepts the in-process flag", () => {
    expect(isInternalServerCall({ internalCall: true }, false)).toBe(true);
  });
});
