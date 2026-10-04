import { describe, expect, it } from "vite-plus/test";

import { companyDto } from "./company";

const userId = "11111111-1111-4111-8111-111111111111";
const resumeId = "22222222-2222-4222-8222-222222222222";

describe("companyDto", () => {
  it("accepts a match request and rejects a short job description", () => {
    const parsed = companyDto.matchCandidates.input.parse({
      jobDescription: "Senior Rust engineer role",
      workAuthRegions: ["eu"],
      sponsorshipRequired: "yes",
      workAuthStatusByRegion: { eu: "citizen" },
      authorizationFreshnessDays: 30,
    });

    expect(parsed.workAuthRegions).toEqual(["eu"]);
    expect(parsed.sponsorshipRequired).toBe("yes");
    expect(companyDto.matchCandidates.input.safeParse({ jobDescription: "too short" }).success).toBe(false);
  });

  it("accepts saved-list and contact payloads and rejects a bad status", () => {
    expect(
      companyDto.setSaved.input.parse({
        candidateUserId: userId,
        resumeId,
        listType: "favorite",
        saved: true,
      }).listType,
    ).toBe("favorite");

    expect(companyDto.createContactRequest.input.parse({ candidateUserId: userId, resumeId }).candidateUserId).toBe(
      userId,
    );

    expect(companyDto.respondToContactRequest.input.parse({ id: userId, decision: "accepted" }).decision).toBe(
      "accepted",
    );
    expect(companyDto.listSaved.input.safeParse({ listType: "archived" }).success).toBe(false);
    expect(companyDto.listContactRequests.input.safeParse({ status: "maybe" }).success).toBe(false);
  });

  it("trims a contact query and drops a blank one", () => {
    expect(companyDto.listContactRequests.input.parse({ query: "  ada  " }).query).toBe("ada");
    expect(companyDto.listContactRequests.input.parse({ query: "   " }).query).toBeUndefined();
    expect(companyDto.listMyContactRequests.input.parse({ status: "pending" }).status).toBe("pending");
  });
});
