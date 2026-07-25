/** Pure gate used by services/tests — SQL EXISTS helpers live next to the query.
 * Work-auth consent is not a pool gate: it only controls sharing/filtering of work-auth details. */
export function isVettedPoolCandidate(input: {
  isPublic: boolean;
  hasVerifiedIdentity: boolean;
  hasVerifiedSkillExperienceOrProject: boolean;
}): boolean {
  return input.isPublic && input.hasVerifiedIdentity && input.hasVerifiedSkillExperienceOrProject;
}
