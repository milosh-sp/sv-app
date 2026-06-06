import { sendEmail } from "./service";

interface IdentityVerificationRequestedInput {
  to: string;
  calLink: string;
}

export const sendIdentityVerificationRequestedEmail = async (input: IdentityVerificationRequestedInput) => {
  await sendEmail({
    to: input.to,
    subject: "Schedule Your Identity Verification Call",
    text: [
      "Thank you for requesting identity verification.",
      "",
      "To complete the process, please schedule a short video call using the link below:",
      "",
      input.calLink,
      "",
      "After the call, our team will verify your identity and update your profile status.",
    ].join("\n"),
  });
};

interface VerificationEmailInput {
  to: string;
  itemLabel: string;
  sectionType: string;
  supportEmail?: string;
}

export const sendVerificationVerifiedEmail = async (input: VerificationEmailInput) => {
  await sendEmail({
    to: input.to,
    subject: `Verification Complete: ${input.itemLabel}`,
    text: [
      `Your ${input.sectionType} verification for "${input.itemLabel}" has been verified.`,
      "",
      "The verification badge is now visible on your public CV.",
      "You can toggle badge visibility in your Privacy Settings.",
    ].join("\n"),
  });
};

export const sendVerificationRejectedEmail = async (input: VerificationEmailInput) => {
  await sendEmail({
    to: input.to,
    subject: `Verification Rejected: ${input.itemLabel}`,
    text: [
      `Your ${input.sectionType} verification for "${input.itemLabel}" has been rejected.`,
      "",
      "You may re-submit a new verification request after reviewing the requirements.",
      input.supportEmail ? `If you have questions, contact us at ${input.supportEmail}.` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
};

export const sendVerificationIssueEmail = async (input: VerificationEmailInput) => {
  await sendEmail({
    to: input.to,
    subject: `Verification Issue: ${input.itemLabel}`,
    text: [
      `There is an issue with your ${input.sectionType} verification for "${input.itemLabel}".`,
      "",
      "Please review the issue and re-submit when ready.",
      input.supportEmail ? `If you have questions, contact us at ${input.supportEmail}.` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
};

export const sendVerificationStatusEmail = async (
  status: "verified" | "rejected" | "issue",
  input: VerificationEmailInput,
) => {
  switch (status) {
    case "verified": {
      return await sendVerificationVerifiedEmail(input);
    }
    case "rejected": {
      return await sendVerificationRejectedEmail(input);
    }
    case "issue": {
      return await sendVerificationIssueEmail(input);
    }
  }
};

interface SkillAssessmentAcceptedEmailInput {
  to: string;
  itemLabel: string;
  reviewerName: string;
  message?: string;
  instructionsUrl: string;
  verificationDashboardUrl: string;
}

export const sendSkillAssessmentAcceptedEmail = async (input: SkillAssessmentAcceptedEmailInput) => {
  await sendEmail({
    to: input.to,
    subject: `Skill Assessment Accepted: ${input.itemLabel}`,
    text: [
      `Your skill verification request for "${input.itemLabel}" has been accepted by ${input.reviewerName}.`,
      "",
      input.message ? `Message from your reviewer:\n${input.message}` : "",
      input.message ? "" : "",
      "Download your assessment instructions:",
      input.instructionsUrl,
      "",
      "You can also view and download the instructions from your Verification dashboard:",
      input.verificationDashboardUrl,
      "",
      "Complete the assessment as described, then wait for the reviewer to evaluate your results.",
    ]
      .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
      .join("\n"),
  });
};
