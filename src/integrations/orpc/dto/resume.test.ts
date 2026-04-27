import { describe, expect, it } from "vite-plus/test";

import { resumeDto } from "./resume";

describe("resumeDto work authorization filters", () => {
  it("applies list input defaults for work authorization filters", () => {
    const parsed = resumeDto.list.input.parse(undefined);

    expect(parsed).toEqual({
      tags: [],
      sort: "lastUpdatedAt",
      workAuthRegions: [],
    });
  });

  it("accepts valid employer search filters", () => {
    const parsed = resumeDto.searchForEmployers.input.parse({
      workAuthRegions: ["eu", "usa"],
      sponsorshipRequired: "yes",
      workAuthStatusByRegion: { eu: "citizen", usa: "visa_holder" },
      authorizationFreshnessDays: 30,
    });

    expect(parsed.workAuthRegions).toEqual(["eu", "usa"]);
    expect(parsed.sponsorshipRequired).toBe("yes");
    expect(parsed.workAuthStatusByRegion?.eu).toBe("citizen");
    expect(parsed.authorizationFreshnessDays).toBe(30);
  });

  it("rejects invalid work authorization statuses", () => {
    const result = resumeDto.searchForEmployers.input.safeParse({
      workAuthStatusByRegion: { eu: "invalid_status" },
    });

    expect(result.success).toBe(false);
  });
});
