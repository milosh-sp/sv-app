import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const sendEmail = vi.fn();

vi.mock("./service", () => ({ sendEmail }));

const { sendCompanyContactAcceptedEmail, sendCompanyContactDeclinedEmail, sendCompanyContactRequestedEmail } =
  await import("./company-contact");

beforeEach(() => {
  sendEmail.mockReset();
});

describe("company contact emails", () => {
  it("writes the request, both acceptance notices, and the decline", async () => {
    await sendCompanyContactRequestedEmail({
      to: "ada@example.com",
      companyName: "Acme",
      respondUrl: "https://app.test/respond",
    });
    await sendCompanyContactAcceptedEmail({
      to: "acme@example.com",
      otherPartyName: "Ada",
      otherPartyEmail: "ada@example.com",
      isCompany: true,
    });
    await sendCompanyContactAcceptedEmail({
      to: "ada@example.com",
      otherPartyName: "Acme",
      otherPartyEmail: "acme@example.com",
      isCompany: false,
    });
    await sendCompanyContactDeclinedEmail({ to: "acme@example.com", candidateName: "Ada" });

    expect(sendEmail.mock.calls.map((call) => call[0].subject)).toEqual([
      "Acme wants to get in touch",
      "Ada accepted your contact request",
      "You accepted a contact request from Acme",
      "Ada declined your contact request",
    ]);
    expect(sendEmail.mock.calls[0][0].text).toContain("https://app.test/respond");
    expect(sendEmail.mock.calls[1][0].text).toContain("ada@example.com");
    expect(sendEmail.mock.calls[3][0].text).toContain("No contact details were shared.");
  });
});
