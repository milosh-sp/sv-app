import { expect, test } from "vite-plus/test";

import { isVettedPoolCandidate } from "./vetted-pool";

test("isVettedPoolCandidate requires public, consent, identity, and a verified item", () => {
  expect(
    isVettedPoolCandidate({
      isPublic: true,
      workAuthConsentToShare: true,
      hasVerifiedIdentity: true,
      hasVerifiedSkillExperienceOrProject: true,
    }),
  ).toBe(true);

  expect(
    isVettedPoolCandidate({
      isPublic: false,
      workAuthConsentToShare: true,
      hasVerifiedIdentity: true,
      hasVerifiedSkillExperienceOrProject: true,
    }),
  ).toBe(false);

  expect(
    isVettedPoolCandidate({
      isPublic: true,
      workAuthConsentToShare: false,
      hasVerifiedIdentity: true,
      hasVerifiedSkillExperienceOrProject: true,
    }),
  ).toBe(false);

  expect(
    isVettedPoolCandidate({
      isPublic: true,
      workAuthConsentToShare: true,
      hasVerifiedIdentity: false,
      hasVerifiedSkillExperienceOrProject: true,
    }),
  ).toBe(false);

  expect(
    isVettedPoolCandidate({
      isPublic: true,
      workAuthConsentToShare: true,
      hasVerifiedIdentity: true,
      hasVerifiedSkillExperienceOrProject: false,
    }),
  ).toBe(false);
});
