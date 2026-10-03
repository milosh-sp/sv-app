// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (name: string) => jar.get(name),
  setCookie: (name: string, value: string) => {
    jar.set(name, value);
  },
}));

import { canExportResume, grantResumeAccess, hasResumeAccess } from "./resume-access";
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

describe("resume password access", () => {
  beforeEach(() => {
    jar.clear();
  });

  it("allows a cookie that matches the granted token", () => {
    grantResumeAccess("resume-1", "hash");

    expect(hasResumeAccess("resume-1", "hash")).toBe(true);
  });

  it("rejects a wrong cookie, a missing cookie, and a resume with no password", () => {
    grantResumeAccess("resume-1", "hash");
    jar.set("resume_access_resume-1", "wrong");
    expect(hasResumeAccess("resume-1", "hash")).toBe(false);

    jar.clear();
    expect(hasResumeAccess("resume-1", "hash")).toBe(false);
    expect(hasResumeAccess("resume-1", null)).toBe(false);
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
