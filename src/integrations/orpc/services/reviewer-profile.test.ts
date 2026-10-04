import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockInnerJoin = vi.fn((): any => ({ leftJoin: mockLeftJoin }));
const mockLeftJoin = vi.fn((): any => ({ where: mockWhere }));
const mockReturning = vi.fn();
const mockLimit = vi.fn((): any[] => []);
const mockWhere = vi.fn((): any => ({ returning: mockReturning, limit: mockLimit }));
const mockSet = vi.fn((): any => ({ where: mockWhere, returning: mockReturning }));
const mockValues = vi.fn((): any => ({ returning: mockReturning }));
const mockOrderBy = vi.fn((): any => ({ limit: vi.fn(() => []) }));
const mockFrom = vi.fn((): any => ({
  where: mockWhere,
  limit: mockLimit,
  orderBy: mockOrderBy,
  innerJoin: mockInnerJoin,
}));
const mockSelect = vi.fn((): any => ({ from: mockFrom }));

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: mockSelect,
    insert: vi.fn(() => ({ values: mockValues })),
    update: vi.fn(() => ({ set: mockSet })),
    delete: vi.fn(() => ({ where: mockWhere })),
  },
}));

vi.mock("@/integrations/drizzle/schema", () => ({
  adminRoles: {
    userId: "user_id",
    role: "role",
  },
  user: {
    id: "id",
    name: "name",
    email: "email",
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
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  reviewerProfileChangeRequests: {
    id: "id",
    adminId: "admin_id",
    requestedFirstName: "requested_first_name",
    requestedTitle: "requested_title",
    status: "status",
    requestedAt: "requested_at",
    resolvedAt: "resolved_at",
    resolvedByAdminId: "resolved_by_admin_id",
    rejectionReason: "rejection_reason",
  },
}));

const { reviewerProfileService } = await import("./reviewer-profile");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reviewerProfileService.create", () => {
  it("should create a profile with consentGiven false", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ returning: mockReturning, limit: vi.fn(() => []) })),
      limit: mockLimit,
      orderBy: mockOrderBy,
    });
    const profile = {
      id: "profile-1",
      adminId: "admin-1",
      firstName: "Jane",
      lastName: "Smith",
      title: "Senior Engineer at Meta",
      publicProfileUrl: "/reviewer/admin-1",
      consentGiven: false,
      consentGivenAt: null,
    };
    mockReturning.mockResolvedValueOnce([profile]);

    const result = await reviewerProfileService.create({
      adminId: "admin-1",
      firstName: "Jane",
      lastName: "Smith",
      title: "Senior Engineer at Meta",
    });

    expect(result).toEqual(profile);
    expect(result.consentGiven).toBe(false);
  });

  it("should error if adminId already has a profile", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ returning: mockReturning, limit: vi.fn(() => [{ id: "existing" }]) })),
      limit: mockLimit,
      orderBy: mockOrderBy,
    });

    await expect(
      reviewerProfileService.create({
        adminId: "admin-1",
        firstName: "Jane",
        lastName: "Smith",
        title: "Engineer",
      }),
    ).rejects.toThrow("A reviewer profile already exists");
  });
});

describe("reviewerProfileService.list", () => {
  it("should return reviewer admins with profiles", async () => {
    mockFrom.mockReturnValueOnce({
      innerJoin: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() =>
            Promise.resolve([
              {
                userId: "admin-1",
                name: "Jane Reviewer",
                email: "jane@example.com",
                profile: {
                  id: "profile-1",
                  adminId: "admin-1",
                  firstName: "Jane",
                  lastName: "Reviewer",
                  title: "Engineer",
                  reviewerSkills: ["Python"],
                },
              },
              {
                userId: "admin-2",
                name: "No Profile",
                email: "none@example.com",
                profile: {
                  id: null,
                  adminId: null,
                  firstName: null,
                  lastName: null,
                  title: null,
                  reviewerSkills: null,
                },
              },
            ]),
          ),
        })),
      })),
    });

    const result = await reviewerProfileService.list();

    expect(result).toHaveLength(2);
    expect(result[0]?.profile?.reviewerSkills).toEqual(["Python"]);
    expect(result[1]?.profile).toBeNull();
  });
});

describe("reviewerProfileService.updateDirect", () => {
  it("should update any field", async () => {
    const updated = {
      id: "profile-1",
      adminId: "admin-1",
      firstName: "Updated",
      lastName: "Smith",
      title: "New Title",
    };
    mockReturning.mockResolvedValueOnce([updated]);

    const result = await reviewerProfileService.updateDirect({
      adminId: "admin-1",
      firstName: "Updated",
      title: "New Title",
    });

    expect(result.firstName).toBe("Updated");
    expect(result.title).toBe("New Title");
  });

  it("should error with no fields to update", async () => {
    await expect(reviewerProfileService.updateDirect({ adminId: "admin-1" })).rejects.toThrow("No fields to update");
  });

  it("should update reviewer skills", async () => {
    const updated = {
      id: "profile-1",
      adminId: "admin-1",
      reviewerSkills: ["C#", "Python"],
    };
    mockReturning.mockResolvedValueOnce([updated]);

    const result = await reviewerProfileService.updateDirect({
      adminId: "admin-1",
      reviewerSkills: [" C# ", "c#", "Python"],
    });

    expect(result.reviewerSkills).toEqual(["C#", "Python"]);
  });
});

describe("reviewerProfileService.giveConsent", () => {
  it("should set consentGiven to true and consentGivenAt", async () => {
    const updated = {
      id: "profile-1",
      adminId: "admin-1",
      consentGiven: true,
      consentGivenAt: new Date(),
    };
    mockReturning.mockResolvedValueOnce([updated]);

    const result = await reviewerProfileService.giveConsent("admin-1");

    expect(result.consentGiven).toBe(true);
    expect(result.consentGivenAt).toBeDefined();
  });
});

describe("reviewerProfileService.requestChange", () => {
  it("should create a change request for firstName", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ returning: mockReturning, limit: vi.fn(() => []) })),
      limit: mockLimit,
      orderBy: mockOrderBy,
    });
    const request = {
      id: "req-1",
      adminId: "admin-1",
      requestedFirstName: "NewFirst",
      requestedTitle: null,
      status: "pending",
    };
    mockReturning.mockResolvedValueOnce([request]);

    const result = await reviewerProfileService.requestChange({
      adminId: "admin-1",
      firstName: "NewFirst",
    });

    expect(result.requestedFirstName).toBe("NewFirst");
    expect(result.status).toBe("pending");
  });

  it("should error if pending request already exists", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ returning: mockReturning, limit: vi.fn(() => [{ id: "existing-req" }]) })),
      limit: mockLimit,
      orderBy: mockOrderBy,
    });

    await expect(
      reviewerProfileService.requestChange({
        adminId: "admin-1",
        firstName: "NewFirst",
      }),
    ).rejects.toThrow("A pending change request already exists");
  });

  it("should error if no fields provided", async () => {
    await expect(reviewerProfileService.requestChange({ adminId: "admin-1" })).rejects.toThrow(
      "At least one field must be provided",
    );
  });
});

describe("reviewerProfileService.resolveChangeRequest", () => {
  it("should approve and update live profile", async () => {
    const request = {
      id: "req-1",
      adminId: "admin-1",
      requestedFirstName: "NewFirst",
      requestedTitle: "New Title",
      status: "pending",
    };
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ returning: mockReturning, limit: vi.fn(() => [request]) })),
      limit: mockLimit,
      orderBy: mockOrderBy,
    });
    const resolved = { ...request, status: "approved", resolvedAt: new Date() };
    mockReturning.mockResolvedValueOnce([resolved]);

    const result = await reviewerProfileService.resolveChangeRequest({
      requestId: "req-1",
      action: "approved",
      resolvedByAdminId: "sva-1",
    });

    expect(result.status).toBe("approved");
  });

  it("should reject with reason and leave live profile unchanged", async () => {
    const request = {
      id: "req-2",
      adminId: "admin-1",
      requestedFirstName: "NewFirst",
      requestedTitle: null,
      status: "pending",
    };
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ returning: mockReturning, limit: vi.fn(() => [request]) })),
      limit: mockLimit,
      orderBy: mockOrderBy,
    });
    const resolved = {
      ...request,
      status: "rejected",
      rejectionReason: "Not allowed",
      resolvedAt: new Date(),
    };
    mockReturning.mockResolvedValueOnce([resolved]);

    const result = await reviewerProfileService.resolveChangeRequest({
      requestId: "req-2",
      action: "rejected",
      resolvedByAdminId: "sva-1",
      rejectionReason: "Not allowed",
    });

    expect(result.status).toBe("rejected");
  });

  it("should error if request not found", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ returning: mockReturning, limit: vi.fn(() => []) })),
      limit: mockLimit,
      orderBy: mockOrderBy,
    });

    await expect(
      reviewerProfileService.resolveChangeRequest({
        requestId: "non-existent",
        action: "approved",
        resolvedByAdminId: "sva-1",
      }),
    ).rejects.toThrow("Change request not found");
  });

  it("should error if request is not pending", async () => {
    const request = {
      id: "req-3",
      adminId: "admin-1",
      status: "approved",
    };
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ returning: mockReturning, limit: vi.fn(() => [request]) })),
      limit: mockLimit,
      orderBy: mockOrderBy,
    });

    await expect(
      reviewerProfileService.resolveChangeRequest({
        requestId: "req-3",
        action: "approved",
        resolvedByAdminId: "sva-1",
      }),
    ).rejects.toThrow("Change request is not pending");
  });

  it("approves a request that does not change the live profile", async () => {
    const request = {
      id: "req-4",
      adminId: "admin-1",
      requestedFirstName: null,
      requestedTitle: null,
      status: "pending",
    };
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({ returning: mockReturning, limit: vi.fn(() => [request]) })),
      limit: mockLimit,
      orderBy: mockOrderBy,
    });
    mockReturning.mockResolvedValueOnce([{ ...request, status: "approved" }]);

    await expect(
      reviewerProfileService.resolveChangeRequest({
        requestId: "req-4",
        action: "approved",
        resolvedByAdminId: "sva-1",
      }),
    ).resolves.toMatchObject({ status: "approved" });
  });
});

describe("reviewerProfileService reads", () => {
  const profile = { id: "profile-1", adminId: "admin-1", firstName: "Ada", title: "Reviewer" };

  it("returns a profile or null, and errors when a required profile is missing", async () => {
    await expect(reviewerProfileService.getByAdminIdOrNull("admin-1")).resolves.toBeNull();
    mockLimit.mockReturnValueOnce([profile]);
    await expect(reviewerProfileService.getByAdminIdOrNull("admin-1")).resolves.toEqual(profile);

    await expect(reviewerProfileService.getByAdminId("missing")).rejects.toThrow("Reviewer profile not found");
    mockLimit.mockReturnValueOnce([profile]);
    await expect(reviewerProfileService.getByAdminId("admin-1")).resolves.toEqual(profile);

    await expect(reviewerProfileService.getPublicProfile("missing")).rejects.toThrow("Reviewer profile not found");
    mockLimit.mockReturnValueOnce([profile]);
    await expect(reviewerProfileService.getPublicProfile("admin-1")).resolves.toEqual(profile);

    mockReturning.mockResolvedValueOnce([]);
    await expect(reviewerProfileService.updateDirect({ adminId: "missing", title: "Next" })).rejects.toThrow(
      "Reviewer profile not found",
    );

    mockReturning.mockResolvedValueOnce([]);
    await expect(reviewerProfileService.giveConsent("missing")).rejects.toThrow("Reviewer profile not found");
  });

  it("returns the latest change request, or null, and lists pending requests", async () => {
    mockFrom.mockReturnValueOnce({
      where: () => ({ orderBy: () => ({ limit: () => [] }) }),
    });
    await expect(reviewerProfileService.getChangeRequestStatus("admin-1")).resolves.toBeNull();

    const request = { id: "req-1", status: "pending" };
    mockFrom.mockReturnValueOnce({
      where: () => ({ orderBy: () => ({ limit: () => [request] }) }),
    });
    await expect(reviewerProfileService.getChangeRequestStatus("admin-1")).resolves.toEqual(request);

    mockFrom.mockReturnValueOnce({
      where: async () => [request],
    });
    await expect(reviewerProfileService.listChangeRequests()).resolves.toEqual([request]);
  });
});
