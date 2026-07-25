/** Pure gate used by services/tests — SQL EXISTS helpers live next to the query. */
export function isVettedPoolCandidate(input: {
  isPublic: boolean;
  workAuthConsentToShare: boolean;
  hasVerifiedIdentity: boolean;
  hasVerifiedSkillExperienceOrProject: boolean;
}): boolean {
  return (
    input.isPublic &&
    input.workAuthConsentToShare &&
    input.hasVerifiedIdentity &&
    input.hasVerifiedSkillExperienceOrProject
  );
}
