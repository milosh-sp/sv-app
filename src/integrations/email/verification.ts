import { sendEmail } from "./service";

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
