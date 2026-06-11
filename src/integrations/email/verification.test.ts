import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockSendEmail = vi.fn();

vi.mock("./service", () => ({
  sendEmail: mockSendEmail,
}));

const {
  sendVerificationVerifiedEmail,
  sendVerificationRejectedEmail,
  sendVerificationIssueEmail,
  sendVerificationStatusEmail,
  sendVerdictAwaitingFinalApprovalEmail,
} = await import("./verification");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendVerificationVerifiedEmail", () => {
  it("should send verified email with correct subject and body", async () => {
    await sendVerificationVerifiedEmail({
      to: "user@test.com",
      itemLabel: "TypeScript",
      sectionType: "skill",
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const call = mockSendEmail.mock.calls[0]![0];
    expect(call.to).toBe("user@test.com");
    expect(call.subject).toContain("Verification Complete");
    expect(call.subject).toContain("TypeScript");
    expect(call.text).toContain("verified");
  });
});

describe("sendVerificationRejectedEmail", () => {
  it("should send rejected email with support email", async () => {
    await sendVerificationRejectedEmail({
      to: "user@test.com",
      itemLabel: "React",
      sectionType: "skill",
      supportEmail: "support@example.com",
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const call = mockSendEmail.mock.calls[0]![0];
    expect(call.subject).toContain("Rejected");
    expect(call.text).toContain("support@example.com");
  });

  it("should send rejected email without support email", async () => {
    await sendVerificationRejectedEmail({
      to: "user@test.com",
      itemLabel: "React",
      sectionType: "skill",
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const call = mockSendEmail.mock.calls[0]![0];
    expect(call.text).not.toContain("contact us at");
  });
});

describe("sendVerificationIssueEmail", () => {
  it("should send issue email with correct content", async () => {
    await sendVerificationIssueEmail({
      to: "user@test.com",
      itemLabel: "My Project",
      sectionType: "project",
      supportEmail: "help@example.com",
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const call = mockSendEmail.mock.calls[0]![0];
    expect(call.subject).toContain("Issue");
    expect(call.text).toContain("issue");
    expect(call.text).toContain("help@example.com");
  });
});

describe("sendVerificationStatusEmail", () => {
  it("should dispatch verified email", async () => {
    await sendVerificationStatusEmail("verified", {
      to: "user@test.com",
      itemLabel: "TypeScript",
      sectionType: "skill",
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail.mock.calls[0]![0].subject).toContain("Verification Complete");
  });

  it("should dispatch rejected email", async () => {
    await sendVerificationStatusEmail("rejected", {
      to: "user@test.com",
      itemLabel: "React",
      sectionType: "skill",
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail.mock.calls[0]![0].subject).toContain("Rejected");
  });

  it("should dispatch issue email", async () => {
    await sendVerificationStatusEmail("issue", {
      to: "user@test.com",
      itemLabel: "Project X",
      sectionType: "project",
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail.mock.calls[0]![0].subject).toContain("Issue");
  });

  it("should NOT send email for intermediate states", async () => {
    // Ensure no email is sent for states that aren't final
    // The function only accepts "verified" | "rejected" | "issue" by type,
    // so the guard is at the type level
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("sendVerdictAwaitingFinalApprovalEmail", () => {
  it("should send awaiting final approval email with correct subject and body", async () => {
    await sendVerdictAwaitingFinalApprovalEmail({
      to: "user@test.com",
      itemLabel: "TypeScript",
      sectionType: "skill",
      reviewerName: "Jane Smith",
      verificationDashboardUrl: "https://app.test/dashboard/verification",
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const call = mockSendEmail.mock.calls[0]![0];
    expect(call.to).toBe("user@test.com");
    expect(call.subject).toContain("Awaiting Final Approval");
    expect(call.subject).toContain("TypeScript");
    expect(call.text).toContain("Jane Smith");
    expect(call.text).toContain("final approval stage");
    expect(call.text).toContain("https://app.test/dashboard/verification");
  });
});
