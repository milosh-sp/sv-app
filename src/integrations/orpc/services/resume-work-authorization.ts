import { eq, gte, or, sql } from "drizzle-orm";
import { match } from "ts-pattern";

import type { ResumeData } from "@/schema/resume/data";

import { schema } from "@/integrations/drizzle";

export type WorkAuthorizationFilters = {
  workAuthRegions: ("eu" | "usa" | "uk")[];
  sponsorshipRequired?: "yes" | "no" | "case_by_case" | "unknown";
  workAuthStatusByRegion?: { eu?: string; usa?: string; uk?: string };
  authorizationFreshnessDays?: number;
};

const getWorkAuthStatusColumn = (region: "eu" | "usa" | "uk") =>
  match(region)
    .with("eu", () => schema.resume.workAuthEuStatus)
    .with("usa", () => schema.resume.workAuthUsaStatus)
    .with("uk", () => schema.resume.workAuthUkStatus)
    .exhaustive();

const getWorkAuthSponsorshipColumn = (region: "eu" | "usa" | "uk") =>
  match(region)
    .with("eu", () => schema.resume.workAuthEuSponsorshipRequired)
    .with("usa", () => schema.resume.workAuthUsaSponsorshipRequired)
    .with("uk", () => schema.resume.workAuthUkSponsorshipRequired)
    .exhaustive();

export const getWorkAuthorizationConditions = (filters: WorkAuthorizationFilters, forEmployers = false) => {
  const conditions = [];

  if (filters.workAuthRegions.length > 0) {
    const regionConditions = filters.workAuthRegions.map(
      (region) => sql`${getWorkAuthStatusColumn(region)} <> 'not_authorized'`,
    );
    conditions.push(or(...regionConditions));
  }

  if (filters.sponsorshipRequired) {
    const regions = filters.workAuthRegions.length > 0 ? filters.workAuthRegions : (["eu", "usa", "uk"] as const);
    const sponsorshipConditions = regions.map((region) =>
      eq(getWorkAuthSponsorshipColumn(region), filters.sponsorshipRequired!),
    );
    conditions.push(or(...sponsorshipConditions));
  }

  if (filters.workAuthStatusByRegion) {
    if (filters.workAuthStatusByRegion.eu)
      conditions.push(eq(schema.resume.workAuthEuStatus, filters.workAuthStatusByRegion.eu));
    if (filters.workAuthStatusByRegion.usa)
      conditions.push(eq(schema.resume.workAuthUsaStatus, filters.workAuthStatusByRegion.usa));
    if (filters.workAuthStatusByRegion.uk)
      conditions.push(eq(schema.resume.workAuthUkStatus, filters.workAuthStatusByRegion.uk));
  }

  if (filters.authorizationFreshnessDays) {
    const threshold = new Date(Date.now() - filters.authorizationFreshnessDays * 24 * 60 * 60 * 1000);
    conditions.push(gte(schema.resume.workAuthUpdatedAt, threshold));
  }

  // Employers may only filter on work-auth fields the candidate consented to share; consent does not gate the pool itself.
  if (forEmployers && conditions.length > 0) {
    conditions.unshift(eq(schema.resume.workAuthConsentToShare, true));
  }

  return conditions;
};

export const deriveWorkAuthorizationIndexes = (data: ResumeData) => {
  const workAuthorization = data.workAuthorization;
  const regions = [workAuthorization.eu, workAuthorization.usa, workAuthorization.uk];
  const searchTokens = Array.from(
    new Set(regions.flatMap((region) => region.searchTokens).filter((token) => token.length > 0)),
  );
  const latestUpdatedAt = regions
    .map((region) => {
      if (!region.updatedAt) return null;
      const parsed = new Date(region.updatedAt);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    })
    .filter((value): value is Date => value !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    workAuthEuStatus: workAuthorization.eu.status,
    workAuthUsaStatus: workAuthorization.usa.status,
    workAuthUkStatus: workAuthorization.uk.status,
    workAuthEuSponsorshipRequired: workAuthorization.eu.sponsorshipRequired,
    workAuthUsaSponsorshipRequired: workAuthorization.usa.sponsorshipRequired,
    workAuthUkSponsorshipRequired: workAuthorization.uk.sponsorshipRequired,
    workAuthConsentToShare: regions.some((region) => region.consentToShareWithEmployers),
    workAuthUpdatedAt: latestUpdatedAt ?? null,
    workAuthSearchTokens: searchTokens,
  };
};
