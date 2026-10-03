import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));

import { formatPostedDate, formatSalary, getQuotaStatus, isValidExternalUrl } from "./job-utils";

describe("job formatting", () => {
  it("formats a salary range, a floor, a ceiling, and an invalid currency", () => {
    expect(formatSalary(null, null, "USD", "year")).toBe("");
    expect(formatSalary(0, 0, "USD", null)).toBe("");
    expect(formatSalary(80_000, 120_000, "USD", "year")).toBe("$80,000 - $120,000 / year");
    expect(formatSalary(80_000, null, null, null)).toBe("$80,000+");
    expect(formatSalary(null, 90_000, "EUR", "month")).toBe("Up to €90,000 / month");
    expect(formatSalary(10, 20, "not-a-currency", null)).toBe("not-a-currency 10 - not-a-currency 20");
  });

  it("buckets a posted date and a quota", () => {
    const now = Math.floor(Date.now() / 1000);
    const day = 24 * 60 * 60;

    expect(formatPostedDate(null)).toBe("");
    expect(formatPostedDate(now)).toBe("Today");
    expect(formatPostedDate(now - day - 60)).toBe("Yesterday");
    expect(formatPostedDate(now - 3 * day)).toBe("3 days ago");
    expect(formatPostedDate(now - 14 * day)).toBe("2 weeks ago");
    expect(formatPostedDate(now - 60 * day)).toBe("2 months ago");

    expect(getQuotaStatus({ limit: 0, used: 10, remaining: 0 })).toBe("healthy");
    expect(getQuotaStatus({ limit: 10, used: 9, remaining: 1 })).toBe("critical");
    expect(getQuotaStatus({ limit: 10, used: 8, remaining: 2 })).toBe("warning");
    expect(getQuotaStatus({ limit: 10, used: 1, remaining: 9 })).toBe("healthy");
  });

  it("accepts only http and https links", () => {
    expect(isValidExternalUrl(null)).toBe(false);
    expect(isValidExternalUrl("  ")).toBe(false);
    expect(isValidExternalUrl("not a url")).toBe(false);
    expect(isValidExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isValidExternalUrl("https://example.com/jobs")).toBe(true);
    expect(isValidExternalUrl("http://example.com")).toBe(true);
  });
});
