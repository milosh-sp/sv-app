// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const queue = vi.hoisted(() => ({ rows: [] as unknown[][] }));
const getSession = vi.hoisted(() => vi.fn());
const reviewerProfileService = vi.hoisted(() => ({
  create: vi.fn(async () => ({ id: "profile" })),
  updateDirect: vi.fn(async () => ({ id: "profile" })),
  getByAdminIdOrNull: vi.fn(async () => null),
  list: vi.fn(async () => []),
  listChangeRequests: vi.fn(async () => []),
  resolveChangeRequest: vi.fn(async () => ({ ok: true })),
  getByAdminId: vi.fn(async () => ({ id: "profile" })),
  giveConsent: vi.fn(async () => ({ ok: true })),
  requestChange: vi.fn(async () => ({ id: "change" })),
  getChangeRequestStatus: vi.fn(async () => null),
  getPublicProfile: vi.fn(async () => ({ firstName: "Ada" })),
}));

function chain(rows: unknown[]) {
  const self = {
    from: () => self,
    where: () => self,
    limit: () => self,
    // oxlint-disable-next-line unicorn/no-thenable -- drizzle query mocks are thenable on purpose
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
      Promise.resolve(rows).then(onFulfilled, onRejected),
  };
  return self;
}

vi.mock("@/integrations/drizzle/client", () => ({
  db: { select: () => chain(queue.rows.shift() ?? []) },
}));
vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession, verifyApiKey: vi.fn() } },
  verifyOAuthToken: vi.fn(),
}));
vi.mock("../services/reviewer-profile", () => ({ reviewerProfileService }));

import { callProcedure } from "../call-procedure";
import { adminReviewerProfilesRouter, publicReviewerProfileRouter, reviewerProfileRouter } from "./reviewer-profile";

const adminId = "00000000-0000-4000-8000-000000000001";
const reviewerId = "00000000-0000-4000-8000-000000000002";

function call<P extends object>(procedure: P, input?: object, cookie?: string) {
  const reqHeaders = new Headers();
  if (cookie) reqHeaders.set("cookie", cookie);
  return callProcedure(procedure, { locale: "en-US", reqHeaders }, input);
}

describe("reviewer profile routers", () => {
  beforeEach(() => {
    queue.rows = [];
    getSession.mockReset();
    getSession.mockResolvedValue({
      user: { id: adminId, emailVerified: true, email: "ada@example.com", name: "Ada" },
    });
    reviewerProfileService.resolveChangeRequest.mockClear();
    reviewerProfileService.getByAdminId.mockClear();
    reviewerProfileService.getPublicProfile.mockClear();
  });

  it("rejects the wrong role and a reviewer who is in user mode", async () => {
    queue.rows.push([{ role: "reviewer_admin" }]);
    await expect(
      call(adminReviewerProfilesRouter.create, {
        adminId: reviewerId,
        firstName: "Ada",
        lastName: "Lovelace",
        title: "Reviewer",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    queue.rows.push([{ role: "reviewer_admin" }]);
    await expect(call(reviewerProfileRouter.get, undefined, "dashboardMode=user")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("forwards the acting admin and the public profile id", async () => {
    queue.rows.push([{ role: "skill_verdict_admin" }]);
    await call(adminReviewerProfilesRouter.resolveChangeRequest, {
      requestId: "00000000-0000-4000-8000-000000000030",
      action: "rejected",
      rejectionReason: "incomplete",
    });
    expect(reviewerProfileService.resolveChangeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ resolvedByAdminId: adminId, action: "rejected" }),
    );

    queue.rows.push([{ role: "reviewer_admin" }]);
    await expect(call(reviewerProfileRouter.get)).resolves.toEqual({ id: "profile" });
    expect(reviewerProfileService.getByAdminId).toHaveBeenCalledWith(adminId);

    queue.rows.push([{ role: "reviewer_admin" }]);
    await call(reviewerProfileRouter.requestChange, { firstName: "Augusta" });
    expect(reviewerProfileService.requestChange).toHaveBeenCalledWith({ adminId, firstName: "Augusta" });

    getSession.mockResolvedValue(null);
    await call(publicReviewerProfileRouter.get, { adminId: reviewerId });
    expect(reviewerProfileService.getPublicProfile).toHaveBeenCalledWith(reviewerId);
  });
});
