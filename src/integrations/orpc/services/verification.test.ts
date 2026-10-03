// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
    sendIdentityVerificationRequestedEmail,
    sendSkillAssessmentAcceptedEmail,
} from "@/integrations/email/verification";
import { env } from "@/utils/env";
import { deriveSkillKeywordId } from "@/utils/verification/skills";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockReturning = vi.fn();
const mockLimit = vi.fn((): any => []);

function createThenableRows(rows: unknown[] = []) {
  return Object.assign(Promise.resolve(rows), {
    limit: mockLimit,
    orderBy: mockOrderBy,
  });
}

const mockOrderBy = vi.fn((): any => createThenableRows([]));
const mockWhere = vi.fn((): any =>
  Object.assign(Promise.resolve([]), {
    returning: mockReturning,
    limit: mockLimit,
    orderBy: mockOrderBy,
  }),
);
const mockSet = vi.fn((): any => ({ where: mockWhere, returning: mockReturning }));
const mockValues = vi.fn((): any => ({ returning: mockReturning }));
const mockFrom = vi.fn((): any => ({ where: mockWhere, limit: mockLimit, orderBy: mockOrderBy }));
const mockSelect = vi.fn((): any => ({ from: mockFrom }));

const mockDeleteWhere = vi.fn((): any => undefined);
const mockDelete = vi.fn((): any => ({ where: mockDeleteWhere }));

const mockTransaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
  const tx = {
    insert: vi.fn((): any => ({ values: vi.fn().mockResolvedValue(undefined) })),
    select: mockSelect,
  };
  return callback(tx);
});

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: mockSelect,
    insert: vi.fn((): any => ({ values: mockValues })),
    update: vi.fn((): any => ({ set: mockSet })),
    delete: mockDelete,
    transaction: mockTransaction,
  },
}));

const mockStorageRead = vi.fn();
const mockStorageDelete = vi.fn();

const mockUploadFile = vi.fn();

vi.mock("./storage", () => ({
  getStorageService: () => ({
    read: mockStorageRead,
    delete: mockStorageDelete,
  }),
  uploadFile: mockUploadFile,
  toStorageKey: (stored: string) => {
    if (stored.startsWith("uploads/")) {
      return stored;
    }
    if (stored.startsWith("http://") || stored.startsWith("https://")) {
      const pathname = new URL(stored).pathname;
      return pathname.startsWith("/") ? pathname.slice(1) : pathname;
    }
    return stored;
  },
  toPublicFileUrl: (key: string) => `https://app.test/${key}`,
}));

vi.mock("@/integrations/email/verification", () => ({
  sendAssessmentSolutionSubmittedEmail: vi.fn(),
  sendIdentityVerificationRequestedEmail: vi.fn(),
  sendSkillAssessmentAcceptedEmail: vi.fn(),
  sendVerdictAwaitingFinalApprovalEmail: vi.fn(),
  sendVerificationStatusEmail: vi.fn(),
}));

vi.mock("@/integrations/drizzle/schema", () => ({
  verificationRequests: {
    id: "id",
    userId: "user_id",
    resumeId: "resume_id",
    sectionType: "section_type",
    itemId: "item_id",
    itemLabel: "item_label",
    status: "status",
    method: "method",
    submittedAt: "submitted_at",
    claimedAt: "claimed_at",
    claimedByAdminId: "claimed_by_admin_id",
    resolvedAt: "resolved_at",
    reviewerNote: "reviewer_note",
    proposedVerdict: "proposed_verdict",
    badgeVisible: "badge_visible",
    calendarLinkSentAt: "calendar_link_sent_at",
    assessmentAcceptedAt: "assessment_accepted_at",
  },
  verificationMetadata: {
    id: "id",
    verificationRequestId: "verification_request_id",
    adminId: "admin_id",
    adminRole: "admin_role",
    action: "action",
    notes: "notes",
    reviewerSnapshotFirstName: "reviewer_snapshot_first_name",
    reviewerSnapshotLastName: "reviewer_snapshot_last_name",
    reviewerSnapshotTitle: "reviewer_snapshot_title",
    reviewerPublicProfileUrl: "reviewer_public_profile_url",
    actedAt: "acted_at",
  },
  verificationDocuments: {
    id: "id",
    verificationRequestId: "verification_request_id",
    fileUrl: "file_url",
    documentType: "document_type",
    uploadedAt: "uploaded_at",
  },
  resumeVerificationSettings: {
    id: "id",
    resumeId: "resume_id",
    showTimeline: "show_timeline",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  reviewerProfiles: {
    id: "id",
    adminId: "admin_id",
    firstName: "first_name",
    lastName: "last_name",
    title: "title",
    publicProfileUrl: "public_profile_url",
    consentGiven: "consent_given",
    consentGivenAt: "consent_given_at",
    reviewerSkills: "reviewer_skills",
  },
  resume: {
    id: "id",
    userId: "user_id",
    isPublic: "is_public",
    data: "data",
  },
  user: {
    id: "id",
    email: "email",
  },
}));

const { verificationService } = await import("./verification");

const skillParentId = "019bef5a-93e4-7746-ad39-622f9d41da55";
const skillKeywordId = deriveSkillKeywordId(skillParentId, "TypeScript");

function createResumeWithSkillKeyword() {
  return {
    data: {
      sections: {
        skills: {
          items: [
            {
              id: skillParentId,
              hidden: false,
              icon: "code",
              name: "Programming Languages",
              proficiency: "Expert",
              level: 5,
              keywords: ["TypeScript"],
            },
          ],
        },
      },
    },
  };
}

beforeEach(() => {
  mockLimit.mockReset();
  mockReturning.mockReset();
  mockOrderBy.mockReset();
  mockWhere.mockReset();
  mockFrom.mockReset();
  mockSelect.mockReset();
  mockSet.mockReset();
  mockValues.mockReset();
  mockTransaction.mockReset();
  mockUploadFile.mockReset();
  mockStorageRead.mockReset();
  mockStorageDelete.mockReset();

  mockLimit.mockReturnValue([]);
  mockReturning.mockResolvedValue([]);
  mockFrom.mockImplementation(() => ({ where: mockWhere, limit: mockLimit, orderBy: mockOrderBy }));
  mockSelect.mockImplementation(() => ({ from: mockFrom }));
  mockSet.mockImplementation(() => ({ where: mockWhere, returning: mockReturning }));
  mockValues.mockImplementation(() => ({ returning: mockReturning }));
  mockOrderBy.mockImplementation(() => createThenableRows([]));
  mockWhere.mockImplementation(() =>
    Object.assign(Promise.resolve([]), {
      returning: mockReturning,
      limit: mockLimit,
      orderBy: mockOrderBy,
    }),
  );
  mockTransaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn((): any => ({ values: vi.fn().mockResolvedValue(undefined) })),
      select: mockSelect,
    };
    return callback(tx);
  });
});

describe("verificationService.requestSkill", () => {
  it("should create a skill verification request", async () => {
    mockLimit.mockReturnValueOnce([createResumeWithSkillKeyword()]).mockReturnValueOnce([]);
    const request = { id: "req-1", sectionType: "skill", status: "pending" };
    mockReturning.mockResolvedValueOnce([request]);

    const result = await verificationService.requestSkill({
      userId: "user-1",
      resumeId: "resume-1",
      itemId: skillKeywordId,
      itemLabel: "TypeScript",
    });

    expect(result.sectionType).toBe("skill");
    expect(result.status).toBe("pending");
  });

  it("should error if active request exists", async () => {
    mockLimit
      .mockReturnValueOnce([createResumeWithSkillKeyword()])
      .mockReturnValueOnce([{ id: "existing", status: "pending" }]);

    await expect(
      verificationService.requestSkill({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: skillKeywordId,
        itemLabel: "TypeScript",
      }),
    ).rejects.toThrow("An active verification request already exists");
  });

  it("should error when status is claimed", async () => {
    mockLimit
      .mockReturnValueOnce([createResumeWithSkillKeyword()])
      .mockReturnValueOnce([{ id: "existing", status: "claimed" }]);

    await expect(
      verificationService.requestSkill({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: skillKeywordId,
        itemLabel: "TypeScript",
      }),
    ).rejects.toThrow("An active verification request already exists");
  });

  it("should error when status is verdict_pending", async () => {
    mockLimit
      .mockReturnValueOnce([createResumeWithSkillKeyword()])
      .mockReturnValueOnce([{ id: "existing", status: "verdict_pending" }]);

    await expect(
      verificationService.requestSkill({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: skillKeywordId,
        itemLabel: "TypeScript",
      }),
    ).rejects.toThrow("An active verification request already exists");
  });

  it("should reject parent category ids when keywords exist", async () => {
    mockLimit.mockReturnValueOnce([createResumeWithSkillKeyword()]);

    await expect(
      verificationService.requestSkill({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: skillParentId,
        itemLabel: "Programming Languages",
      }),
    ).rejects.toThrow("Invalid skill item");
  });
});

describe("verificationService.requestProject", () => {
  it("should create a project verification request", async () => {
    mockLimit.mockReturnValueOnce([]);
    const request = { id: "req-2", sectionType: "project", status: "pending" };
    mockReturning.mockResolvedValueOnce([request]);

    const result = await verificationService.requestProject({
      userId: "user-1",
      resumeId: "resume-1",
      itemId: "item-2",
      itemLabel: "My Project",
    });

    expect(result.sectionType).toBe("project");
    expect(result.status).toBe("pending");
  });
});

describe("verificationService.requestExperience", () => {
  it("should create with document_upload method and always be pending", async () => {
    mockLimit.mockReturnValueOnce([]);
    const request = { id: "req-3", sectionType: "experience", status: "pending", method: "document_upload" };
    mockReturning.mockResolvedValueOnce([request]);

    const result = await verificationService.requestExperience({
      userId: "user-1",
      resumeId: "resume-1",
      itemId: "item-3",
      itemLabel: "Software Engineer at Acme",
      method: "document_upload",
    });

    expect(result.status).toBe("pending");
    expect(result.method).toBe("document_upload");
  });

  it("should create with freelancer_link method", async () => {
    mockLimit.mockReturnValueOnce([]);
    const request = { id: "req-4", sectionType: "experience", status: "pending", method: "freelancer_link" };
    mockReturning.mockResolvedValueOnce([request]);

    const result = await verificationService.requestExperience({
      userId: "user-1",
      resumeId: "resume-1",
      itemId: "item-4",
      itemLabel: "Freelance",
      method: "freelancer_link",
    });

    expect(result.status).toBe("pending");
    expect(result.method).toBe("freelancer_link");
  });

  it("should store freelancer URL as a document when provided", async () => {
    mockLimit.mockReturnValueOnce([]);
    const request = { id: "req-5", sectionType: "experience", status: "pending", method: "freelancer_link" };
    mockReturning.mockResolvedValueOnce([request]);

    const { db } = await import("@/integrations/drizzle/client");
    const insertSpy = vi.spyOn(db, "insert");
    insertSpy.mockClear();

    const result = await verificationService.requestExperience({
      userId: "user-1",
      resumeId: "resume-1",
      itemId: "item-5",
      itemLabel: "Freelance Gig",
      method: "freelancer_link",
      freelancerUrl: "https://www.upwork.com/freelancers/~abc",
    });

    expect(result.status).toBe("pending");
    expect(insertSpy).toHaveBeenCalledTimes(2);
    insertSpy.mockRestore();
  });
});

describe("verificationService.requestIdentity", () => {
  it("should create identity request with null resumeId", async () => {
    mockLimit.mockReturnValueOnce([]);
    const request = {
      id: "req-5",
      sectionType: "identity",
      status: "pending",
      method: "identity_call",
      calendarLinkSentAt: new Date(),
      resumeId: null,
    };
    mockReturning.mockResolvedValueOnce([request]);

    const result = await verificationService.requestIdentity("user-1");

    expect(result.sectionType).toBe("identity");
    expect(result.resumeId).toBeNull();
    expect(result.calendarLinkSentAt).toBeDefined();
  });

  it("should error if pending identity request exists", async () => {
    mockLimit.mockReturnValueOnce([{ id: "existing", status: "pending" }]);

    await expect(verificationService.requestIdentity("user-1")).rejects.toThrow(
      "An active verification request already exists",
    );
  });
});

describe("verificationService.toggleBadge", () => {
  it("should toggle when verified", async () => {
    mockLimit.mockReturnValueOnce([{ status: "verified", userId: "user-1" }]);
    mockReturning.mockResolvedValueOnce([{ id: "req-1", badgeVisible: false }]);

    const result = await verificationService.toggleBadge({
      userId: "user-1",
      requestId: "req-1",
      visible: false,
    });

    expect(result.badgeVisible).toBe(false);
  });

  it("should error when not verified", async () => {
    mockLimit.mockReturnValueOnce([{ status: "pending", userId: "user-1" }]);

    await expect(
      verificationService.toggleBadge({
        userId: "user-1",
        requestId: "req-1",
        visible: false,
      }),
    ).rejects.toThrow("Badge visibility can only be toggled for verified requests");
  });

  it("should error when not found", async () => {
    mockLimit.mockReturnValueOnce([]);

    await expect(
      verificationService.toggleBadge({
        userId: "user-1",
        requestId: "non-existent",
        visible: false,
      }),
    ).rejects.toThrow("Verification request not found");
  });
});

describe("verificationService.getBadgeDetail", () => {
  it("should return null when status is not approved", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "pending", sectionType: "skill" }]);

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toBeNull();
  });

  it("should return null when request not found", async () => {
    mockLimit.mockReturnValueOnce([]);

    const result = await verificationService.getBadgeDetail("non-existent");

    expect(result).toBeNull();
  });

  it("should return null when the badge is hidden", async () => {
    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        status: "verified",
        sectionType: "skill",
        badgeVisible: false,
        userId: "user-1",
        resumeId: "resume-1",
      },
    ]);

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toBeNull();
  });

  it("should return null when the resume is not public", async () => {
    mockLimit
      .mockReturnValueOnce([
        {
          id: "req-1",
          status: "verified",
          sectionType: "skill",
          badgeVisible: true,
          userId: "user-1",
          resumeId: "resume-1",
        },
      ])
      .mockReturnValueOnce([]);

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toBeNull();
  });

  it("should return identity label for identity type", async () => {
    mockLimit
      .mockReturnValueOnce([
        {
          id: "req-1",
          status: "verified",
          sectionType: "identity",
          badgeVisible: true,
          userId: "user-1",
          resumeId: null,
        },
      ])
      .mockReturnValueOnce([{ id: "resume-1" }]);

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toEqual({ type: "identity", label: "Identity Verified" });
  });

  it("should return role label for experience type", async () => {
    mockLimit
      .mockReturnValueOnce([
        {
          id: "req-1",
          status: "verified",
          sectionType: "experience",
          badgeVisible: true,
          userId: "user-1",
          resumeId: "resume-1",
        },
      ])
      .mockReturnValueOnce([{ id: "resume-1" }]);

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toEqual({ type: "experience", label: "Verified by Skill Verdict Admin" });
  });

  it("should return snapshot data for skill type", async () => {
    mockLimit
      .mockReturnValueOnce([
        {
          id: "req-1",
          status: "verified",
          sectionType: "skill",
          badgeVisible: true,
          userId: "user-1",
          resumeId: "resume-1",
        },
      ])
      .mockReturnValueOnce([{ id: "resume-1" }])
      .mockReturnValueOnce([
        {
          reviewerSnapshotFirstName: "Jane",
          reviewerSnapshotLastName: "Smith",
          reviewerSnapshotTitle: "Senior Engineer at Meta",
          reviewerPublicProfileUrl: "/reviewer/admin-1",
        },
      ]);

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toEqual({
      type: "reviewer",
      label: "Jane Smith \u2014 Senior Engineer at Meta",
      profileUrl: "/reviewer/admin-1",
    });
  });

  it("should return snapshot data for project type", async () => {
    mockLimit
      .mockReturnValueOnce([
        {
          id: "req-1",
          status: "verified",
          sectionType: "project",
          badgeVisible: true,
          userId: "user-1",
          resumeId: "resume-1",
        },
      ])
      .mockReturnValueOnce([{ id: "resume-1" }])
      .mockReturnValueOnce([
        {
          reviewerSnapshotFirstName: "John",
          reviewerSnapshotLastName: "Doe",
          reviewerSnapshotTitle: "Staff Engineer",
          reviewerPublicProfileUrl: "/reviewer/admin-2",
        },
      ]);

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toEqual({
      type: "reviewer",
      label: "John Doe \u2014 Staff Engineer",
      profileUrl: "/reviewer/admin-2",
    });
  });

  it("should fall back to verdict_submitted snapshot when verified metadata lacks reviewer name", async () => {
    mockLimit
      .mockReturnValueOnce([
        {
          id: "req-1",
          status: "verified",
          sectionType: "skill",
          badgeVisible: true,
          userId: "user-1",
          resumeId: "resume-1",
        },
      ])
      .mockReturnValueOnce([{ id: "resume-1" }])
      .mockReturnValueOnce([
        {
          reviewerSnapshotFirstName: null,
          reviewerSnapshotLastName: null,
          reviewerSnapshotTitle: null,
          reviewerPublicProfileUrl: null,
        },
      ]);

    mockOrderBy.mockReturnValueOnce(createThenableRows()).mockReturnValueOnce(
      createThenableRows([
        {
          reviewerSnapshotFirstName: "Jane",
          reviewerSnapshotLastName: "Smith",
          reviewerSnapshotTitle: "Senior Engineer",
          reviewerPublicProfileUrl: "/reviewer/admin-1",
        },
      ]),
    );

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toEqual({
      type: "reviewer",
      label: "Jane Smith \u2014 Senior Engineer",
      profileUrl: "/reviewer/admin-1",
    });
  });
});

describe("verificationService.getStatus", () => {
  it("should return verification statuses for a resume", async () => {
    const statuses = [
      {
        id: "req-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "TS",
        status: "verified",
        badgeVisible: true,
        assessmentAcceptedAt: null,
      },
    ];
    const identityStatus = {
      id: "req-id",
      sectionType: "identity",
      itemId: "user-1",
      itemLabel: "Identity Verification",
      status: "verified",
      badgeVisible: true,
      submittedAt: new Date(),
      assessmentAcceptedAt: null,
    };
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => statuses), limit: mockLimit, orderBy: mockOrderBy })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([])), limit: mockLimit, orderBy: mockOrderBy })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => [identityStatus]) })) })),
        limit: mockLimit,
        orderBy: mockOrderBy,
      });

    const result = await verificationService.getStatus({ userId: "user-1", resumeId: "resume-1" });

    expect(result).toEqual([
      {
        ...statuses[0],
        assessmentInstructionsUrl: null,
        assessmentSolutionSubmittedAt: null,
        assessmentSolutionFileUrl: null,
        assessmentSolutionLinkUrl: null,
        assessmentAcceptedAt: null,
      },
      {
        ...identityStatus,
        assessmentInstructionsUrl: null,
        assessmentSolutionSubmittedAt: null,
        assessmentSolutionFileUrl: null,
        assessmentSolutionLinkUrl: null,
        assessmentAcceptedAt: null,
      },
    ]);
  });

  it("should not include internal fields", async () => {
    const statuses = [
      {
        id: "req-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "TS",
        status: "verified",
        badgeVisible: true,
        assessmentAcceptedAt: null,
      },
    ];
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => statuses), limit: mockLimit, orderBy: mockOrderBy })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([])), limit: mockLimit, orderBy: mockOrderBy })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => []) })) })),
        limit: mockLimit,
        orderBy: mockOrderBy,
      });

    const result = await verificationService.getStatus({ userId: "user-1", resumeId: "resume-1" });
    const first = result[0];

    expect(first).not.toHaveProperty("reviewerNote");
    expect(first).not.toHaveProperty("claimedByAdminId");
  });

  it("returns latest status per itemId when retry succeeds after rejection", async () => {
    const olderRejected = {
      id: "req-old",
      sectionType: "experience",
      itemId: "exp-1",
      itemLabel: "Acme",
      status: "rejected",
      badgeVisible: true,
      submittedAt: new Date("2024-01-01"),
      assessmentAcceptedAt: null,
    };
    const newerVerified = {
      id: "req-new",
      sectionType: "experience",
      itemId: "exp-1",
      itemLabel: "Acme",
      status: "verified",
      badgeVisible: true,
      submittedAt: new Date("2024-02-01"),
      assessmentAcceptedAt: null,
    };
    const statuses = [olderRejected, newerVerified];

    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => statuses), limit: mockLimit, orderBy: mockOrderBy })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => []) })) })),
        limit: mockLimit,
        orderBy: mockOrderBy,
      });

    const result = await verificationService.getStatus({ userId: "user-1", resumeId: "resume-1" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "req-new", itemId: "exp-1", status: "verified" });
  });
});

describe("verificationService.getPublicStatus", () => {
  it("returns empty list when resume is missing", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ limit: vi.fn(() => []) })),
    });

    const result = await verificationService.getPublicStatus("resume-1");

    expect(result).toEqual([]);
  });

  it("returns empty list when resume is not public", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ limit: vi.fn(() => [{ userId: "user-1", isPublic: false }]) })),
    });

    const result = await verificationService.getPublicStatus("resume-1");

    expect(result).toEqual([]);
  });

  it("returns section statuses and latest identity status", async () => {
    const sectionStatuses = [
      {
        id: "req-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "TypeScript",
        status: "verified",
        badgeVisible: true,
        submittedAt: new Date(),
      },
    ];

    const identityStatus = {
      id: "req-identity",
      sectionType: "identity",
      itemId: "user-1",
      itemLabel: "Identity Verification",
      status: "verified",
      badgeVisible: true,
      submittedAt: new Date(),
    };

    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({ limit: vi.fn(() => [{ userId: "user-1", isPublic: true }]) })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => sectionStatuses),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => [identityStatus]) })) })),
      });

    const result = await verificationService.getPublicStatus("resume-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(sectionStatuses[0]);
    expect(result[1]).toEqual(identityStatus);
  });

  it("omits pending section statuses from public response when identity is missing", async () => {
    const sectionStatuses = [
      {
        id: "req-1",
        sectionType: "experience",
        itemId: "item-1",
        itemLabel: "Acme",
        status: "pending",
        badgeVisible: true,
        submittedAt: new Date(),
      },
    ];

    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({ limit: vi.fn(() => [{ userId: "user-1", isPublic: true }]) })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => sectionStatuses),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => []) })) })),
      });

    const result = await verificationService.getPublicStatus("resume-1");

    expect(result).toEqual([]);
  });

  it("returns latest status per itemId when retry succeeds after rejection", async () => {
    const olderRejected = {
      id: "req-old",
      sectionType: "experience",
      itemId: "exp-1",
      itemLabel: "Acme",
      status: "rejected",
      badgeVisible: true,
      submittedAt: new Date("2024-01-01"),
    };
    const newerVerified = {
      id: "req-new",
      sectionType: "experience",
      itemId: "exp-1",
      itemLabel: "Acme",
      status: "verified",
      badgeVisible: true,
      submittedAt: new Date("2024-02-01"),
    };
    const sectionStatuses = [olderRejected, newerVerified];

    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({ limit: vi.fn(() => [{ userId: "user-1", isPublic: true }]) })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => sectionStatuses),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => []) })) })),
      });

    const result = await verificationService.getPublicStatus("resume-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(newerVerified);
  });
});

describe("verificationService.getPrinterStatus", () => {
  it("returns empty list when resume is missing", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ limit: vi.fn(() => []) })),
    });

    const result = await verificationService.getPrinterStatus("resume-1");

    expect(result).toEqual([]);
  });

  it("returns statuses even when resume is private", async () => {
    const sectionStatuses = [
      {
        id: "req-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "TypeScript",
        status: "verified",
        badgeVisible: true,
        submittedAt: new Date(),
      },
    ];
    const identityStatus = {
      id: "req-identity",
      sectionType: "identity",
      itemId: "user-1",
      itemLabel: "Identity Verification",
      status: "verified",
      badgeVisible: true,
      submittedAt: new Date(),
    };

    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({ limit: vi.fn(() => [{ userId: "user-1", isPublic: false }]) })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => sectionStatuses),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => [identityStatus]) })) })),
      });

    const result = await verificationService.getPrinterStatus("resume-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(sectionStatuses[0]);
    expect(result[1]).toEqual(identityStatus);
  });

  it("omits pending-like rows when includePendingLike is false", async () => {
    const sectionStatuses = [
      {
        id: "req-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "TypeScript",
        status: "verified",
        badgeVisible: true,
        submittedAt: new Date(),
      },
      {
        id: "req-2",
        sectionType: "project",
        itemId: "item-2",
        itemLabel: "App",
        status: "pending",
        badgeVisible: true,
        submittedAt: new Date(),
      },
    ];

    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({ limit: vi.fn(() => [{ userId: "user-1", isPublic: false }]) })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => sectionStatuses),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => []) })) })),
      });

    const result = await verificationService.getPrinterStatus("resume-1", { includePendingLike: false });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("req-1");
  });
});

describe("verificationService.getHistory", () => {
  it("should return history with verifier label and without admin identity fields", async () => {
    const history = [
      {
        id: "req-1",
        sectionType: "skill",
        itemLabel: "TS",
        status: "verified",
        submittedAt: new Date(),
        resolvedAt: new Date(),
      },
    ];
    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({ orderBy: vi.fn(() => history) })),
        limit: mockLimit,
        orderBy: mockOrderBy,
      })
      .mockReturnValueOnce({
        where: vi.fn(() => [{ id: "req-1", sectionType: "skill" }]),
        limit: mockLimit,
        orderBy: mockOrderBy,
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => [
            {
              verificationRequestId: "req-1",
              reviewerSnapshotFirstName: "Jane",
              reviewerSnapshotLastName: "Reviewer",
              reviewerSnapshotTitle: "Senior Engineer at Meta",
              reviewerPublicProfileUrl: "/reviewer/admin-1",
            },
          ]),
        })),
        limit: mockLimit,
        orderBy: mockOrderBy,
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => [
            {
              verificationRequestId: "req-1",
              adminRole: "reviewer_admin",
              reviewerSnapshotFirstName: "Jane",
              reviewerSnapshotLastName: "Reviewer",
              actedAt: new Date(),
            },
          ]),
        })),
        limit: mockLimit,
        orderBy: mockOrderBy,
      });

    const result = await verificationService.getHistory({ userId: "user-1", resumeId: "resume-1", itemId: "item-1" });

    expect(result).toHaveLength(1);
    expect(result[0]?.verifiedBy).toBe("Jane Reviewer \u2014 Senior Engineer at Meta");
    expect(result[0]?.reviewerProfileUrl).toBe("/reviewer/admin-1");
    expect(result[0]).not.toHaveProperty("reviewerNote");
    expect(result[0]).not.toHaveProperty("claimedByAdminId");
  });
});

describe("verificationService.getPublicTimeline", () => {
  it("should return only verified entries with verifiedBy", async () => {
    const entries = [
      {
        id: "req-1",
        sectionType: "skill",
        itemLabel: "TypeScript",
        status: "verified",
        submittedAt: new Date(),
        resolvedAt: new Date(),
      },
      {
        id: "req-2",
        sectionType: "skill",
        itemLabel: "React",
        status: "rejected",
        submittedAt: new Date(),
        resolvedAt: new Date(),
      },
      {
        id: "req-3",
        sectionType: "project",
        itemLabel: "Portfolio",
        status: "pending",
        submittedAt: new Date(),
        resolvedAt: null,
      },
    ];
    const verifiedEntries = entries.filter((entry) => entry.status === "verified");

    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({ limit: vi.fn(() => [{ id: "resume-1", isPublic: true }]) })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ limit: vi.fn(() => [{ showTimeline: true }]) })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ orderBy: vi.fn(() => verifiedEntries) })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => [
          { id: "req-1", sectionType: "skill" },
          { id: "req-2", sectionType: "project" },
        ]),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => [
            {
              verificationRequestId: "req-1",
              reviewerSnapshotFirstName: "Jane",
              reviewerSnapshotLastName: "Reviewer",
              reviewerSnapshotTitle: "Senior Engineer at Meta",
              reviewerPublicProfileUrl: "/reviewer/admin-1",
            },
          ]),
        })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => [
            {
              verificationRequestId: "req-1",
              adminRole: "reviewer_admin",
              reviewerSnapshotFirstName: "Jane",
              reviewerSnapshotLastName: "Reviewer",
              actedAt: new Date(),
            },
          ]),
        })),
      });

    const result = await verificationService.getPublicTimeline({ resumeId: "resume-1" });

    expect(result.enabled).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.id).toBe("req-1");
    expect(result.entries[0]?.verifiedBy).toBe("Jane Reviewer \u2014 Senior Engineer at Meta");
    expect(result.entries[0]?.reviewerProfileUrl).toBe("/reviewer/admin-1");
  });
});

// --- Admin procedures ---

describe("verificationService.acceptCase", () => {
  const file = new File(["instructions"], "instructions.pdf", { type: "application/pdf" });
  const reviewerProfile = {
    firstName: "Jane",
    lastName: "Smith",
    title: "Engineer",
    publicProfileUrl: "/reviewer/admin-1",
    reviewerSkills: ["TypeScript"],
  };
  const pendingSkillRequest = {
    id: "req-1",
    userId: "user-1",
    sectionType: "skill",
    itemLabel: "TypeScript",
    status: "pending",
    claimedByAdminId: null,
  };

  it("should error if already claimed", async () => {
    mockLimit
      .mockReturnValueOnce([reviewerProfile])
      .mockReturnValueOnce([pendingSkillRequest])
      .mockReturnValueOnce([{ id: "req-1" }]);
    mockReturning.mockResolvedValueOnce([]);

    await expect(verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file })).rejects.toThrow(
      "not available to accept",
    );
  });

  it("should error if not pending", async () => {
    mockLimit
      .mockReturnValueOnce([reviewerProfile])
      .mockReturnValueOnce([pendingSkillRequest])
      .mockReturnValueOnce([{ id: "req-1" }]);
    mockReturning.mockResolvedValueOnce([]);

    await expect(verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file })).rejects.toThrow(
      "not available to accept",
    );
  });

  it("should error if not found", async () => {
    mockLimit.mockReturnValueOnce([reviewerProfile]).mockReturnValueOnce([]);
    mockReturning.mockResolvedValueOnce([]);

    await expect(verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file })).rejects.toThrow(
      "not found",
    );
  });

  it("should error if reviewer profile not found", async () => {
    mockLimit.mockReturnValueOnce([]);

    await expect(verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file })).rejects.toThrow(
      "Reviewer profile not found",
    );
  });

  it("should reject experience section requests", async () => {
    mockLimit
      .mockReturnValueOnce([reviewerProfile])
      .mockReturnValueOnce([
        { id: "req-1", sectionType: "experience", itemLabel: "Acme Corp", status: "pending", claimedByAdminId: null },
      ])
      .mockReturnValueOnce([{ id: "req-1" }]);
    mockReturning.mockResolvedValueOnce([]);

    await expect(verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file })).rejects.toThrow(
      "not available to accept",
    );
  });

  it("should reject self-review requests", async () => {
    mockLimit
      .mockReturnValueOnce([reviewerProfile])
      .mockReturnValueOnce([{ ...pendingSkillRequest, userId: "admin-1" }]);

    await expect(verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file })).rejects.toThrow(
      "You cannot review your own verification requests",
    );
  });

  it("should accept case, upload instructions key, and record metadata", async () => {
    const claimed = {
      id: "req-1",
      userId: "user-1",
      resumeId: "resume-1",
      itemId: "item-1",
      itemLabel: "TypeScript",
      sectionType: "skill",
      status: "claimed",
    };

    mockLimit.mockReturnValueOnce([reviewerProfile]).mockReturnValueOnce([pendingSkillRequest]);

    mockReturning.mockResolvedValueOnce([
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        itemId: "item-1",
        itemLabel: "TypeScript",
        sectionType: "skill",
      },
    ]);

    mockUploadFile.mockResolvedValueOnce({
      key: "uploads/user-1/documents/resume-1/item-1/123",
      url: "https://app.test/uploads/user-1/documents/resume-1/item-1/123",
    });

    mockTransaction.mockImplementationOnce(async (callback) =>
      callback({
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockReturnValue([claimed]),
            })),
          })),
        })),
      }),
    );

    const result = await verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file });

    expect(result.status).toBe("claimed");
    expect(mockUploadFile).toHaveBeenCalled();
  });
});

describe("verificationService.submitAssessmentSolution", () => {
  const claimedRequest = {
    id: "req-1",
    userId: "user-1",
    resumeId: "resume-1",
    itemId: skillKeywordId,
    itemLabel: "TypeScript",
    sectionType: "skill",
    status: "claimed",
    claimedByAdminId: "reviewer-1",
  };

  const createPdfFile = () => new File(["pdf"], "solution.pdf", { type: "application/pdf" });

  it("should error when neither file nor URL is provided", async () => {
    await expect(
      verificationService.submitAssessmentSolution({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: skillKeywordId,
      }),
    ).rejects.toThrow("Provide a file or solution URL");
  });

  it("should error when no claimed assessment exists", async () => {
    mockOrderBy.mockReturnValueOnce(
      Object.assign(Promise.resolve([]), {
        limit: vi.fn().mockReturnValue([]),
      }),
    );

    await expect(
      verificationService.submitAssessmentSolution({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: skillKeywordId,
        solutionUrl: "https://github.com/you/repo",
      }),
    ).rejects.toThrow("No active assessment found");
  });

  it("should submit a URL-only solution", async () => {
    const submittedAt = new Date("2026-06-09T12:00:00.000Z");

    mockOrderBy.mockReturnValueOnce(
      Object.assign(Promise.resolve([]), {
        limit: vi.fn().mockReturnValue([claimedRequest]),
      }),
    );
    mockReturning.mockResolvedValueOnce([
      {
        fileUrl: "https://github.com/you/repo",
        documentType: "assessment_solution_link",
        uploadedAt: submittedAt,
      },
    ]);
    mockLimit
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ email: "reviewer@example.com" }])
      .mockReturnValueOnce([{ name: "Applicant One" }]);

    const result = await verificationService.submitAssessmentSolution({
      userId: "user-1",
      resumeId: "resume-1",
      itemId: skillKeywordId,
      solutionUrl: "https://github.com/you/repo",
    });

    expect(result).toEqual({
      requestId: "req-1",
      assessmentSolutionSubmittedAt: submittedAt,
      assessmentSolutionFileUrl: null,
      assessmentSolutionLinkUrl: "https://github.com/you/repo",
    });
  });

  it("should submit a file-only solution", async () => {
    const submittedAt = new Date("2026-06-09T12:00:00.000Z");

    mockOrderBy.mockReturnValueOnce(
      Object.assign(Promise.resolve([]), {
        limit: vi.fn().mockReturnValue([claimedRequest]),
      }),
    );
    mockUploadFile.mockResolvedValueOnce({ key: "uploads/user-1/solution.pdf" });
    mockReturning.mockResolvedValueOnce([
      {
        fileUrl: "uploads/user-1/solution.pdf",
        documentType: "assessment_solution",
        uploadedAt: submittedAt,
      },
    ]);
    mockLimit
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ email: "reviewer@example.com" }])
      .mockReturnValueOnce([{ name: "Applicant One" }]);

    const result = await verificationService.submitAssessmentSolution({
      userId: "user-1",
      resumeId: "resume-1",
      itemId: skillKeywordId,
      file: createPdfFile(),
    });

    expect(mockUploadFile).toHaveBeenCalled();
    expect(result.assessmentSolutionFileUrl).toBe("https://app.test/uploads/user-1/solution.pdf");
    expect(result.assessmentSolutionLinkUrl).toBeNull();
  });

  it("should error when a solution was already submitted", async () => {
    mockOrderBy.mockReturnValueOnce(
      Object.assign(Promise.resolve([]), {
        limit: vi.fn().mockReturnValue([claimedRequest]),
      }),
    );
    mockLimit.mockReturnValueOnce([{ id: "existing-solution-doc" }]);

    await expect(
      verificationService.submitAssessmentSolution({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: skillKeywordId,
        solutionUrl: "https://github.com/you/repo",
      }),
    ).rejects.toThrow("A solution has already been submitted");
  });
});

describe("verificationService.submitVerdict", () => {
  const reviewerProfile = {
    consentGiven: true,
    firstName: "Jane",
    lastName: "Smith",
    title: "Engineer",
    publicProfileUrl: "/reviewer/admin-1",
  };

  it("should error if consent not given", async () => {
    mockLimit.mockReturnValueOnce([{ ...reviewerProfile, consentGiven: false }]);

    await expect(
      verificationService.submitVerdict({
        requestId: "req-1",
        adminId: "admin-1",
        verdict: "verified",
      }),
    ).rejects.toThrow("Consent must be given");
  });

  it("should error if not the claiming reviewer", async () => {
    mockLimit
      .mockReturnValueOnce([reviewerProfile])
      .mockReturnValueOnce([{ userId: "user-1" }])
      .mockReturnValueOnce([{ id: "req-1", status: "claimed", claimedByAdminId: "admin-2", sectionType: "skill" }]);
    mockReturning.mockResolvedValueOnce([]);

    await expect(
      verificationService.submitVerdict({
        requestId: "req-1",
        adminId: "admin-1",
        verdict: "verified",
      }),
    ).rejects.toThrow("Only the claiming reviewer");
  });

  it("should error if not in claimed status", async () => {
    mockLimit
      .mockReturnValueOnce([reviewerProfile])
      .mockReturnValueOnce([{ userId: "user-1" }])
      .mockReturnValueOnce([{ id: "req-1", status: "pending", claimedByAdminId: "admin-1", sectionType: "skill" }]);
    mockReturning.mockResolvedValueOnce([]);

    await expect(
      verificationService.submitVerdict({
        requestId: "req-1",
        adminId: "admin-1",
        verdict: "verified",
      }),
    ).rejects.toThrow("must be in claimed status");
  });

  it("should reject self-review verdict submission", async () => {
    mockLimit.mockReturnValueOnce([reviewerProfile]).mockReturnValueOnce([{ userId: "admin-1" }]);

    await expect(
      verificationService.submitVerdict({
        requestId: "req-1",
        adminId: "admin-1",
        verdict: "verified",
      }),
    ).rejects.toThrow("You cannot review your own verification requests");
  });

  it("should error if profile not found", async () => {
    mockLimit.mockReturnValueOnce([]);

    await expect(
      verificationService.submitVerdict({
        requestId: "req-1",
        adminId: "admin-1",
        verdict: "verified",
      }),
    ).rejects.toThrow("Reviewer profile not found");
  });

  it("should submit verdict when claimed by reviewer", async () => {
    mockLimit.mockImplementation(() => {
      if (mockLimit.mock.calls.length === 1) return [reviewerProfile];
      if (mockLimit.mock.calls.length === 2) return [{ userId: "user-1" }];
      if (mockLimit.mock.calls.length === 3) return [{ email: "applicant@test.com" }];
      return [];
    });
    mockReturning.mockResolvedValueOnce([
      {
        id: "req-1",
        userId: "user-1",
        itemLabel: "Go",
        sectionType: "skill",
        status: "verdict_pending",
        proposedVerdict: "verified",
      },
    ]);

    const result = await verificationService.submitVerdict({
      requestId: "req-1",
      adminId: "admin-1",
      verdict: "verified",
    });

    expect(result.status).toBe("verdict_pending");
    expect(result.proposedVerdict).toBe("verified");
  });
});

describe("verificationService.reviewExperience", () => {
  it("should error if not experience type", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "pending", sectionType: "skill" }]);

    await expect(
      verificationService.reviewExperience({
        requestId: "req-1",
        adminId: "sva-1",
        action: "verified",
      }),
    ).rejects.toThrow("must be a pending experience request");
  });

  it("should error if not pending", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "claimed", sectionType: "experience" }]);

    await expect(
      verificationService.reviewExperience({
        requestId: "req-1",
        adminId: "sva-1",
        action: "verified",
      }),
    ).rejects.toThrow("must be a pending experience request");
  });
});

describe("verificationService.confirmVerdict", () => {
  it("should error if not verdict_pending", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "claimed" }]);

    await expect(verificationService.confirmVerdict({ requestId: "req-1", adminId: "sva-1" })).rejects.toThrow(
      "must be in verdict_pending status",
    );
  });

  it("should error if not found", async () => {
    mockLimit.mockReturnValueOnce([]);

    await expect(verificationService.confirmVerdict({ requestId: "non-existent", adminId: "sva-1" })).rejects.toThrow(
      "not found",
    );
  });

  it("should error if proposed verdict is missing", async () => {
    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        status: "verdict_pending",
        userId: "user-1",
        itemLabel: "TypeScript",
        sectionType: "skill",
        proposedVerdict: null,
      },
    ]);

    await expect(verificationService.confirmVerdict({ requestId: "req-1", adminId: "sva-1" })).rejects.toThrow(
      "missing a proposed verdict",
    );
  });

  it("should confirm verdict and copy reviewer attribution for verified status", async () => {
    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        status: "verdict_pending",
        userId: "user-1",
        itemLabel: "TypeScript",
        sectionType: "skill",
        proposedVerdict: "verified",
      },
    ]);

    mockReturning.mockResolvedValueOnce([
      {
        id: "req-1",
        userId: "user-1",
        itemLabel: "TypeScript",
        sectionType: "skill",
        proposedVerdict: "verified",
      },
    ]);

    mockOrderBy.mockReturnValueOnce(
      createThenableRows([
        {
          reviewerSnapshotFirstName: "Jane",
          reviewerSnapshotLastName: "Smith",
          reviewerSnapshotTitle: "Engineer",
          reviewerPublicProfileUrl: "/reviewer/admin-1",
        },
      ]),
    );

    mockLimit.mockReturnValueOnce([]);

    const result = await verificationService.confirmVerdict({ requestId: "req-1", adminId: "sva-1" });

    expect(result.proposedVerdict).toBe("verified");
  });

  it("should error with conflict when verdict already finalized", async () => {
    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        status: "verdict_pending",
        userId: "user-1",
        itemLabel: "TypeScript",
        sectionType: "skill",
        proposedVerdict: "verified",
      },
    ]);
    mockReturning.mockResolvedValueOnce([]);

    await expect(verificationService.confirmVerdict({ requestId: "req-1", adminId: "sva-1" })).rejects.toThrow(
      "already finalized",
    );
  });
});

describe("verificationService.overrideVerdict", () => {
  it("should error if not verdict_pending", async () => {
    mockReturning.mockResolvedValueOnce([]);
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "verified" }]);

    await expect(
      verificationService.overrideVerdict({
        requestId: "req-1",
        adminId: "sva-1",
        action: "rejected",
        reason: "Override",
      }),
    ).rejects.toThrow("must be in verdict_pending status");
  });

  it("should error if not found", async () => {
    mockReturning.mockResolvedValueOnce([]);
    mockLimit.mockReturnValueOnce([]);

    await expect(
      verificationService.overrideVerdict({
        requestId: "non-existent",
        adminId: "sva-1",
        action: "rejected",
        reason: "Override",
      }),
    ).rejects.toThrow("not found");
  });
});

describe("verificationService.getDocuments", () => {
  it("should return documents with public URLs for a valid request", async () => {
    const docs = [
      { id: "doc-1", fileUrl: "uploads/user-1/item-1/file.pdf", documentType: "contract", uploadedAt: new Date() },
    ];
    // First query: check request exists (select→from→where→limit)
    mockFrom.mockReturnValueOnce({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([{ id: "req-1" }]) }),
    });
    // Second query: get documents (select→from→where)
    mockFrom.mockReturnValueOnce({ where: vi.fn().mockReturnValue(docs) });

    const result = await verificationService.getDocuments("req-1");

    expect(result).toEqual([
      {
        ...docs[0],
        fileUrl: "https://app.test/uploads/user-1/item-1/file.pdf",
      },
    ]);
  });

  it("should error if request not found", async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([]) }) });

    await expect(verificationService.getDocuments("non-existent")).rejects.toThrow("not found");
  });

  it("should return empty array if no documents attached", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([{ id: "req-1" }]) }),
    });
    mockFrom.mockReturnValueOnce({ where: vi.fn().mockReturnValue([]) });

    const result = await verificationService.getDocuments("req-1");

    expect(result).toEqual([]);
  });
});

describe("verificationService.downloadDocument", () => {
  it("should return file data for a valid document", async () => {
    const doc = { id: "doc-1", fileUrl: "uploads/user-1/file.pdf", documentType: "contract" };
    mockFrom.mockReturnValueOnce({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([doc]) }) });
    mockStorageRead.mockResolvedValueOnce({
      data: new Uint8Array([1, 2, 3]),
      size: 3,
      contentType: "application/pdf",
    });

    const result = await verificationService.downloadDocument("doc-1");

    expect(result.id).toBe("doc-1");
    expect(result.contentType).toBe("application/pdf");
    expect(result.size).toBe(3);
    expect(result.data).toEqual(new Uint8Array([1, 2, 3]));
    expect(mockStorageRead).toHaveBeenCalledWith("uploads/user-1/file.pdf");
  });

  it("should error if document not found in DB", async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([]) }) });

    await expect(verificationService.downloadDocument("non-existent")).rejects.toThrow("Document not found");
  });

  it("should error if file not found in storage", async () => {
    const doc = { id: "doc-1", fileUrl: "uploads/user-1/missing.pdf", documentType: "contract" };
    mockFrom.mockReturnValueOnce({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([doc]) }) });
    mockStorageRead.mockResolvedValueOnce(null);

    await expect(verificationService.downloadDocument("doc-1")).rejects.toThrow("not found in storage");
  });

  it("should normalize legacy full URL file references before reading storage", async () => {
    const doc = {
      id: "doc-1",
      fileUrl: "https://app.test/uploads/user-1/legacy.pdf",
      documentType: "contract",
    };
    mockFrom.mockReturnValueOnce({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([doc]) }) });
    mockStorageRead.mockResolvedValueOnce({
      data: new Uint8Array([9]),
      size: 1,
      contentType: "application/pdf",
    });

    await verificationService.downloadDocument("doc-1");

    expect(mockStorageRead).toHaveBeenCalledWith("uploads/user-1/legacy.pdf");
  });
});

describe("verificationService.uploadDocument", () => {
  const file = new File(["payslip"], "payslip.pdf", { type: "application/pdf" });

  it("should attach document only to pending experience requests", async () => {
    mockOrderBy.mockReturnValueOnce(
      Object.assign(Promise.resolve([]), {
        limit: vi.fn().mockReturnValue([{ id: "req-exp-1" }]),
      }),
    );
    mockReturning.mockResolvedValueOnce([
      {
        id: "doc-1",
        fileUrl: "uploads/user-1/documents/resume-1/item-1/1",
        documentType: "payslip",
        uploadedAt: new Date(),
      },
    ]);
    mockUploadFile.mockResolvedValueOnce({
      key: "uploads/user-1/documents/resume-1/item-1/1",
      url: "https://app.test/uploads/user-1/documents/resume-1/item-1/1",
    });

    const result = await verificationService.uploadDocument({
      userId: "user-1",
      resumeId: "resume-1",
      itemId: "item-1",
      file,
      documentType: "payslip",
    });

    expect(result.fileUrl).toBe("https://app.test/uploads/user-1/documents/resume-1/item-1/1");
  });

  it("should error when no pending experience request exists", async () => {
    mockOrderBy.mockReturnValueOnce(
      Object.assign(Promise.resolve([]), {
        limit: vi.fn().mockReturnValue([]),
      }),
    );

    await expect(
      verificationService.uploadDocument({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: "item-1",
        file,
        documentType: "payslip",
      }),
    ).rejects.toThrow("No verification request found");
  });
});

// --- Admin queue list methods ---

describe("verificationService.listQueue", () => {
  it("returns empty array when reviewer has no assigned skills", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({
        limit: vi.fn(() => [{ reviewerSkills: [] }]),
      })),
    });
    const result = await verificationService.listQueue("admin-1");
    expect(result).toEqual([]);
  });

  it("returns only matching skill requests and all project requests", async () => {
    const rows = [
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "TypeScript",
        status: "pending",
        submittedAt: new Date(),
      },
      {
        id: "req-2",
        userId: "user-2",
        resumeId: "resume-2",
        sectionType: "skill",
        itemId: "item-2",
        itemLabel: "Rust",
        status: "pending",
        submittedAt: new Date(),
      },
      {
        id: "req-3",
        userId: "user-3",
        resumeId: "resume-3",
        sectionType: "project",
        itemId: "item-3",
        itemLabel: "App",
        status: "pending",
        submittedAt: new Date(),
      },
    ];
    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          limit: vi.fn(() => [{ reviewerSkills: ["TypeScript"] }]),
        })),
      })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => rows) })) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) });
    const result = await verificationService.listQueue("admin-1");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("req-1");
    expect(result[1].sectionType).toBe("project");
  });

  it("includes skill requests when labels differ only by spelling or casing", async () => {
    const rows = [
      {
        id: "req-js",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "Javascript",
        status: "pending",
        submittedAt: new Date(),
      },
    ];
    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          limit: vi.fn(() => [{ reviewerSkills: ["JavaScript"] }]),
        })),
      })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => rows) })) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) });
    const result = await verificationService.listQueue("admin-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("req-js");
  });

  it("does not expose applicant identity or full resume data", async () => {
    const rows = [
      {
        id: "019bef5a-93e4-7746-ad39-622f9d41da55",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "TypeScript",
        status: "pending",
        submittedAt: new Date(),
      },
    ];
    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          limit: vi.fn(() => [{ reviewerSkills: ["TypeScript"] }]),
        })),
      })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => rows) })) })
      .mockReturnValueOnce({
        where: vi.fn(() => [
          {
            id: "resume-1",
            userId: "user-1",
            data: {
              sections: {
                skills: {
                  items: [
                    {
                      id: "skill-1",
                      hidden: false,
                      icon: "",
                      name: "TypeScript",
                      proficiency: "Advanced",
                      level: 4,
                      keywords: [],
                    },
                  ],
                },
              },
            },
          },
        ]),
      })
      .mockReturnValueOnce({ where: vi.fn(() => []) });

    const result = await verificationService.listQueue("admin-1");

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("user");
    expect(result[0]).not.toHaveProperty("resume");
    expect(result[0]?.caseLabel).toBe("9D41DA55");
    expect(result[0]?.skillContext.sectionType).toBe("skill");
    expect(result[0]?.documents).toEqual([]);
  });

  it("includes skill requests with compound qualified labels", async () => {
    const rows = [
      {
        id: "req-js-es6",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "JavaScript ES6/ES7",
        status: "pending",
        submittedAt: new Date(),
      },
    ];
    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          limit: vi.fn(() => [{ reviewerSkills: ["JavaScript"] }]),
        })),
      })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => rows) })) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) });
    const result = await verificationService.listQueue("admin-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("req-js-es6");
  });

  it("excludes the reviewer's own verification requests", async () => {
    const rows = [
      {
        id: "req-own",
        userId: "admin-1",
        resumeId: "resume-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "TypeScript",
        status: "pending",
        submittedAt: new Date(),
      },
      {
        id: "req-other",
        userId: "user-2",
        resumeId: "resume-2",
        sectionType: "skill",
        itemId: "item-2",
        itemLabel: "TypeScript",
        status: "pending",
        submittedAt: new Date(),
      },
    ];
    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          limit: vi.fn(() => [{ reviewerSkills: ["TypeScript"] }]),
        })),
      })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => rows) })) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) });
    const result = await verificationService.listQueue("admin-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("req-other");
  });
});

describe("verificationService.downloadReviewerDocument", () => {
  it("should reject access to the reviewer's own verification documents", async () => {
    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        userId: "admin-1",
        sectionType: "skill",
        itemLabel: "TypeScript",
        status: "pending",
        claimedByAdminId: null,
      },
    ]);

    await expect(
      verificationService.downloadReviewerDocument({
        requestId: "req-1",
        documentId: "doc-1",
        adminId: "admin-1",
      }),
    ).rejects.toThrow("You cannot review your own verification requests");
  });
});

describe("verificationService.listMyCases", () => {
  it("returns empty array when admin has no claimed cases", async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) });
    const result = await verificationService.listMyCases("admin-1");
    expect(result).toEqual([]);
  });

  it("returns cases claimed by the given admin", async () => {
    const row = {
      id: "req-1",
      userId: "user-1",
      resumeId: "resume-1",
      sectionType: "skill",
      itemId: "item-1",
      itemLabel: "React",
      status: "claimed",
      claimedAt: new Date(),
      submittedAt: new Date(),
      proposedVerdict: null,
      reviewerNote: null,
      assessmentAcceptedAt: new Date(),
    };
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => [row]) })) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) });
    const result = await verificationService.listMyCases("admin-1");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("claimed");
  });
});

describe("verificationService.listMyCaseHistory", () => {
  it("returns empty array when admin has no completed cases", async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) });
    const result = await verificationService.listMyCaseHistory("admin-1");
    expect(result).toEqual([]);
  });

  it("returns finalized cases claimed by the given admin with resolvedAt", async () => {
    const older = new Date("2026-01-01T00:00:00.000Z");
    const newer = new Date("2026-06-01T00:00:00.000Z");
    const rows = [
      {
        id: "req-2",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "skill",
        itemId: "item-2",
        itemLabel: "TypeScript",
        status: "verified",
        claimedAt: older,
        resolvedAt: newer,
        submittedAt: older,
        proposedVerdict: "verified",
        reviewerNote: "Strong performance",
        assessmentAcceptedAt: older,
      },
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "React",
        status: "rejected",
        claimedAt: older,
        resolvedAt: older,
        submittedAt: older,
        proposedVerdict: "rejected",
        reviewerNote: null,
        assessmentAcceptedAt: older,
      },
    ];
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => rows) })) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) });
    const result = await verificationService.listMyCaseHistory("admin-1");
    expect(result).toHaveLength(2);
    expect(result[0]?.status).toBe("verified");
    expect(result[0]?.resolvedAt).toEqual(newer);
    expect(result[1]?.status).toBe("rejected");
    expect(result[1]?.resolvedAt).toEqual(older);
  });
});

describe("verificationService.listExperienceHistory", () => {
  const defaultListInput = { page: 1, pageSize: 20 };

  function mockPaginatedCount(total: number, unfilteredTotal = total) {
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => [{ total: unfilteredTotal }]) })
      .mockReturnValueOnce({ where: vi.fn(() => [{ total }]) });
  }

  function mockPaginatedSelect(rows: unknown[]) {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => rows),
          })),
        })),
      })),
    });
  }

  it("returns empty paginated result when no finalized experience requests exist", async () => {
    mockPaginatedCount(0);
    const result = await verificationService.listExperienceHistory(defaultListInput);
    expect(result).toEqual({
      items: [],
      total: 0,
      totalUnfiltered: 0,
      page: 1,
      pageSize: 20,
    });
  });

  it("returns finalized experience requests ordered by resolvedAt with admin attribution", async () => {
    const older = new Date("2026-01-01T00:00:00.000Z");
    const newer = new Date("2026-06-01T00:00:00.000Z");
    const rows = [
      {
        id: "req-2",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "experience",
        itemId: "item-2",
        itemLabel: "Acme Corp — Engineer",
        status: "verified",
        method: "document_upload",
        submittedAt: older,
        resolvedAt: newer,
        reviewerNote: "Documents look good",
      },
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "experience",
        itemId: "item-1",
        itemLabel: "Beta Inc — Developer",
        status: "rejected",
        method: "freelancer_link",
        submittedAt: older,
        resolvedAt: older,
        reviewerNote: null,
      },
    ];
    mockPaginatedCount(2);
    mockPaginatedSelect(rows);
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => [
            {
              verificationRequestId: "req-2",
              adminId: "admin-1",
              actedAt: newer,
            },
          ]),
        })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => [{ id: "admin-1", name: "Admin User", email: "admin@example.com" }]),
      });

    const result = await verificationService.listExperienceHistory(defaultListInput);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.totalUnfiltered).toBe(2);
    expect(result.items[0]?.status).toBe("verified");
    expect(result.items[0]?.resolvedAt).toEqual(newer);
    expect(result.items[0]?.reviewerNote).toBe("Documents look good");
    expect(result.items[0]?.reviewedBy).toEqual({
      id: "admin-1",
      name: "Admin User",
      email: "admin@example.com",
    });
    expect(result.items[0]?.reviewedAt).toEqual(newer);
    expect(result.items[1]?.status).toBe("rejected");
    expect(result.items[1]?.resolvedAt).toEqual(older);
    expect(result.items[1]?.reviewedBy).toBeNull();
  });

  it("filters history by status and paginates results", async () => {
    const resolvedAt = new Date("2026-06-01T00:00:00.000Z");
    const rows = [
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "experience",
        itemId: "item-1",
        itemLabel: "Acme Corp",
        status: "rejected",
        method: "document_upload",
        submittedAt: resolvedAt,
        resolvedAt,
        reviewerNote: null,
      },
    ];
    mockPaginatedCount(1, 3);
    mockPaginatedSelect(rows);
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) });

    const result = await verificationService.listExperienceHistory({
      page: 1,
      pageSize: 1,
      statuses: ["rejected"],
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalUnfiltered).toBe(3);
    expect(result.items[0]?.status).toBe("rejected");
  });
});

describe("verificationService.listIdentityHistory", () => {
  const defaultListInput = { page: 1, pageSize: 20 };

  function mockPaginatedCount(total: number, unfilteredTotal = total) {
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => [{ total: unfilteredTotal }]) })
      .mockReturnValueOnce({ where: vi.fn(() => [{ total }]) });
  }

  function mockPaginatedSelect(rows: unknown[]) {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => rows),
          })),
        })),
      })),
    });
  }

  it("returns empty paginated result when no finalized identity requests exist", async () => {
    mockPaginatedCount(0);
    const result = await verificationService.listIdentityHistory(defaultListInput);
    expect(result).toEqual({
      items: [],
      total: 0,
      totalUnfiltered: 0,
      page: 1,
      pageSize: 20,
    });
  });

  it("returns finalized identity requests ordered by resolvedAt", async () => {
    const resolvedAt = new Date("2026-03-15T00:00:00.000Z");
    const rows = [
      {
        id: "req-1",
        userId: "user-1",
        resumeId: null,
        sectionType: "identity",
        itemId: "item-1",
        itemLabel: "Identity Verification",
        status: "issue",
        method: "identity_call",
        submittedAt: resolvedAt,
        calendarLinkSentAt: resolvedAt,
        resolvedAt,
        reviewerNote: "Could not verify on call",
      },
    ];
    mockPaginatedCount(1);
    mockPaginatedSelect(rows);
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) });

    const result = await verificationService.listIdentityHistory(defaultListInput);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe("issue");
    expect(result.items[0]?.calendarLinkSentAt).toEqual(resolvedAt);
    expect(result.items[0]?.reviewerNote).toBe("Could not verify on call");
    expect(result.items[0]?.reviewedBy).toBeNull();
  });
});

describe("verificationService.listPendingVerdicts", () => {
  const defaultListInput = { page: 1, pageSize: 20 };

  function mockPaginatedCount(total: number, unfilteredTotal = total) {
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => [{ total: unfilteredTotal }]) })
      .mockReturnValueOnce({ where: vi.fn(() => [{ total }]) });
  }

  function mockPaginatedSelect(rows: unknown[]) {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => rows),
          })),
        })),
      })),
    });
  }

  it("returns empty paginated result when no verdict_pending requests exist", async () => {
    mockPaginatedCount(0);
    const result = await verificationService.listPendingVerdicts(defaultListInput);
    expect(result).toEqual({
      items: [],
      total: 0,
      totalUnfiltered: 0,
      page: 1,
      pageSize: 20,
    });
  });

  it("returns verdict_pending requests", async () => {
    const rows = [
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "Go",
        status: "verdict_pending",
        submittedAt: new Date(),
        proposedVerdict: "verified",
        reviewerNote: "Strong performance",
        assessmentAcceptedAt: new Date(),
        claimedByAdminId: "admin-1",
      },
    ];
    mockPaginatedCount(1);
    mockPaginatedSelect(rows);
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => [{ adminId: "admin-1", reviewerSkills: ["Go"] }]) })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) });
    const result = await verificationService.listPendingVerdicts(defaultListInput);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe("verdict_pending");
    expect(result.items[0]?.proposedVerdict).toBe("verified");
    expect(result.items[0]?.reviewerAdminId).toBe("admin-1");
    expect(result.items[0]?.reviewerSkills).toEqual(["Go"]);
  });

  it("filters pending verdicts by proposed outcome and type", async () => {
    const rows = [
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "project",
        itemId: "item-1",
        itemLabel: "Portfolio",
        status: "verdict_pending",
        submittedAt: new Date(),
        proposedVerdict: "rejected",
        reviewerNote: null,
        assessmentAcceptedAt: null,
        claimedByAdminId: null,
      },
    ];
    mockPaginatedCount(1, 5);
    mockPaginatedSelect(rows);
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) });
    const result = await verificationService.listPendingVerdicts({
      page: 1,
      pageSize: 20,
      proposed: ["rejected"],
      types: ["project"],
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalUnfiltered).toBe(5);
    expect(result.items[0]?.sectionType).toBe("project");
    expect(result.items[0]?.proposedVerdict).toBe("rejected");
  });
});

describe("verificationService.listVerdictHistory", () => {
  const defaultListInput = { page: 1, pageSize: 20 };

  function mockPaginatedCount(total: number, unfilteredTotal = total) {
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => [{ total: unfilteredTotal }]) })
      .mockReturnValueOnce({ where: vi.fn(() => [{ total }]) });
  }

  function mockPaginatedSelect(rows: unknown[]) {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => rows),
          })),
        })),
      })),
    });
  }

  it("returns empty paginated result when no concluded verdicts exist", async () => {
    mockPaginatedCount(0);
    const result = await verificationService.listVerdictHistory(defaultListInput);
    expect(result).toEqual({
      items: [],
      total: 0,
      totalUnfiltered: 0,
      page: 1,
      pageSize: 20,
    });
  });

  it("returns concluded skill/project verdicts with reviewer and SVA attribution", async () => {
    const resolvedAt = new Date("2026-06-01T00:00:00.000Z");
    const rows = [
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "skill",
        itemId: "item-1",
        itemLabel: "Go",
        status: "verified",
        submittedAt: new Date("2026-01-01T00:00:00.000Z"),
        resolvedAt,
        proposedVerdict: "verified",
        reviewerNote: "Strong performance",
        assessmentAcceptedAt: new Date(),
        claimedByAdminId: "admin-1",
      },
    ];
    mockPaginatedCount(1);
    mockPaginatedSelect(rows);
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => [{ adminId: "admin-1", reviewerSkills: ["Go"] }]) })
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => [
            {
              verificationRequestId: "req-1",
              reviewerSnapshotFirstName: "Jane",
              reviewerSnapshotLastName: "Reviewer",
              reviewerSnapshotTitle: "Engineer",
              reviewerPublicProfileUrl: "/reviewer/admin-1",
              notes: "Strong performance",
              actedAt: new Date("2026-05-01T00:00:00.000Z"),
            },
          ]),
        })),
      })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => [
            {
              verificationRequestId: "req-1",
              adminId: "sva-1",
              actedAt: resolvedAt,
            },
          ]),
        })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => [{ id: "sva-1", name: "SVA User", email: "sva@example.com" }]),
      });

    const result = await verificationService.listVerdictHistory(defaultListInput);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe("verified");
    expect(result.items[0]?.resolvedAt).toEqual(resolvedAt);
    expect(result.items[0]?.reviewerName).toBe("Jane Reviewer");
    expect(result.items[0]?.reviewedBy).toEqual({
      id: "sva-1",
      name: "SVA User",
      email: "sva@example.com",
    });
    expect(result.items[0]?.reviewedAt).toEqual(resolvedAt);
  });

  it("filters verdict history by status and type", async () => {
    const rows = [
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        sectionType: "project",
        itemId: "item-1",
        itemLabel: "Portfolio",
        status: "rejected",
        submittedAt: new Date(),
        resolvedAt: new Date(),
        proposedVerdict: "rejected",
        reviewerNote: null,
        assessmentAcceptedAt: null,
        claimedByAdminId: null,
      },
    ];
    mockPaginatedCount(1, 4);
    mockPaginatedSelect(rows);
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) });

    const result = await verificationService.listVerdictHistory({
      page: 1,
      pageSize: 20,
      statuses: ["rejected"],
      types: ["project"],
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalUnfiltered).toBe(4);
    expect(result.items[0]?.sectionType).toBe("project");
    expect(result.items[0]?.status).toBe("rejected");
  });
});

describe("verificationService.overrideConcludedVerdict", () => {
  it("should error if request not found", async () => {
    mockLimit.mockReturnValueOnce([]);

    await expect(
      verificationService.overrideConcludedVerdict({
        requestId: "non-existent",
        adminId: "sva-1",
        action: "rejected",
        reason: "Incorrect verification",
      }),
    ).rejects.toThrow("not found");
  });

  it("should error if request is not concluded", async () => {
    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        status: "verdict_pending",
        sectionType: "skill",
        userId: "user-1",
        itemLabel: "Go",
      },
    ]);

    await expect(
      verificationService.overrideConcludedVerdict({
        requestId: "req-1",
        adminId: "sva-1",
        action: "rejected",
        reason: "Incorrect verification",
      }),
    ).rejects.toThrow("concluded status");
  });

  it("should error if request is not skill or project", async () => {
    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        status: "verified",
        sectionType: "experience",
        userId: "user-1",
        itemLabel: "Acme Corp",
      },
    ]);

    await expect(
      verificationService.overrideConcludedVerdict({
        requestId: "req-1",
        adminId: "sva-1",
        action: "rejected",
        reason: "Incorrect verification",
      }),
    ).rejects.toThrow("skill or project");
  });

  it("should error if new status matches current status", async () => {
    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        status: "verified",
        sectionType: "skill",
        userId: "user-1",
        itemLabel: "Go",
      },
    ]);

    await expect(
      verificationService.overrideConcludedVerdict({
        requestId: "req-1",
        adminId: "sva-1",
        action: "verified",
        reason: "No change needed",
      }),
    ).rejects.toThrow("must differ");
  });

  it("should override concluded verdict from verified to rejected", async () => {
    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        status: "verified",
        sectionType: "skill",
        userId: "user-1",
        itemLabel: "Go",
      },
    ]);

    mockReturning.mockResolvedValueOnce([
      {
        id: "req-1",
        userId: "user-1",
        itemLabel: "Go",
        sectionType: "skill",
      },
    ]);

    const result = await verificationService.overrideConcludedVerdict({
      requestId: "req-1",
      adminId: "sva-1",
      action: "rejected",
      reason: "Documents were insufficient",
    });

    expect(result.id).toBe("req-1");
  });

  it("should override concluded verdict to verified and copy reviewer attribution", async () => {
    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        status: "rejected",
        sectionType: "project",
        userId: "user-1",
        itemLabel: "Portfolio",
      },
    ]);

    mockReturning.mockResolvedValueOnce([
      {
        id: "req-1",
        userId: "user-1",
        itemLabel: "Portfolio",
        sectionType: "project",
      },
    ]);

    mockOrderBy.mockReturnValueOnce(
      createThenableRows([
        {
          reviewerSnapshotFirstName: "Jane",
          reviewerSnapshotLastName: "Reviewer",
          reviewerSnapshotTitle: "Engineer",
          reviewerPublicProfileUrl: "/reviewer/admin-1",
        },
      ]),
    );

    mockLimit.mockReturnValueOnce([]);

    const result = await verificationService.overrideConcludedVerdict({
      requestId: "req-1",
      adminId: "sva-1",
      action: "verified",
      reason: "Reviewer assessment was correct",
    });

    expect(result.id).toBe("req-1");
  });
});

describe("verificationService status and timeline reads", () => {
  const submittedAt = new Date("2024-01-02T00:00:00.000Z");
  const earlier = new Date("2024-01-01T00:00:00.000Z");

  it("returns the latest status per item and identity, including assessment files", async () => {
    mockWhere.mockImplementationOnce(() =>
      Object.assign(Promise.resolve([]), {
        returning: mockReturning,
        limit: mockLimit,
        orderBy: mockOrderBy,
      }),
    );
    mockWhere.mockImplementationOnce(() =>
      Object.assign(
        Promise.resolve([
          {
            verificationRequestId: "req-new",
            fileUrl: "uploads/instructions",
            documentType: "assessment_instructions",
            uploadedAt: earlier,
          },
          {
            verificationRequestId: "req-new",
            fileUrl: "uploads/solution",
            documentType: "assessment_solution",
            uploadedAt: earlier,
          },
          {
            verificationRequestId: "req-new",
            fileUrl: "https://example.com/solution",
            documentType: "assessment_solution_link",
            uploadedAt: submittedAt,
          },
        ]),
        { returning: mockReturning, limit: mockLimit, orderBy: mockOrderBy },
      ),
    );
    mockOrderBy.mockImplementationOnce(() =>
      createThenableRows([
        {
          id: "req-new",
          status: "claimed",
          sectionType: "skill",
          itemId: "skill-1",
          submittedAt,
          assessmentAcceptedAt: null,
        },
        {
          id: "req-old",
          status: "pending",
          sectionType: "skill",
          itemId: "skill-1",
          submittedAt: earlier,
          assessmentAcceptedAt: null,
        },
        {
          id: "req-exp",
          status: "pending",
          sectionType: "experience",
          itemId: "exp-1",
          submittedAt,
          assessmentAcceptedAt: null,
        },
      ]),
    );

    const statuses = await verificationService.getAllStatuses("user-1");
    expect(statuses.map((row) => row.id)).toEqual(["req-new", "req-exp"]);
    expect(statuses[0]).toMatchObject({
      assessmentInstructionsUrl: "https://app.test/uploads/instructions",
      assessmentSolutionFileUrl: "https://app.test/uploads/solution",
      assessmentSolutionLinkUrl: "https://example.com/solution",
    });

    mockLimit.mockReturnValueOnce([{ id: "identity-1", status: "pending" }]);
    await expect(verificationService.getIdentityStatus("user-1")).resolves.toMatchObject({ id: "identity-1" });
    mockLimit.mockReturnValueOnce([]);
    await expect(verificationService.getIdentityStatus("user-1")).resolves.toBeNull();

    mockWhere.mockImplementationOnce(() =>
      Object.assign(
        Promise.resolve([
          { id: "old", itemId: "item-1", submittedAt: earlier },
          { id: "new", itemId: "item-1", submittedAt },
        ]),
        { returning: mockReturning, limit: mockLimit, orderBy: mockOrderBy },
      ),
    );
    await expect(verificationService.getStatusByResumeId("resume-1")).resolves.toEqual([
      { id: "new", itemId: "item-1", submittedAt },
    ]);
  });

  it("lists timeline settings and toggles them", async () => {
    mockWhere.mockImplementationOnce(() =>
      Object.assign(Promise.resolve([]), { returning: mockReturning, limit: mockLimit, orderBy: mockOrderBy }),
    );
    await expect(verificationService.listTimelineSettingsForUser("user-1")).resolves.toEqual([]);

    mockWhere
      .mockImplementationOnce(() =>
        Object.assign(Promise.resolve([{ id: "resume-1", name: "CV" }]), {
          returning: mockReturning,
          limit: mockLimit,
          orderBy: mockOrderBy,
        }),
      )
      .mockImplementationOnce(() =>
        Object.assign(Promise.resolve([{ resumeId: "resume-1", showTimeline: true }]), {
          returning: mockReturning,
          limit: mockLimit,
          orderBy: mockOrderBy,
        }),
      );
    await expect(verificationService.listTimelineSettingsForUser("user-1")).resolves.toEqual([
      { resumeId: "resume-1", name: "CV", showTimeline: true },
    ]);

    mockLimit.mockReturnValueOnce([]);
    await expect(
      verificationService.toggleTimeline({ userId: "user-1", resumeId: "missing", show: true }),
    ).rejects.toThrow("Resume not found");

    mockLimit.mockReturnValueOnce([{ id: "resume-1" }]).mockReturnValueOnce([{ id: "setting-1" }]);
    mockReturning.mockResolvedValueOnce([{ resumeId: "resume-1", showTimeline: false }]);
    await expect(
      verificationService.toggleTimeline({ userId: "user-1", resumeId: "resume-1", show: false }),
    ).resolves.toMatchObject({ showTimeline: false });

    mockLimit.mockReturnValueOnce([{ id: "resume-1" }]).mockReturnValueOnce([]);
    mockReturning.mockResolvedValueOnce([{ resumeId: "resume-1", showTimeline: true }]);
    await expect(
      verificationService.toggleTimeline({ userId: "user-1", resumeId: "resume-1", show: true }),
    ).resolves.toMatchObject({ showTimeline: true });
  });

  it("cancels a pending identity request", async () => {
    mockLimit.mockReturnValueOnce([]);
    await expect(verificationService.cancelIdentity("user-1")).rejects.toThrow("No cancellable identity");

    mockLimit.mockReturnValueOnce([{ id: "identity-1", status: "pending" }]);
    await expect(verificationService.cancelIdentity("user-1")).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe("verificationService admin queues", () => {
  const submittedAt = new Date("2024-03-01T00:00:00.000Z");

  function mockCounts(unfiltered: number, filtered: number, withJoin = false) {
    mockFrom.mockReturnValueOnce({ where: () => [{ total: unfiltered }] });
    mockFrom.mockReturnValueOnce(
      withJoin ? { innerJoin: () => ({ where: () => [{ total: filtered }] }) } : { where: () => [{ total: filtered }] },
    );
  }

  it("lists experience and identity queues", async () => {
    mockCounts(0, 0);
    await expect(verificationService.listExperienceQueue({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      items: [],
      total: 0,
    });

    const experienceRow = {
      id: "req-1",
      userId: "user-1",
      resumeId: "resume-1",
      sectionType: "experience",
      itemId: "item-1",
      itemLabel: "Engines",
      status: "pending",
      method: "document_upload",
      submittedAt,
    };
    mockCounts(2, 1, true);
    mockFrom.mockReturnValueOnce({
      innerJoin: () => ({
        where: () => ({
          orderBy: () => ({ limit: () => ({ offset: () => [experienceRow] }) }),
        }),
      }),
    });
    mockFrom
      .mockReturnValueOnce({ where: () => [{ id: "user-1", name: "Ada" }] })
      .mockReturnValueOnce({
        where: () => [
          { id: "resume-1", userId: "user-1", name: "CV" },
          { id: "resume-2", userId: "other", name: "Other" },
        ],
      })
      .mockReturnValueOnce({
        where: () => [
          {
            id: "doc-1",
            verificationRequestId: "req-1",
            fileUrl: "uploads/payslip",
            documentType: "payslip",
            uploadedAt: submittedAt,
          },
          {
            id: "doc-2",
            verificationRequestId: "req-1",
            fileUrl: "uploads/contract",
            documentType: "contract",
            uploadedAt: submittedAt,
          },
        ],
      });

    const experience = await verificationService.listExperienceQueue({ page: 1, pageSize: 20, query: "ada" });
    expect(experience.items[0]).toMatchObject({ id: "req-1", user: { name: "Ada" }, resume: { name: "CV" } });
    expect(experience.items[0]?.documents).toHaveLength(2);

    mockCounts(0, 0);
    await expect(verificationService.listIdentityQueue({ page: 1, pageSize: 20 })).resolves.toMatchObject({ total: 0 });

    const identityRow = {
      ...experienceRow,
      id: "identity-1",
      sectionType: "identity",
      resumeId: null,
      calendarLinkSentAt: null,
    };
    mockCounts(1, 1);
    mockFrom.mockReturnValueOnce({
      where: () => ({
        orderBy: () => ({ limit: () => ({ offset: () => [identityRow] }) }),
      }),
    });
    mockFrom
      .mockReturnValueOnce({ where: () => [] })
      .mockReturnValueOnce({
        where: () => ({
          orderBy: () => [
            { id: "resume-1", userId: "user-1", name: "Newest" },
            { id: "resume-0", userId: "user-1", name: "Older" },
          ],
        }),
      })
      .mockReturnValueOnce({ where: () => [] });

    const identity = await verificationService.listIdentityQueue({ page: 1, pageSize: 20 });
    expect(identity.items[0]).toMatchObject({ id: "identity-1", resume: { name: "Newest" }, user: null });
  });

  it("reviews a pending identity request and rejects the others", async () => {
    mockLimit.mockReturnValueOnce([]);
    await expect(
      verificationService.reviewIdentity({ requestId: "missing", adminId: "admin-1", action: "verified" }),
    ).rejects.toThrow("not found");

    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "pending", sectionType: "skill" }]);
    await expect(
      verificationService.reviewIdentity({ requestId: "req-1", adminId: "admin-1", action: "verified" }),
    ).rejects.toThrow("pending identity");

    mockLimit.mockReturnValueOnce([
      { id: "req-1", status: "pending", sectionType: "identity", userId: "user-1", itemLabel: "Ada" },
    ]);
    mockReturning.mockResolvedValueOnce([{ id: "req-1", status: "issue" }]);
    mockLimit.mockReturnValueOnce([{ email: "ada@example.com" }]);
    await expect(
      verificationService.reviewIdentity({ requestId: "req-1", adminId: "admin-1", action: "issue", notes: "Blurry" }),
    ).resolves.toMatchObject({ status: "issue" });

    mockLimit.mockReturnValueOnce([
      { id: "req-1", status: "pending", sectionType: "identity", userId: "user-1", itemLabel: "Ada" },
    ]);
    mockReturning.mockResolvedValueOnce([{ id: "req-1", status: "verified" }]);
    mockLimit.mockImplementationOnce(() => {
      throw new Error("mail down");
    });
    await expect(
      verificationService.reviewIdentity({ requestId: "req-1", adminId: "admin-1", action: "verified" }),
    ).resolves.toMatchObject({ status: "verified" });
  });
});

describe("verificationService uncovered branches", () => {
  const reviewerProfile = {
    firstName: "Jane",
    lastName: "Smith",
    title: "Engineer",
    publicProfileUrl: "/reviewer/admin-1",
    reviewerSkills: ["TypeScript"],
  };
  const pendingSkillRequest = {
    id: "req-1",
    userId: "user-1",
    sectionType: "skill",
    itemLabel: "TypeScript",
    status: "pending",
    claimedByAdminId: null,
  };
  const instructions = new File(["instructions"], "instructions.pdf", { type: "application/pdf" });

  it("rejects a skill label that does not match the resume item", async () => {
    mockLimit.mockReturnValueOnce([createResumeWithSkillKeyword()]);

    await expect(
      verificationService.requestSkill({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: skillKeywordId,
        itemLabel: "Rust",
      }),
    ).rejects.toThrow("Skill label does not match the resume item");
  });

  it("rejects an assessment file of the wrong type and a claim with no reviewer", async () => {
    await expect(
      verificationService.submitAssessmentSolution({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: skillKeywordId,
        file: new File(["notes"], "notes.txt", { type: "text/plain" }),
      }),
    ).rejects.toThrow("Only PDF, JPG, JPEG, PNG, and ZIP files are allowed");

    mockOrderBy.mockReturnValueOnce(
      Object.assign(Promise.resolve([]), {
        limit: vi.fn().mockReturnValue([
          {
            id: "req-1",
            userId: "user-1",
            resumeId: "resume-1",
            itemId: skillKeywordId,
            itemLabel: "TypeScript",
            sectionType: "skill",
            status: "claimed",
            claimedByAdminId: null,
          },
        ]),
      }),
    );

    await expect(
      verificationService.submitAssessmentSolution({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: skillKeywordId,
        solutionUrl: "https://github.com/you/repo",
      }),
    ).rejects.toThrow("Assessment has no assigned reviewer");
  });

  it("sends the identity calendar email only when the user has an address", async () => {
    const calendarEnv = env as { CAL_COM_LINK?: string };
    const previous = calendarEnv.CAL_COM_LINK;
    calendarEnv.CAL_COM_LINK = "https://cal.example/ada";

    try {
      mockLimit.mockReturnValueOnce([]).mockReturnValueOnce([{ email: "ada@example.com" }]);
      mockReturning.mockResolvedValueOnce([{ id: "req-5", sectionType: "identity" }]);
      await verificationService.requestIdentity("user-1");
      expect(sendIdentityVerificationRequestedEmail).toHaveBeenCalledWith({
        to: "ada@example.com",
        calLink: "https://cal.example/ada",
      });

      mockLimit.mockReturnValueOnce([]).mockReturnValueOnce([{}]);
      mockReturning.mockResolvedValueOnce([{ id: "req-6", sectionType: "identity" }]);
      await expect(verificationService.requestIdentity("user-1")).resolves.toMatchObject({ id: "req-6" });
    } finally {
      calendarEnv.CAL_COM_LINK = previous;
    }
  });

  it("uses a generic reviewer label when no snapshot name exists", async () => {
    mockLimit
      .mockReturnValueOnce([
        {
          id: "req-1",
          status: "verified",
          sectionType: "skill",
          badgeVisible: true,
          userId: "user-1",
          resumeId: "resume-1",
        },
      ])
      .mockReturnValueOnce([{ id: "resume-1" }])
      .mockReturnValueOnce([
        {
          reviewerSnapshotFirstName: null,
          reviewerSnapshotLastName: null,
          reviewerSnapshotTitle: null,
          reviewerPublicProfileUrl: null,
        },
      ]);
    mockOrderBy.mockReturnValueOnce(
      createThenableRows([
        {
          reviewerSnapshotFirstName: "",
          reviewerSnapshotLastName: null,
          reviewerSnapshotTitle: null,
          reviewerPublicProfileUrl: null,
        },
      ]),
    );

    await expect(verificationService.getBadgeDetail("req-1")).resolves.toEqual({
      type: "reviewer",
      label: "Verified",
      profileUrl: null,
    });
  });

  it("omits the title when the reviewer snapshot has only a first name", async () => {
    mockLimit
      .mockReturnValueOnce([
        {
          id: "req-1",
          status: "verified",
          sectionType: "project",
          badgeVisible: true,
          userId: "user-1",
          resumeId: "resume-1",
        },
      ])
      .mockReturnValueOnce([{ id: "resume-1" }])
      .mockReturnValueOnce([
        {
          reviewerSnapshotFirstName: "Ada",
          reviewerSnapshotLastName: null,
          reviewerSnapshotTitle: null,
          reviewerPublicProfileUrl: null,
        },
      ]);

    await expect(verificationService.getBadgeDetail("req-1")).resolves.toEqual({
      type: "reviewer",
      label: "Ada",
      profileUrl: null,
    });
  });

  it("returns no history and labels an admin verifier when the reviewer name is missing", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ orderBy: vi.fn(() => []) })),
    });
    await expect(
      verificationService.getHistory({ userId: "user-1", resumeId: "resume-1", itemId: "item-1" }),
    ).resolves.toEqual([]);

    const history = [{ id: "req-1", sectionType: "experience", status: "verified", itemLabel: "Acme" }];
    for (const adminRole of ["skill_verdict_admin", "reviewer_admin", "company"] as const) {
      mockFrom
        .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => history) })) })
        .mockReturnValueOnce({ where: vi.fn(() => [{ id: "req-1", sectionType: "experience" }]) })
        .mockReturnValueOnce({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => [
              {
                verificationRequestId: "req-1",
                adminRole,
                reviewerSnapshotFirstName: null,
                reviewerSnapshotLastName: null,
                reviewerPublicProfileUrl: null,
              },
            ]),
          })),
        });
    }

    const labels = ["Skill Verdict Admin", "Reviewer Admin", "Admin Reviewer"];
    for (const label of labels) {
      const result = await verificationService.getHistory({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: "item-1",
      });
      expect(result[0]?.verifiedBy).toBe(label);
      expect(result[0]?.reviewerProfileUrl).toBeNull();
    }
  });

  it("hides a public timeline that is private, disabled, or empty", async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => ({ limit: vi.fn(() => []) })) });
    await expect(verificationService.getPublicTimeline({ resumeId: "resume-1" })).resolves.toEqual({
      enabled: false,
      entries: [],
    });

    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ limit: vi.fn(() => [{ id: "resume-1", isPublic: false }]) })),
    });
    await expect(verificationService.getPublicTimeline({ resumeId: "resume-1" })).resolves.toEqual({
      enabled: false,
      entries: [],
    });

    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => ({ limit: vi.fn(() => [{ id: "resume-1", isPublic: true }]) })) })
      .mockReturnValueOnce({ where: vi.fn(() => ({ limit: vi.fn(() => []) })) });
    await expect(verificationService.getPublicTimeline({ resumeId: "resume-1" })).resolves.toEqual({
      enabled: false,
      entries: [],
    });

    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => ({ limit: vi.fn(() => [{ id: "resume-1", isPublic: true }]) })) })
      .mockReturnValueOnce({ where: vi.fn(() => ({ limit: vi.fn(() => [{ showTimeline: true }]) })) })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) });
    await expect(verificationService.getPublicTimeline({ resumeId: "resume-1" })).resolves.toEqual({
      enabled: true,
      entries: [],
    });
  });

  it("keeps freelancer links as-is and refuses to download them", async () => {
    const link = {
      id: "doc-1",
      fileUrl: "https://www.upwork.com/freelancers/~abc",
      documentType: "freelancer_link",
      uploadedAt: new Date(),
    };
    mockFrom
      .mockReturnValueOnce({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([{ id: "req-1" }]) }) })
      .mockReturnValueOnce({ where: vi.fn().mockReturnValue([link]) });

    await expect(verificationService.getDocuments("req-1")).resolves.toEqual([link]);

    mockFrom.mockReturnValueOnce({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([link]) }),
    });
    await expect(verificationService.downloadDocument("doc-1")).rejects.toThrow("External links cannot be downloaded");
  });

  it("rejects reviewer document access that is missing, wrong-typed, or unassigned", async () => {
    mockLimit.mockReturnValueOnce([]);
    await expect(
      verificationService.downloadReviewerDocument({ requestId: "req-1", documentId: "doc-1", adminId: "admin-1" }),
    ).rejects.toThrow("Verification request not found");

    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        userId: "user-1",
        sectionType: "experience",
        itemLabel: "Acme",
        status: "pending",
        claimedByAdminId: null,
      },
    ]);
    await expect(
      verificationService.downloadReviewerDocument({ requestId: "req-1", documentId: "doc-1", adminId: "admin-1" }),
    ).rejects.toThrow("Document access is limited to skill and project requests");

    mockLimit.mockReturnValueOnce([
      {
        id: "req-1",
        userId: "user-1",
        sectionType: "skill",
        itemLabel: "TypeScript",
        status: "claimed",
        claimedByAdminId: "other-admin",
      },
    ]);
    await expect(
      verificationService.downloadReviewerDocument({ requestId: "req-1", documentId: "doc-1", adminId: "admin-1" }),
    ).rejects.toThrow("You do not have access to this document");

    mockLimit
      .mockReturnValueOnce([
        {
          id: "req-1",
          userId: "user-1",
          sectionType: "skill",
          itemLabel: "Rust",
          status: "pending",
          claimedByAdminId: null,
        },
      ])
      .mockReturnValueOnce([{ reviewerSkills: ["TypeScript"] }]);
    await expect(
      verificationService.downloadReviewerDocument({ requestId: "req-1", documentId: "doc-1", adminId: "admin-1" }),
    ).rejects.toThrow("You do not have access to this document");

    mockLimit
      .mockReturnValueOnce([
        {
          id: "req-1",
          userId: "user-1",
          sectionType: "skill",
          itemLabel: "TypeScript",
          status: "pending",
          claimedByAdminId: null,
        },
      ])
      .mockReturnValueOnce([]);
    await expect(
      verificationService.downloadReviewerDocument({ requestId: "req-1", documentId: "doc-1", adminId: "admin-1" }),
    ).rejects.toThrow("Reviewer profile not found");
  });

  it("downloads an assigned reviewer file and reports a missing or external one", async () => {
    const assigned = {
      id: "req-1",
      userId: "user-1",
      sectionType: "skill",
      itemLabel: "TypeScript",
      status: "claimed",
      claimedByAdminId: "admin-1",
    };

    mockLimit.mockReturnValueOnce([assigned]).mockReturnValueOnce([
      {
        id: "doc-1",
        verificationRequestId: "req-1",
        fileUrl: "uploads/a.pdf",
        documentType: "assessment_instructions",
      },
    ]);
    mockStorageRead.mockResolvedValueOnce({ data: new Uint8Array([1]), size: 1 });
    await expect(
      verificationService.downloadReviewerDocument({ requestId: "req-1", documentId: "doc-1", adminId: "admin-1" }),
    ).resolves.toMatchObject({ id: "doc-1", contentType: "application/octet-stream", size: 1 });

    mockLimit.mockReturnValueOnce([assigned]).mockReturnValueOnce([
      {
        id: "doc-2",
        fileUrl: "https://example.com/proof",
        documentType: "assessment_solution_link",
      },
    ]);
    await expect(
      verificationService.downloadReviewerDocument({ requestId: "req-1", documentId: "doc-2", adminId: "admin-1" }),
    ).rejects.toThrow("External links cannot be downloaded");

    mockLimit
      .mockReturnValueOnce([
        {
          id: "req-1",
          userId: "user-1",
          sectionType: "project",
          itemLabel: "App",
          status: "pending",
          claimedByAdminId: null,
        },
      ])
      .mockReturnValueOnce([{ reviewerSkills: [] }])
      .mockReturnValueOnce([]);
    await expect(
      verificationService.downloadReviewerDocument({ requestId: "req-1", documentId: "doc-3", adminId: "admin-1" }),
    ).rejects.toThrow("Document not found");

    mockLimit.mockReturnValueOnce([assigned]).mockReturnValueOnce([
      {
        id: "doc-4",
        fileUrl: "uploads/missing.pdf",
        documentType: "assessment_instructions",
      },
    ]);
    mockStorageRead.mockResolvedValueOnce(null);
    await expect(
      verificationService.downloadReviewerDocument({ requestId: "req-1", documentId: "doc-4", adminId: "admin-1" }),
    ).rejects.toThrow("Document file not found in storage");
  });

  it("rolls back an accepted case when upload or recording fails, and skips a missing email", async () => {
    mockLimit.mockReturnValueOnce([reviewerProfile]).mockReturnValueOnce([pendingSkillRequest]);
    mockReturning.mockResolvedValueOnce([
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        itemId: "item-1",
        itemLabel: "TypeScript",
        sectionType: "skill",
      },
    ]);
    mockUploadFile.mockRejectedValueOnce(new Error("disk full"));
    await expect(
      verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file: instructions }),
    ).rejects.toThrow("Failed to upload assessment instructions");

    mockLimit.mockReturnValueOnce([reviewerProfile]).mockReturnValueOnce([pendingSkillRequest]);
    mockReturning.mockResolvedValueOnce([
      {
        id: "req-1",
        userId: "user-1",
        resumeId: null,
        itemId: "item-1",
        itemLabel: "TypeScript",
        sectionType: "skill",
      },
    ]);
    await expect(
      verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file: instructions }),
    ).rejects.toThrow("Request is missing a resume");

    mockLimit.mockReturnValueOnce([reviewerProfile]).mockReturnValueOnce([pendingSkillRequest]);
    mockReturning.mockResolvedValueOnce([
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        itemId: "item-1",
        itemLabel: "TypeScript",
        sectionType: "experience",
      },
    ]);
    await expect(
      verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file: instructions }),
    ).rejects.toThrow("Request must be a skill or project verification request");

    mockLimit
      .mockReturnValueOnce([{ ...reviewerProfile, reviewerSkills: ["Go"] }])
      .mockReturnValueOnce([pendingSkillRequest]);
    await expect(
      verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file: instructions }),
    ).rejects.toThrow("This skill is not in your assigned reviewable skills");

    mockLimit.mockReturnValueOnce([reviewerProfile]).mockReturnValueOnce([pendingSkillRequest]);
    mockReturning.mockResolvedValueOnce([
      {
        id: "req-1",
        userId: "user-1",
        resumeId: "resume-1",
        itemId: "item-1",
        itemLabel: "TypeScript",
        sectionType: "skill",
      },
    ]);
    mockUploadFile.mockResolvedValueOnce({
      key: "uploads/instructions.pdf",
      url: "https://app.test/uploads/instructions.pdf",
    });
    mockTransaction.mockRejectedValueOnce(new Error("db down"));
    await expect(
      verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file: instructions }),
    ).rejects.toThrow("Failed to record assessment acceptance");
    expect(mockStorageDelete).toHaveBeenCalledWith("uploads/instructions.pdf");

    const claimed = {
      id: "req-1",
      userId: "user-1",
      resumeId: "resume-1",
      itemId: "item-1",
      itemLabel: "TypeScript",
      sectionType: "skill",
      status: "claimed",
    };
    mockLimit
      .mockReturnValueOnce([reviewerProfile])
      .mockReturnValueOnce([pendingSkillRequest])
      .mockReturnValueOnce([{ email: "ada@example.com" }]);
    mockReturning.mockResolvedValueOnce([claimed]);
    mockUploadFile.mockResolvedValueOnce({ key: "uploads/ok.pdf", url: "https://app.test/uploads/ok.pdf" });
    mockTransaction.mockImplementationOnce(async (callback) =>
      callback({
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockReturnValue([claimed]),
            })),
          })),
        })),
      }),
    );
    await expect(
      verificationService.acceptCase({ requestId: "req-1", adminId: "admin-1", file: instructions, message: "Ready" }),
    ).resolves.toMatchObject({ status: "claimed" });
    expect(sendSkillAssessmentAcceptedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ada@example.com", itemLabel: "TypeScript", message: "Ready" }),
    );
  });

  it("returns an empty reviewer queue when the profile has no skills or no matching requests", async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => ({ limit: vi.fn(() => []) })) });
    await expect(verificationService.listQueue("admin-1")).resolves.toEqual([]);

    mockFrom.mockReturnValueOnce({ where: vi.fn(() => ({ limit: vi.fn(() => [{ reviewerSkills: [] }]) })) });
    await expect(verificationService.listQueue("admin-1")).resolves.toEqual([]);

    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => ({ limit: vi.fn(() => [{ reviewerSkills: ["TypeScript"] }]) })) })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) });
    await expect(verificationService.listQueue("admin-1")).resolves.toEqual([]);
  });

  it("rejects a missing experience review", async () => {
    mockLimit.mockReturnValueOnce([]);
    await expect(
      verificationService.reviewExperience({ requestId: "missing", adminId: "sva-1", action: "verified" }),
    ).rejects.toThrow("Verification request not found");
  });
});
