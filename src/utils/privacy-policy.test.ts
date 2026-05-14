import { describe, expect, it } from "vite-plus/test";

import {
  getPrivacyPolicyAcceptance,
  PRIVACY_POLICY_CONTINUE_NOTICE,
  PRIVACY_POLICY_FORM_NOTICE,
  PRIVACY_POLICY_LINK_LABEL,
  PRIVACY_POLICY_URL,
  PRIVACY_POLICY_VERSION,
} from "./privacy-policy";

describe("privacy policy acceptance", () => {
  it("uses the live privacy policy URL as the tracked version", () => {
    expect(PRIVACY_POLICY_URL).toBe("https://skillverdict.com/privacy-policy");
    expect(PRIVACY_POLICY_VERSION).toBe(PRIVACY_POLICY_URL);
  });

  it("builds acceptance metadata for new signups", () => {
    const acceptedAt = new Date("2026-05-10T10:00:00.000Z");

    expect(getPrivacyPolicyAcceptance(acceptedAt)).toEqual({
      privacyPolicyAcceptedAt: acceptedAt,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    });
  });

  it("exposes the auth notice copy and link label", () => {
    expect(PRIVACY_POLICY_FORM_NOTICE).toBe("By submitting this form, you agree to our");
    expect(PRIVACY_POLICY_CONTINUE_NOTICE).toBe("By continuing, you agree to our");
    expect(PRIVACY_POLICY_LINK_LABEL).toBe("Privacy Policy");
  });
});
