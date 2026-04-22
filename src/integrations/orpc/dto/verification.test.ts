import { describe, expect, it } from "vite-plus/test";

import { resumeItemIdSchema, verificationDto } from "./verification";

// --- resumeItemIdSchema ---

describe("resumeItemIdSchema", () => {
  it("accepts a standard lowercase UUID", () => {
    expect(resumeItemIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
  });

  it("accepts an uppercase UUID (PostgreSQL accepts these, z.uuid() rejects them)", () => {
    expect(resumeItemIdSchema.safeParse("550E8400-E29B-41D4-A716-446655440000").success).toBe(true);
  });

  it("accepts a mixed-case UUID", () => {
    expect(resumeItemIdSchema.safeParse("550e8400-E29B-41d4-A716-446655440000").success).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(resumeItemIdSchema.safeParse("").success).toBe(false);
  });

  it("rejects a UUID missing the hyphens", () => {
    expect(resumeItemIdSchema.safeParse("550e8400e29b41d4a716446655440000").success).toBe(false);
  });

  it("rejects a UUID with an extra segment", () => {
    expect(resumeItemIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000-extra").success).toBe(false);
  });

  it("rejects a UUID with non-hex characters", () => {
    expect(resumeItemIdSchema.safeParse("gggggggg-e29b-41d4-a716-446655440000").success).toBe(false);
  });
});

// --- verificationDto.requestSkill.input ---

describe("verificationDto.requestSkill.input", () => {
  const validBase = {
    resumeId: "550e8400-e29b-41d4-a716-446655440000",
    itemId: "660f9511-f3ac-52e5-b827-557766551111",
    itemLabel: "TypeScript",
  };

  it("accepts a valid request", () => {
    expect(verificationDto.requestSkill.input.safeParse(validBase).success).toBe(true);
  });

  it("rejects when itemLabel is empty", () => {
    expect(verificationDto.requestSkill.input.safeParse({ ...validBase, itemLabel: "" }).success).toBe(false);
  });

  it("rejects when resumeId is not a valid UUID", () => {
    expect(verificationDto.requestSkill.input.safeParse({ ...validBase, resumeId: "not-a-uuid" }).success).toBe(false);
  });
});

// --- verificationDto.requestExperience.input ---

describe("verificationDto.requestExperience.input", () => {
  const validBase = {
    resumeId: "550e8400-e29b-41d4-a716-446655440000",
    itemId: "660f9511-f3ac-52e5-b827-557766551111",
    itemLabel: "Software Engineer at Acme",
    method: "document_upload" as const,
  };

  it("accepts document_upload method without optional fields", () => {
    expect(verificationDto.requestExperience.input.safeParse(validBase).success).toBe(true);
  });

  it("accepts document_upload method with a documentId", () => {
    const input = { ...validBase, documentId: "770a0622-f4bd-43f6-a938-668877662222" };
    expect(verificationDto.requestExperience.input.safeParse(input).success).toBe(true);
  });

  it("accepts freelancer_link method with a freelancerUrl", () => {
    const input = {
      ...validBase,
      method: "freelancer_link" as const,
      freelancerUrl: "https://www.freelancer.com/profile/test",
    };
    expect(verificationDto.requestExperience.input.safeParse(input).success).toBe(true);
  });

  it("rejects an unknown method value", () => {
    expect(verificationDto.requestExperience.input.safeParse({ ...validBase, method: "email_verify" }).success).toBe(
      false,
    );
  });

  it("rejects when freelancerUrl is not a valid URL", () => {
    const input = {
      ...validBase,
      method: "freelancer_link" as const,
      freelancerUrl: "not-a-url",
    };
    expect(verificationDto.requestExperience.input.safeParse(input).success).toBe(false);
  });

  it("rejects when itemLabel is empty", () => {
    expect(verificationDto.requestExperience.input.safeParse({ ...validBase, itemLabel: "" }).success).toBe(false);
  });

  it("rejects when resumeId is not a valid UUID", () => {
    expect(verificationDto.requestExperience.input.safeParse({ ...validBase, resumeId: "bad-id" }).success).toBe(false);
  });
});

// --- verificationDto.uploadDocument.input ---

describe("verificationDto.uploadDocument.input", () => {
  const file = new File(["data"], "payslip.pdf", { type: "application/pdf" });

  const validBase = {
    resumeId: "550e8400-e29b-41d4-a716-446655440000",
    itemId: "660f9511-f3ac-52e5-b827-557766551111",
    file,
    documentType: "payslip" as const,
  };

  it("accepts all valid documentType values", () => {
    for (const documentType of ["payslip", "contract", "freelancer_link"] as const) {
      expect(verificationDto.uploadDocument.input.safeParse({ ...validBase, documentType }).success).toBe(true);
    }
  });

  it("rejects an unknown documentType", () => {
    expect(verificationDto.uploadDocument.input.safeParse({ ...validBase, documentType: "invoice" }).success).toBe(
      false,
    );
  });

  it("rejects when file is not a File instance", () => {
    expect(verificationDto.uploadDocument.input.safeParse({ ...validBase, file: "path/to/file" }).success).toBe(false);
  });
});

// --- verificationDto.toggleBadge.input ---

describe("verificationDto.toggleBadge.input", () => {
  it("accepts valid toggle on", () => {
    expect(
      verificationDto.toggleBadge.input.safeParse({
        requestId: "550e8400-e29b-41d4-a716-446655440000",
        visible: true,
      }).success,
    ).toBe(true);
  });

  it("rejects non-boolean visible", () => {
    expect(
      verificationDto.toggleBadge.input.safeParse({
        requestId: "550e8400-e29b-41d4-a716-446655440000",
        visible: "yes",
      }).success,
    ).toBe(false);
  });
});

// --- verificationDto.getPublicStatus ---

describe("verificationDto.getPublicStatus", () => {
  it("accepts valid input", () => {
    expect(
      verificationDto.getPublicStatus.input.safeParse({
        resumeId: "550e8400-e29b-41d4-a716-446655440000",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid resumeId", () => {
    expect(
      verificationDto.getPublicStatus.input.safeParse({
        resumeId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid output payload with identity status", () => {
    expect(
      verificationDto.getPublicStatus.output.safeParse([
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          sectionType: "identity",
          itemId: "user-1",
          itemLabel: "Identity Verification",
          status: "verified",
          badgeVisible: true,
          submittedAt: new Date(),
        },
      ]).success,
    ).toBe(true);
  });
});

describe("verificationDto.getPrinterStatus", () => {
  it("accepts valid input", () => {
    expect(
      verificationDto.getPrinterStatus.input.safeParse({
        resumeId: "550e8400-e29b-41d4-a716-446655440000",
        token: "signed.token",
      }).success,
    ).toBe(true);
  });

  it("rejects empty token", () => {
    expect(
      verificationDto.getPrinterStatus.input.safeParse({
        resumeId: "550e8400-e29b-41d4-a716-446655440000",
        token: "",
      }).success,
    ).toBe(false);
  });
});
