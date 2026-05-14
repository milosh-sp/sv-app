export const PRIVACY_POLICY_URL = "https://skillverdict.com/privacy-policy";
export const PRIVACY_POLICY_VERSION = PRIVACY_POLICY_URL;

export const PRIVACY_POLICY_FORM_NOTICE = "By submitting this form, you agree to our";
export const PRIVACY_POLICY_CONTINUE_NOTICE = "By continuing, you agree to our";
export const PRIVACY_POLICY_LINK_LABEL = "Privacy Policy";

export function getPrivacyPolicyAcceptance(acceptedAt = new Date()) {
  return {
    privacyPolicyAcceptedAt: acceptedAt,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
  };
}
