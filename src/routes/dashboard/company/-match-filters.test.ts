import { expect, test } from "vite-plus/test";

import {
  buildCompanyMatchInput,
  emptyCompanyMatchFilters,
  emptyMatchPageState,
  readMatchPageState,
  setAuthorizationFreshnessDays,
  setSponsorshipRequired,
  setWorkAuthRegionStatus,
  toggleWorkAuthRegion,
} from "./-match-filters";

const jobDescription = "Senior TypeScript engineer with React experience";

test("buildCompanyMatchInput sends only the filters that are set", () => {
  const input = buildCompanyMatchInput(jobDescription, {
    workAuthRegions: ["usa", "eu"],
    sponsorshipRequired: "no",
    workAuthStatusByRegion: { usa: "citizen", uk: "visa_holder" },
    authorizationFreshnessDays: 30,
  });

  expect(input.jobDescription).toBe(jobDescription);
  expect(input.workAuthRegions).toEqual(["usa", "eu"]);
  expect(input.sponsorshipRequired).toBe("no");
  expect(input.workAuthStatusByRegion).toEqual({ usa: "citizen" });
  expect(input.authorizationFreshnessDays).toBe(30);
});

test("buildCompanyMatchInput omits empty work authorization filters", () => {
  const input = buildCompanyMatchInput(`  ${jobDescription}  `, emptyCompanyMatchFilters);

  expect(input.jobDescription).toBe(jobDescription);
  expect(input.workAuthRegions).toEqual([]);
  expect(input.sponsorshipRequired).toBeUndefined();
  expect(input.workAuthStatusByRegion).toBeUndefined();
  expect(input.authorizationFreshnessDays).toBeUndefined();
});

test("toggleWorkAuthRegion keeps region order and drops a cleared region's status", () => {
  const withUsa = toggleWorkAuthRegion(emptyCompanyMatchFilters, "usa");
  const withBoth = toggleWorkAuthRegion(withUsa, "eu");
  const withStatus = setWorkAuthRegionStatus(withBoth, "eu", "citizen");
  const removed = toggleWorkAuthRegion(withStatus, "eu");

  expect(withBoth.workAuthRegions).toEqual(["eu", "usa"]);
  expect(removed.workAuthRegions).toEqual(["usa"]);
  expect(removed.workAuthStatusByRegion).toBeUndefined();
});

test("setSponsorshipRequired and setAuthorizationFreshnessDays clear empty values", () => {
  const sponsored = setSponsorshipRequired(emptyCompanyMatchFilters, "case_by_case");
  const clearedSponsorship = setSponsorshipRequired(sponsored, null);
  const fresh = setAuthorizationFreshnessDays(emptyCompanyMatchFilters, "14");
  const clearedFreshness = setAuthorizationFreshnessDays(fresh, "0");

  expect(sponsored.sponsorshipRequired).toBe("case_by_case");
  expect(clearedSponsorship.sponsorshipRequired).toBeUndefined();
  expect(fresh.authorizationFreshnessDays).toBe(14);
  expect(clearedFreshness.authorizationFreshnessDays).toBeUndefined();
});

test("readMatchPageState rejects a saved search that is not the page schema", () => {
  expect(readMatchPageState("{}")).toEqual(emptyMatchPageState);
});

test("work authorization helpers keep only selected region statuses", () => {
  const filters = {
    workAuthRegions: ["eu", "uk"] as const,
    workAuthStatusByRegion: { eu: "citizen" as const, uk: "visa_holder" as const, usa: "citizen" as const },
  };
  expect(buildCompanyMatchInput(jobDescription, filters).workAuthStatusByRegion).toEqual({
    eu: "citizen",
    uk: "visa_holder",
  });

  const onlyUsa = setWorkAuthRegionStatus(emptyCompanyMatchFilters, "usa", "citizen");
  const onlyUk = setWorkAuthRegionStatus(emptyCompanyMatchFilters, "uk", "visa_holder");
  expect(onlyUsa.workAuthStatusByRegion).toEqual({ usa: "citizen" });
  expect(onlyUk.workAuthStatusByRegion).toEqual({ uk: "visa_holder" });
  expect(setWorkAuthRegionStatus(onlyUsa, "usa", null).workAuthStatusByRegion).toBeUndefined();
  expect(setAuthorizationFreshnessDays(emptyCompanyMatchFilters, "  ").authorizationFreshnessDays).toBeUndefined();
});

test("readMatchPageState fills filters missing from older saved searches", () => {
  const raw = JSON.stringify({ jobDescription: "hello", results: [], hasSearched: true });
  const withEmptyFilters = JSON.stringify({ jobDescription: "hello", results: [], hasSearched: true, filters: {} });
  expect(readMatchPageState(raw).filters).toEqual(emptyCompanyMatchFilters);
  expect(readMatchPageState(withEmptyFilters).filters.workAuthRegions).toEqual([]);
  expect(readMatchPageState("not json")).toEqual(emptyMatchPageState);
});
