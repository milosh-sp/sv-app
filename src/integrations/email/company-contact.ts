import { sendEmail } from "./service";

interface ContactRequestedInput {
  to: string;
  companyName: string;
  respondUrl: string;
}

export const sendCompanyContactRequestedEmail = async (input: ContactRequestedInput) => {
  await sendEmail({
    to: input.to,
    subject: `${input.companyName} wants to get in touch`,
    text: [
      `${input.companyName} saw your Skill Verdict profile and would like to connect.`,
      "",
      "Accept or decline the request here:",
      input.respondUrl,
      "",
      "Your email is not shared until you accept.",
    ].join("\n"),
  });
};

interface ContactAcceptedInput {
  to: string;
  otherPartyName: string;
  otherPartyEmail: string;
  isCompany: boolean;
}

export const sendCompanyContactAcceptedEmail = async (input: ContactAcceptedInput) => {
  const subject = input.isCompany
    ? `${input.otherPartyName} accepted your contact request`
    : `You accepted a contact request from ${input.otherPartyName}`;

  await sendEmail({
    to: input.to,
    subject,
    text: [
      input.isCompany
        ? `${input.otherPartyName} accepted your contact request on Skill Verdict.`
        : `You accepted a contact request from ${input.otherPartyName} on Skill Verdict.`,
      "",
      `You can reach them at: ${input.otherPartyEmail}`,
    ].join("\n"),
  });
};

interface ContactDeclinedInput {
  to: string;
  candidateName: string;
}

export const sendCompanyContactDeclinedEmail = async (input: ContactDeclinedInput) => {
  await sendEmail({
    to: input.to,
    subject: `${input.candidateName} declined your contact request`,
    text: [
      `${input.candidateName} declined your contact request on Skill Verdict.`,
      "",
      "No contact details were shared.",
    ].join("\n"),
  });
};
