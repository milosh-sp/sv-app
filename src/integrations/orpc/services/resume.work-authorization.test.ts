import { describe, expect, it } from "vite-plus/test";

import { defaultResumeData } from "@/schema/resume/data";

import { deriveWorkAuthorizationIndexes, getWorkAuthorizationConditions } from "./resume-work-authorization";

describe("deriveWorkAuthorizationIndexes", () => {
  it("derives indexed fields from resume work authorization data", () => {
    const data = structuredClone(defaultResumeData);
    data.workAuthorization.eu.status = "citizen";
    data.workAuthorization.usa.status = "visa_holder";
    data.workAuthorization.uk.status = "needs_sponsorship";
    data.workAuthorization.eu.sponsorshipRequired = "no";
    data.workAuthorization.usa.sponsorshipRequired = "case_by_case";
    data.workAuthorization.uk.sponsorshipRequired = "yes";
    data.workAuthorization.eu.searchTokens = ["work_auth:eu:citizen"];
    data.workAuthorization.usa.searchTokens = ["work_auth:usa:visa_holder"];
    data.workAuthorization.uk.searchTokens = ["work_auth:uk:needs_sponsorship", "work_auth:eu:citizen"];
    data.workAuthorization.eu.consentToShareWithEmployers = false;
    data.workAuthorization.usa.consentToShareWithEmployers = true;
    data.workAuthorization.uk.consentToShareWithEmployers = false;
    data.workAuthorization.eu.updatedAt = "2026-04-20T20:00:00.000Z";
    data.workAuthorization.usa.updatedAt = "2026-04-25T20:00:00.000Z";
    data.workAuthorization.uk.updatedAt = "2026-04-24T20:00:00.000Z";

    const indexed = deriveWorkAuthorizationIndexes(data);

    expect(indexed.workAuthEuStatus).toBe("citizen");
    expect(indexed.workAuthUsaStatus).toBe("visa_holder");
    expect(indexed.workAuthUkStatus).toBe("needs_sponsorship");
    expect(indexed.workAuthEuSponsorshipRequired).toBe("no");
    expect(indexed.workAuthUsaSponsorshipRequired).toBe("case_by_case");
    expect(indexed.workAuthUkSponsorshipRequired).toBe("yes");
    expect(indexed.workAuthConsentToShare).toBe(true);
    expect(indexed.workAuthSearchTokens).toEqual([
      "work_auth:eu:citizen",
      "work_auth:usa:visa_holder",
      "work_auth:uk:needs_sponsorship",
    ]);
    expect(indexed.workAuthUpdatedAt?.toISOString()).toBe("2026-04-25T20:00:00.000Z");
  });

  it("stores null updatedAt when region timestamps are empty", () => {
    const data = structuredClone(defaultResumeData);
    data.workAuthorization.eu.updatedAt = "";
    data.workAuthorization.usa.updatedAt = "";
    data.workAuthorization.uk.updatedAt = "";

    const indexed = deriveWorkAuthorizationIndexes(data);

    expect(indexed.workAuthUpdatedAt).toBeNull();
  });
});

describe("getWorkAuthorizationConditions", () => {
  it("gates employer work-auth filters on consent, but not the unfiltered pool", () => {
    expect(getWorkAuthorizationConditions({ workAuthRegions: [] }, true)).toHaveLength(0);
    expect(getWorkAuthorizationConditions({ workAuthRegions: ["eu"] })).toHaveLength(1);
    expect(getWorkAuthorizationConditions({ workAuthRegions: ["eu"] }, true)).toHaveLength(2);
  });
});
