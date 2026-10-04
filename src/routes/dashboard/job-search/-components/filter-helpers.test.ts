import { describe, expect, it } from "vite-plus/test";

import { buildPostFilters, buildSearchParams, hasActiveFilters, initialFilterState } from "./filter-helpers";

describe("job search filters", () => {
  it("trims the query, uppercases the country, and skips the first page", () => {
    expect(buildSearchParams("  rust ", { ...initialFilterState, countryCode: " us " })).toEqual({
      query: "rust",
      num_pages: 1,
      country: "US",
    });

    expect(buildSearchParams("rust", initialFilterState, 1).page).toBeUndefined();
    expect(buildSearchParams("rust", initialFilterState, 2).page).toBe(2);
    expect(buildSearchParams("rust", { ...initialFilterState, countryCode: " " }).country).toBe("US");
  });

  it("forwards remote, employment, and date filters, and ignores date all", () => {
    const params = buildSearchParams("rust", {
      ...initialFilterState,
      datePosted: "week",
      remoteOnly: true,
      employmentType: "FULLTIME",
      jobRequirements: "under_3_years_experience",
    });

    expect(params).toMatchObject({
      date_posted: "week",
      remote_jobs_only: true,
      employment_types: "FULLTIME",
      job_requirements: "under_3_years_experience",
    });

    expect(buildSearchParams("rust", { ...initialFilterState, datePosted: "all" }).date_posted).toBeUndefined();
  });

  it("swaps an inverted salary range and drops blank or invalid amounts", () => {
    expect(
      buildPostFilters({
        ...initialFilterState,
        minSalary: " 120000 ",
        maxSalary: "80000",
        includeKeywords: ["rust"],
        excludeKeywords: ["php"],
        excludeCompanies: ["Acme"],
        directApplyOnly: true,
      }),
    ).toEqual({
      minSalary: 80000,
      maxSalary: 120000,
      includeKeywords: ["rust"],
      excludeKeywords: ["php"],
      excludeCompanies: ["Acme"],
      directApplyOnly: true,
    });

    expect(buildPostFilters({ ...initialFilterState, minSalary: "-1", maxSalary: "nope" })).toEqual({});
    expect(buildPostFilters(initialFilterState)).toEqual({});
  });

  it("treats the initial state as inactive and any change as active", () => {
    expect(hasActiveFilters(initialFilterState)).toBe(false);
    expect(hasActiveFilters({ ...initialFilterState, datePosted: "all" })).toBe(false);
    expect(hasActiveFilters({ ...initialFilterState, datePosted: "today" })).toBe(true);
    expect(hasActiveFilters({ ...initialFilterState, remoteOnly: true })).toBe(true);
    expect(hasActiveFilters({ ...initialFilterState, employmentType: "CONTRACTOR" })).toBe(true);
    expect(hasActiveFilters({ ...initialFilterState, jobRequirements: "more_than_3_years_experience" })).toBe(true);
    expect(hasActiveFilters({ ...initialFilterState, countryCode: "DE" })).toBe(true);
    expect(hasActiveFilters({ ...initialFilterState, minSalary: "1" })).toBe(true);
    expect(hasActiveFilters({ ...initialFilterState, maxSalary: "1" })).toBe(true);
    expect(hasActiveFilters({ ...initialFilterState, includeKeywords: ["a"] })).toBe(true);
    expect(hasActiveFilters({ ...initialFilterState, excludeKeywords: ["a"] })).toBe(true);
    expect(hasActiveFilters({ ...initialFilterState, excludeCompanies: ["a"] })).toBe(true);
    expect(hasActiveFilters({ ...initialFilterState, directApplyOnly: true })).toBe(true);
  });
});
