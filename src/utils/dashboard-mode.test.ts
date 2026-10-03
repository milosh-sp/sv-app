// @vitest-environment node
import { describe, expect, it, vi } from "vite-plus/test";

const cookieJar = vi.hoisted(() => new Map<string, string>());

vi.mock("js-cookie", () => ({
  default: {
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
  },
}));

import {
    dashboardModeStorageKey,
    getEffectiveDashboardMode,
    parseDashboardModeFromCookieHeader,
    readDashboardModeFromClientCookie,
    writeDashboardModeToClientCookie,
} from "./dashboard-mode";

describe("dashboard mode", () => {
  it("keeps non-reviewers in user mode", () => {
    expect(getEffectiveDashboardMode("company", "reviewer")).toBe("user");
    expect(getEffectiveDashboardMode("skill_verdict_admin", "reviewer")).toBe("user");
    expect(getEffectiveDashboardMode(null, "reviewer")).toBe("user");
  });

  it("uses the reviewer cookie when the account is a reviewer admin", () => {
    expect(getEffectiveDashboardMode("reviewer_admin", "user")).toBe("user");
    expect(getEffectiveDashboardMode("reviewer_admin", "reviewer")).toBe("reviewer");
  });

  it("defaults a missing or junk cookie to reviewer and ignores other cookies", () => {
    expect(parseDashboardModeFromCookieHeader(new Headers())).toBe("reviewer");
    expect(parseDashboardModeFromCookieHeader(new Headers({ cookie: `${dashboardModeStorageKey}=nope` }))).toBe(
      "reviewer",
    );
    expect(
      parseDashboardModeFromCookieHeader(
        new Headers({ cookie: `theme=dark; ${dashboardModeStorageKey}=user; other=1` }),
      ),
    ).toBe("user");
  });

  it("reads and writes the client cookie, and ignores a junk value", () => {
    expect(readDashboardModeFromClientCookie()).toBe("reviewer");
    cookieJar.set(dashboardModeStorageKey, "nope");
    expect(readDashboardModeFromClientCookie()).toBe("reviewer");
    writeDashboardModeToClientCookie("user");
    expect(readDashboardModeFromClientCookie()).toBe("user");
  });
});
