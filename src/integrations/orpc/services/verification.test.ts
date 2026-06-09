import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

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
    mockLimit.mockReturnValueOnce([createResumeWithSkillKeyword()]).mockReturnValueOnce([
      { id: "existing", status: "pending" },
    ]);

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
    mockLimit.mockReturnValueOnce([createResumeWithSkillKeyword()]).mockReturnValueOnce([
      { id: "existing", status: "claimed" },
    ]);

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
    mockLimit.mockReturnValueOnce([createResumeWithSkillKeyword()]).mockReturnValueOnce([
      { id: "existing", status: "verdict_pending" },
    ]);

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

  it("should return identity label for identity type", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "verified", sectionType: "identity" }]);

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toEqual({ type: "identity", label: "Identity Verified" });
  });

  it("should return role label for experience type", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "verified", sectionType: "experience" }]);

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toEqual({ type: "experience", label: "Verified by Skill Verdict Admin" });
  });

  it("should return snapshot data for skill type", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "verified", sectionType: "skill" }]).mockReturnValueOnce([
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
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "verified", sectionType: "project" }]).mockReturnValueOnce([
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
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "verified", sectionType: "skill" }]).mockReturnValueOnce([
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
        assessmentAcceptedAt: null,
      },
      {
        ...identityStatus,
        assessmentInstructionsUrl: null,
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
    expect(result[0]?.verifiedBy).toBe("Jane Reviewer");
    expect(result[0]).not.toHaveProperty("reviewerNote");
    expect(result[0]).not.toHaveProperty("claimedByAdminId");
  });
});

describe("verificationService.getPublicTimeline", () => {
  it("should include verifiedBy for verified entries", async () => {
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
        sectionType: "project",
        itemLabel: "Portfolio",
        status: "pending",
        submittedAt: new Date(),
        resolvedAt: null,
      },
    ];

    mockFrom
      .mockReturnValueOnce({
        where: vi.fn(() => ({ limit: vi.fn(() => [{ id: "resume-1", isPublic: true }]) })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ limit: vi.fn(() => [{ showTimeline: true }]) })),
      })
      .mockReturnValueOnce({
        where: vi.fn(() => ({ orderBy: vi.fn(() => entries) })),
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
    expect(result.entries[0]?.verifiedBy).toBe("Jane Reviewer");
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
    mockLimit.mockReturnValueOnce([reviewerProfile]);
    mockReturning.mockResolvedValueOnce([{ id: "req-1", status: "verdict_pending", proposedVerdict: "verified" }]);

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

describe("verificationService.listPendingVerdicts", () => {
  it("returns empty array when no verdict_pending requests exist", async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) });
    const result = await verificationService.listPendingVerdicts();
    expect(result).toEqual([]);
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
      },
    ];
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => rows) })) })
      .mockReturnValueOnce({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) })
      .mockReturnValueOnce({ where: vi.fn(() => []) });
    const result = await verificationService.listPendingVerdicts();
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("verdict_pending");
    expect(result[0].proposedVerdict).toBe("verified");
  });
});
