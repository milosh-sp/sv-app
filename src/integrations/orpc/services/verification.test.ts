import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockReturning = vi.fn();
const mockLimit = vi.fn((): any => []);
const mockWhere = vi.fn((): any => ({ returning: mockReturning, limit: mockLimit }));
const mockSet = vi.fn((): any => ({ where: mockWhere, returning: mockReturning }));
const mockValues = vi.fn((): any => ({ returning: mockReturning }));
const mockOrderBy = vi.fn((): any => []);
const mockFrom = vi.fn((): any => ({ where: mockWhere, limit: mockLimit, orderBy: mockOrderBy }));
const mockSelect = vi.fn((): any => ({ from: mockFrom }));

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: mockSelect,
    insert: vi.fn((): any => ({ values: mockValues })),
    update: vi.fn((): any => ({ set: mockSet })),
  },
}));

const mockStorageRead = vi.fn();

vi.mock("./storage", () => ({
  getStorageService: () => ({
    read: mockStorageRead,
  }),
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
    badgeVisible: "badge_visible",
    calendarLinkSentAt: "calendar_link_sent_at",
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
  },
}));

const { verificationService } = await import("./verification");

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockReturnValue([]);
});

describe("verificationService.requestSkill", () => {
  it("should create a skill verification request", async () => {
    mockLimit.mockReturnValueOnce([]);
    const request = { id: "req-1", sectionType: "skill", status: "pending" };
    mockReturning.mockResolvedValueOnce([request]);

    const result = await verificationService.requestSkill({
      userId: "user-1",
      resumeId: "resume-1",
      itemId: "item-1",
      itemLabel: "TypeScript",
    });

    expect(result.sectionType).toBe("skill");
    expect(result.status).toBe("pending");
  });

  it("should error if active request exists", async () => {
    mockLimit.mockReturnValueOnce([{ id: "existing", status: "pending" }]);

    await expect(
      verificationService.requestSkill({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: "item-1",
        itemLabel: "TypeScript",
      }),
    ).rejects.toThrow("An active verification request already exists");
  });

  it("should error when status is claimed", async () => {
    mockLimit.mockReturnValueOnce([{ id: "existing", status: "claimed" }]);

    await expect(
      verificationService.requestSkill({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: "item-1",
        itemLabel: "TypeScript",
      }),
    ).rejects.toThrow("An active verification request already exists");
  });

  it("should error when status is verdict_pending", async () => {
    mockLimit.mockReturnValueOnce([{ id: "existing", status: "verdict_pending" }]);

    await expect(
      verificationService.requestSkill({
        userId: "user-1",
        resumeId: "resume-1",
        itemId: "item-1",
        itemLabel: "TypeScript",
      }),
    ).rejects.toThrow("An active verification request already exists");
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
  it("should toggle when approved", async () => {
    mockLimit.mockReturnValueOnce([{ status: "approved", userId: "user-1" }]);
    mockReturning.mockResolvedValueOnce([{ id: "req-1", badgeVisible: false }]);

    const result = await verificationService.toggleBadge({
      userId: "user-1",
      requestId: "req-1",
      visible: false,
    });

    expect(result.badgeVisible).toBe(false);
  });

  it("should error when not approved", async () => {
    mockLimit.mockReturnValueOnce([{ status: "pending", userId: "user-1" }]);

    await expect(
      verificationService.toggleBadge({
        userId: "user-1",
        requestId: "req-1",
        visible: false,
      }),
    ).rejects.toThrow("Badge visibility can only be toggled for approved requests");
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
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "approved", sectionType: "identity" }]);

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toEqual({ type: "identity", label: "Identity Verified" });
  });

  it("should return role label for experience type", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "approved", sectionType: "experience" }]);

    const result = await verificationService.getBadgeDetail("req-1");

    expect(result).toEqual({ type: "experience", label: "Verified by Skill Verdict Admin" });
  });

  it("should return snapshot data for skill type", async () => {
    mockLimit
      .mockReturnValueOnce([{ id: "req-1", status: "approved", sectionType: "skill" }])
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
      .mockReturnValueOnce([{ id: "req-1", status: "approved", sectionType: "project" }])
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
});

describe("verificationService.getStatus", () => {
  it("should return verification statuses for a resume", async () => {
    const statuses = [
      { id: "req-1", sectionType: "skill", itemId: "item-1", itemLabel: "TS", status: "approved", badgeVisible: true },
    ];
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => statuses), limit: mockLimit, orderBy: mockOrderBy });

    const result = await verificationService.getStatus({ userId: "user-1", resumeId: "resume-1" });

    expect(result).toEqual(statuses);
  });

  it("should not include internal fields", async () => {
    const statuses = [
      { id: "req-1", sectionType: "skill", itemId: "item-1", itemLabel: "TS", status: "approved", badgeVisible: true },
    ];
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => statuses), limit: mockLimit, orderBy: mockOrderBy });

    const result = await verificationService.getStatus({ userId: "user-1", resumeId: "resume-1" });
    const first = result[0];

    expect(first).not.toHaveProperty("reviewerNote");
    expect(first).not.toHaveProperty("claimedByAdminId");
  });
});

describe("verificationService.getHistory", () => {
  it("should return history without reviewerNote or admin identity", async () => {
    const history = [
      { id: "req-1", sectionType: "skill", itemLabel: "TS", status: "approved", submittedAt: new Date(), resolvedAt: new Date() },
    ];
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ orderBy: vi.fn(() => history) })),
      limit: mockLimit,
      orderBy: mockOrderBy,
    });

    const result = await verificationService.getHistory({ userId: "user-1", itemId: "item-1" });

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("reviewerNote");
    expect(result[0]).not.toHaveProperty("claimedByAdminId");
  });
});

// --- Admin procedures ---

describe("verificationService.claimCase", () => {
  it("should error if already claimed", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "pending", claimedByAdminId: "admin-2" }]);

    await expect(
      verificationService.claimCase({ requestId: "req-1", adminId: "admin-1" }),
    ).rejects.toThrow("already claimed");
  });

  it("should error if not pending", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "claimed", claimedByAdminId: null }]);

    await expect(
      verificationService.claimCase({ requestId: "req-1", adminId: "admin-1" }),
    ).rejects.toThrow("not pending");
  });

  it("should error if not found", async () => {
    mockLimit.mockReturnValueOnce([]);

    await expect(
      verificationService.claimCase({ requestId: "req-1", adminId: "admin-1" }),
    ).rejects.toThrow("not found");
  });
});

describe("verificationService.submitVerdict", () => {
  it("should error if consent not given", async () => {
    mockLimit
      .mockReturnValueOnce([{ id: "req-1", status: "claimed", claimedByAdminId: "admin-1" }])
      .mockReturnValueOnce([{ consentGiven: false }]);

    await expect(
      verificationService.submitVerdict({
        requestId: "req-1",
        adminId: "admin-1",
        verdict: "approved",
      }),
    ).rejects.toThrow("Consent must be given");
  });

  it("should error if not the claiming reviewer", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "claimed", claimedByAdminId: "admin-2" }]);

    await expect(
      verificationService.submitVerdict({
        requestId: "req-1",
        adminId: "admin-1",
        verdict: "approved",
      }),
    ).rejects.toThrow("Only the claiming reviewer");
  });

  it("should error if not in claimed status", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "pending", claimedByAdminId: "admin-1" }]);

    await expect(
      verificationService.submitVerdict({
        requestId: "req-1",
        adminId: "admin-1",
        verdict: "approved",
      }),
    ).rejects.toThrow("must be in claimed status");
  });

  it("should error if profile not found", async () => {
    mockLimit
      .mockReturnValueOnce([{ id: "req-1", status: "claimed", claimedByAdminId: "admin-1" }])
      .mockReturnValueOnce([]);

    await expect(
      verificationService.submitVerdict({
        requestId: "req-1",
        adminId: "admin-1",
        verdict: "approved",
      }),
    ).rejects.toThrow("Reviewer profile not found");
  });
});

describe("verificationService.reviewExperience", () => {
  it("should error if not experience type", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "pending", sectionType: "skill" }]);

    await expect(
      verificationService.reviewExperience({
        requestId: "req-1",
        adminId: "sva-1",
        action: "approved",
      }),
    ).rejects.toThrow("must be a pending experience request");
  });

  it("should error if not pending", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "claimed", sectionType: "experience" }]);

    await expect(
      verificationService.reviewExperience({
        requestId: "req-1",
        adminId: "sva-1",
        action: "approved",
      }),
    ).rejects.toThrow("must be a pending experience request");
  });
});

describe("verificationService.confirmVerdict", () => {
  it("should error if not verdict_pending", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "claimed" }]);

    await expect(
      verificationService.confirmVerdict({ requestId: "req-1", adminId: "sva-1" }),
    ).rejects.toThrow("must be in verdict_pending status");
  });

  it("should error if not found", async () => {
    mockLimit.mockReturnValueOnce([]);

    await expect(
      verificationService.confirmVerdict({ requestId: "non-existent", adminId: "sva-1" }),
    ).rejects.toThrow("not found");
  });
});

describe("verificationService.overrideVerdict", () => {
  it("should error if not verdict_pending", async () => {
    mockLimit.mockReturnValueOnce([{ id: "req-1", status: "approved" }]);

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
  it("should return documents for a valid request", async () => {
    const docs = [
      { id: "doc-1", fileUrl: "uploads/user-1/item-1/file.pdf", documentType: "contract", uploadedAt: new Date() },
    ];
    // First query: check request exists (select→from→where→limit)
    mockFrom.mockReturnValueOnce({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([{ id: "req-1" }]) }) });
    // Second query: get documents (select→from→where)
    mockFrom.mockReturnValueOnce({ where: vi.fn().mockReturnValue(docs) });

    const result = await verificationService.getDocuments("req-1");

    expect(result).toEqual(docs);
  });

  it("should error if request not found", async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([]) }) });

    await expect(verificationService.getDocuments("non-existent")).rejects.toThrow("not found");
  });

  it("should return empty array if no documents attached", async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([{ id: "req-1" }]) }) });
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
});
