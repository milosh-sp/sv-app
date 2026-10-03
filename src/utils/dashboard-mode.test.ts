// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";

import { dashboardModeStorageKey, getEffectiveDashboardMode, parseDashboardModeFromCookieHeader } from "./dashboard-mode";

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
});
