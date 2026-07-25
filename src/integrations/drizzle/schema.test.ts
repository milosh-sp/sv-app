import { describe, expect, it } from "vite-plus/test";

import {
    adminRoleEnum,
    adminRoles,
    changeRequestStatusEnum,
    companyContactRequests,
    companyContactStatusEnum,
    companySavedCandidates,
    companySavedListTypeEnum,
    documentTypeEnum,
    metadataActionEnum,
    resume,
    resumeVerificationSettings,
    reviewerProfileChangeRequests,
    reviewerProfiles,
    user,
    verificationDocuments,
    verificationMetadata,
    verificationMethodEnum,
    verificationRequests,
    verificationSectionTypeEnum,
    verificationStatusEnum,
} from "./schema";

describe("verification enums", () => {
  it("adminRoleEnum has correct values", () => {
    expect(adminRoleEnum.enumValues).toEqual(["skill_verdict_admin", "reviewer_admin", "company"]);
  });

  it("verificationSectionTypeEnum includes identity", () => {
    expect(verificationSectionTypeEnum.enumValues).toEqual(["skill", "experience", "project", "identity"]);
  });

  it("verificationStatusEnum has all statuses", () => {
    expect(verificationStatusEnum.enumValues).toEqual([
      "pending",
      "claimed",
      "verdict_pending",
      "verified",
      "rejected",
      "issue",
    ]);
  });

  it("verificationMethodEnum has correct methods", () => {
    expect(verificationMethodEnum.enumValues).toEqual(["document_upload", "freelancer_link", "identity_call"]);
  });

  it("changeRequestStatusEnum has correct values", () => {
    expect(changeRequestStatusEnum.enumValues).toEqual(["pending", "approved", "rejected"]);
  });

  it("metadataActionEnum has correct actions", () => {
    expect(metadataActionEnum.enumValues).toEqual([
      "claimed",
      "verdict_submitted",
      "solution_submitted",
      "verified",
      "rejected",
      "flagged",
      "overridden",
    ]);
  });

  it("documentTypeEnum has correct types", () => {
    expect(documentTypeEnum.enumValues).toEqual([
      "payslip",
      "contract",
      "freelancer_link",
      "assessment_instructions",
      "assessment_solution",
      "assessment_solution_link",
    ]);
  });
});

describe("adminRoles table", () => {
  it("has required columns", () => {
    expect(adminRoles.id).toBeDefined();
    expect(adminRoles.userId).toBeDefined();
    expect(adminRoles.role).toBeDefined();
    expect(adminRoles.createdAt).toBeDefined();
  });

  it("userId is not nullable", () => {
    expect(adminRoles.userId.notNull).toBe(true);
  });
});

describe("company tables", () => {
  it("has contact and saved enums", () => {
    expect(companyContactStatusEnum.enumValues).toEqual(["pending", "accepted", "declined"]);
    expect(companySavedListTypeEnum.enumValues).toEqual(["favorite", "to_contact"]);
  });

  it("has contact request and saved candidate tables", () => {
    expect(companyContactRequests.companyUserId).toBeDefined();
    expect(companyContactRequests.candidateUserId).toBeDefined();
    expect(companyContactRequests.status).toBeDefined();
    expect(companySavedCandidates.listType).toBeDefined();
  });
});

describe("user table privacy policy acceptance", () => {
  it("has required privacy policy acceptance columns", () => {
    expect(user.privacyPolicyAcceptedAt).toBeDefined();
    expect(user.privacyPolicyVersion).toBeDefined();
  });

  it("privacyPolicyAcceptedAt is required", () => {
    expect(user.privacyPolicyAcceptedAt.notNull).toBe(true);
  });
});

describe("reviewerProfiles table", () => {
  it("has all required columns", () => {
    expect(reviewerProfiles.id).toBeDefined();
    expect(reviewerProfiles.adminId).toBeDefined();
    expect(reviewerProfiles.firstName).toBeDefined();
    expect(reviewerProfiles.lastName).toBeDefined();
    expect(reviewerProfiles.title).toBeDefined();
    expect(reviewerProfiles.publicProfileUrl).toBeDefined();
    expect(reviewerProfiles.consentGiven).toBeDefined();
    expect(reviewerProfiles.consentGivenAt).toBeDefined();
    expect(reviewerProfiles.reviewerSkills).toBeDefined();
    expect(reviewerProfiles.createdAt).toBeDefined();
    expect(reviewerProfiles.updatedAt).toBeDefined();
  });

  it("consentGivenAt is nullable", () => {
    expect(reviewerProfiles.consentGivenAt.notNull).toBe(false);
  });

  it("adminId is not nullable", () => {
    expect(reviewerProfiles.adminId.notNull).toBe(true);
  });
});

describe("reviewerProfileChangeRequests table", () => {
  it("has all required columns", () => {
    expect(reviewerProfileChangeRequests.id).toBeDefined();
    expect(reviewerProfileChangeRequests.adminId).toBeDefined();
    expect(reviewerProfileChangeRequests.requestedFirstName).toBeDefined();
    expect(reviewerProfileChangeRequests.requestedTitle).toBeDefined();
    expect(reviewerProfileChangeRequests.status).toBeDefined();
    expect(reviewerProfileChangeRequests.requestedAt).toBeDefined();
    expect(reviewerProfileChangeRequests.resolvedAt).toBeDefined();
    expect(reviewerProfileChangeRequests.resolvedByAdminId).toBeDefined();
    expect(reviewerProfileChangeRequests.rejectionReason).toBeDefined();
  });

  it("nullable fields accept null", () => {
    expect(reviewerProfileChangeRequests.requestedFirstName.notNull).toBe(false);
    expect(reviewerProfileChangeRequests.requestedTitle.notNull).toBe(false);
    expect(reviewerProfileChangeRequests.resolvedAt.notNull).toBe(false);
    expect(reviewerProfileChangeRequests.resolvedByAdminId.notNull).toBe(false);
    expect(reviewerProfileChangeRequests.rejectionReason.notNull).toBe(false);
  });
});

describe("verificationRequests table", () => {
  it("has all required columns", () => {
    expect(verificationRequests.id).toBeDefined();
    expect(verificationRequests.userId).toBeDefined();
    expect(verificationRequests.resumeId).toBeDefined();
    expect(verificationRequests.sectionType).toBeDefined();
    expect(verificationRequests.itemId).toBeDefined();
    expect(verificationRequests.itemLabel).toBeDefined();
    expect(verificationRequests.status).toBeDefined();
    expect(verificationRequests.method).toBeDefined();
    expect(verificationRequests.submittedAt).toBeDefined();
    expect(verificationRequests.claimedAt).toBeDefined();
    expect(verificationRequests.claimedByAdminId).toBeDefined();
    expect(verificationRequests.resolvedAt).toBeDefined();
    expect(verificationRequests.reviewerNote).toBeDefined();
    expect(verificationRequests.badgeVisible).toBeDefined();
    expect(verificationRequests.calendarLinkSentAt).toBeDefined();
  });

  it("resumeId is nullable", () => {
    expect(verificationRequests.resumeId.notNull).toBe(false);
  });

  it("method is nullable", () => {
    expect(verificationRequests.method.notNull).toBe(false);
  });

  it("claimedAt is nullable", () => {
    expect(verificationRequests.claimedAt.notNull).toBe(false);
  });

  it("calendarLinkSentAt is nullable", () => {
    expect(verificationRequests.calendarLinkSentAt.notNull).toBe(false);
  });

  it("badgeVisible is not nullable and defaults to true", () => {
    expect(verificationRequests.badgeVisible.notNull).toBe(true);
  });
});

describe("verificationMetadata table", () => {
  it("has all required columns", () => {
    expect(verificationMetadata.id).toBeDefined();
    expect(verificationMetadata.verificationRequestId).toBeDefined();
    expect(verificationMetadata.adminId).toBeDefined();
    expect(verificationMetadata.adminRole).toBeDefined();
    expect(verificationMetadata.action).toBeDefined();
    expect(verificationMetadata.notes).toBeDefined();
    expect(verificationMetadata.reviewerSnapshotFirstName).toBeDefined();
    expect(verificationMetadata.reviewerSnapshotLastName).toBeDefined();
    expect(verificationMetadata.reviewerSnapshotTitle).toBeDefined();
    expect(verificationMetadata.reviewerPublicProfileUrl).toBeDefined();
    expect(verificationMetadata.actedAt).toBeDefined();
  });

  it("snapshot fields are nullable", () => {
    expect(verificationMetadata.reviewerSnapshotFirstName.notNull).toBe(false);
    expect(verificationMetadata.reviewerSnapshotLastName.notNull).toBe(false);
    expect(verificationMetadata.reviewerSnapshotTitle.notNull).toBe(false);
    expect(verificationMetadata.reviewerPublicProfileUrl.notNull).toBe(false);
  });

  it("notes is nullable", () => {
    expect(verificationMetadata.notes.notNull).toBe(false);
  });
});

describe("verificationDocuments table", () => {
  it("has all required columns", () => {
    expect(verificationDocuments.id).toBeDefined();
    expect(verificationDocuments.verificationRequestId).toBeDefined();
    expect(verificationDocuments.fileUrl).toBeDefined();
    expect(verificationDocuments.documentType).toBeDefined();
    expect(verificationDocuments.uploadedAt).toBeDefined();
  });

  it("fileUrl is not nullable", () => {
    expect(verificationDocuments.fileUrl.notNull).toBe(true);
  });
});

describe("resumeVerificationSettings table", () => {
  it("has all required columns", () => {
    expect(resumeVerificationSettings.id).toBeDefined();
    expect(resumeVerificationSettings.resumeId).toBeDefined();
    expect(resumeVerificationSettings.showTimeline).toBeDefined();
    expect(resumeVerificationSettings.createdAt).toBeDefined();
    expect(resumeVerificationSettings.updatedAt).toBeDefined();
  });

  it("showTimeline is not nullable", () => {
    expect(resumeVerificationSettings.showTimeline.notNull).toBe(true);
  });

  it("resumeId is not nullable", () => {
    expect(resumeVerificationSettings.resumeId.notNull).toBe(true);
  });
});

describe("resume table work authorization columns", () => {
  it("includes indexed work authorization fields", () => {
    expect(resume.workAuthEuStatus).toBeDefined();
    expect(resume.workAuthUsaStatus).toBeDefined();
    expect(resume.workAuthUkStatus).toBeDefined();
    expect(resume.workAuthEuSponsorshipRequired).toBeDefined();
    expect(resume.workAuthUsaSponsorshipRequired).toBeDefined();
    expect(resume.workAuthUkSponsorshipRequired).toBeDefined();
    expect(resume.workAuthConsentToShare).toBeDefined();
    expect(resume.workAuthUpdatedAt).toBeDefined();
    expect(resume.workAuthSearchTokens).toBeDefined();
  });

  it("uses non-nullable defaults for searchable columns", () => {
    expect(resume.workAuthEuStatus.notNull).toBe(true);
    expect(resume.workAuthUsaStatus.notNull).toBe(true);
    expect(resume.workAuthUkStatus.notNull).toBe(true);
    expect(resume.workAuthConsentToShare.notNull).toBe(true);
    expect(resume.workAuthSearchTokens.notNull).toBe(true);
  });
});
