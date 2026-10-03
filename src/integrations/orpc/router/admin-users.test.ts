// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const queue = vi.hoisted(() => ({ rows: [] as unknown[][] }));
const getSession = vi.hoisted(() => vi.fn());

function chain(rows: unknown[]) {
  const self = {
    from: () => self,
    leftJoin: () => self,
    innerJoin: () => self,
    where: () => self,
    orderBy: () => self,
    limit: () => self,
    offset: () => self,
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
      Promise.resolve(rows).then(onFulfilled, onRejected),
  };
  return self;
}

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: () => chain(queue.rows.shift() ?? []),
    insert: () => ({
      values: () => ({ onConflictDoUpdate: async () => undefined }),
    }),
    delete: () => ({ where: async () => undefined }),
  },
}));

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession, verifyApiKey: vi.fn() } },
  verifyOAuthToken: vi.fn(),
}));

import { defaultWorkAuthorizationData } from "@/schema/resume/data";

import { adminUsersRouter } from "./admin-users";

const adminId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const locale = "en-US" as const;

function asAdmin() {
  queue.rows.push([{ role: "skill_verdict_admin" }]);
}

function call<T>(procedure: { callable: (options: object) => (input?: object) => Promise<T> }, input?: object) {
  return procedure.callable({ context: { locale, reqHeaders: new Headers() } })(input);
}

describe("adminUsersRouter", () => {
  beforeEach(() => {
    queue.rows = [];
    getSession.mockReset();
    getSession.mockResolvedValue({ user: { id: adminId, emailVerified: true } });
  });

  it("lists users by search text and role", async () => {
    asAdmin();
    queue.rows.push([{ total: 2 }], [{ id: userId, name: "Ada" }]);
    await expect(
      call(adminUsersRouter.listUsers, { page: 2, pageSize: 10, query: "ada", roleFilter: "user" }),
    ).resolves.toMatchObject({
      total: 2,
      page: 2,
      users: [{ name: "Ada" }],
    });

    asAdmin();
    queue.rows.push([], []);
    await expect(call(adminUsersRouter.listUsers, { query: "  ", roleFilter: "all" })).resolves.toMatchObject({
      total: 0,
    });

    asAdmin();
    queue.rows.push([{ total: 1 }], []);
    await expect(call(adminUsersRouter.listUsers, { roleFilter: "reviewer_admin" })).resolves.toMatchObject({
      total: 1,
    });
  });

  it("refuses to remove the last skill verdict admin and updates every other role", async () => {
    asAdmin();
    queue.rows.push([]);
    await expect(call(adminUsersRouter.setUserAdminRole, { userId, role: null })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    asAdmin();
    queue.rows.push([{ id: adminId }], []);
    await expect(call(adminUsersRouter.setUserAdminRole, { userId: adminId, role: null })).rejects.toMatchObject({
      message: "Assign another Skill Verdict Admin before changing your own role.",
    });

    asAdmin();
    queue.rows.push([{ id: adminId }], [{ userId }]);
    await expect(call(adminUsersRouter.setUserAdminRole, { userId: adminId, role: "reviewer_admin" })).resolves.toEqual(
      {
        ok: true,
      },
    );

    asAdmin();
    queue.rows.push([{ id: userId }]);
    await expect(call(adminUsersRouter.setUserAdminRole, { userId, role: "company" })).resolves.toEqual({ ok: true });
  });

  it("aggregates the latest resume, verification, and api key activity", async () => {
    const resumes = Array.from({ length: 9 }, (_, index) => ({
      id: `resume-${index}`,
      name: `Resume ${index}`,
      slug: `resume-${index}`,
      isPublic: index % 2 === 0,
      isLocked: index % 3 === 0,
      updatedAt: new Date(Date.UTC(2020, 0, index + 1)),
      workAuthorization: index === 8 ? defaultWorkAuthorizationData : { broken: true },
    }));
    const verification = [
      ...["pending", "claimed", "verdict_pending", "rejected", "issue"].map((status, index) => ({
        id: `status-${index}`,
        sectionType: "skill",
        itemLabel: status,
        status,
        method: "skill",
        reviewerNote: "",
        submittedAt: new Date(Date.UTC(2024, 0, index + 1)),
        resolvedAt: index === 3 ? new Date(Date.UTC(2024, 1, 1)) : null,
      })),
      ...Array.from({ length: 7 }, (_, index) => ({
        id: `experience-${index}`,
        sectionType: "experience",
        itemLabel: `Role ${index}`,
        status: "verified",
        method: "document_upload",
        reviewerNote: "ok",
        submittedAt: new Date(Date.UTC(2023, 0, index + 1)),
        resolvedAt: new Date(Date.UTC(2023, 1, index + 1)),
      })),
      {
        id: "identity-1",
        sectionType: "identity",
        itemLabel: "Ada",
        status: "verified",
        method: "document_upload",
        reviewerNote: "ok",
        submittedAt: new Date(Date.UTC(2022, 0, 1)),
        resolvedAt: new Date(Date.UTC(2022, 1, 1)),
      },
    ];
    const documents = [
      ...Array.from({ length: 11 }, (_, index) => ({
        verificationRequestId: "identity-1",
        fileUrl: `uploads/doc-${index}`,
        documentType: "payslip" as const,
        uploadedAt: new Date(Date.UTC(2024, 2, index + 1)),
      })),
      {
        verificationRequestId: "missing",
        fileUrl: "uploads/orphan",
        documentType: "contract" as const,
        uploadedAt: new Date(Date.UTC(2024, 3, 1)),
      },
    ];

    asAdmin();
    queue.rows.push(
      [{ id: userId, name: "Ada", email: "ada@example.com" }],
      [{ total: 4 }],
      [{ total: 1 }],
      [{ id: "session-1" }],
      [{ providerId: "credential" }, { providerId: "credential" }],
      resumes,
      [
        { views: 3, downloads: 1, lastViewedAt: null, lastDownloadedAt: null },
        {
          views: 2,
          downloads: 4,
          lastViewedAt: new Date(Date.UTC(2024, 5, 1)),
          lastDownloadedAt: new Date(Date.UTC(2024, 5, 2)),
        },
      ],
      verification,
      [
        { enabled: true, requestCount: 3, lastRequest: new Date(Date.UTC(2024, 4, 1)) },
        { enabled: false, requestCount: 1, lastRequest: null },
      ],
      documents,
    );

    const overview = await call(adminUsersRouter.getUserOverview, { userId });
    expect(overview.resumes).toMatchObject({ total: 9, hiddenCount: 1, totalViews: 5, totalDownloads: 5 });
    expect(overview.resumes.items).toHaveLength(8);
    expect(overview.workAuthorization).toEqual(defaultWorkAuthorizationData);
    expect(overview.authProviders.providerIds).toEqual(["credential"]);
    expect(overview.verification).toMatchObject({
      pending: 1,
      claimed: 1,
      verdictPending: 1,
      verified: 8,
      rejected: 1,
      issue: 1,
    });
    expect(overview.verification.approvedExperience.hiddenCount).toBe(1);
    expect(overview.verification.approvedIdentity?.documents).toHaveLength(11);
    expect(overview.verification.uploadedDocuments).toMatchObject({ hiddenCount: 1 });
    expect(overview.apiKeys).toMatchObject({ total: 2, enabled: 1, totalRequestCount: 4 });

    asAdmin();
    queue.rows.push(
      [{ id: userId }],
      [{}],
      [{}],
      [],
      [],
      [{ ...resumes[0], updatedAt: new Date(Date.UTC(2024, 0, 1)), workAuthorization: { broken: true } }],
      [],
      [],
      [],
    );
    const fallback = await call(adminUsersRouter.getUserOverview, { userId });
    expect(fallback.workAuthorization).toEqual(defaultWorkAuthorizationData);
    expect(fallback.sessions.total).toBe(0);
    expect(fallback.verification.approvedIdentity).toBeNull();

    asAdmin();
    queue.rows.push([]);
    await expect(call(adminUsersRouter.getUserOverview, { userId })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
