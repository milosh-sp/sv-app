import type { ResumeData } from "@/schema/resume/data";

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
