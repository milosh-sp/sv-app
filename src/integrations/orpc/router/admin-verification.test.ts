// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const queue = vi.hoisted(() => ({ rows: [] as unknown[][] }));
const getSession = vi.hoisted(() => vi.fn());
const verificationService = vi.hoisted(() => ({
  listQueue: vi.fn(async () => []),
  acceptCase: vi.fn(async () => ({ id: "case" })),
  listMyCases: vi.fn(async () => []),
  listMyCaseHistory: vi.fn(async () => []),
  submitVerdict: vi.fn(async () => ({ ok: true })),
  downloadReviewerDocument: vi.fn(async () => ({
    id: "doc",
    documentType: "payslip",
    contentType: "application/pdf",
    size: 4,
    bytes: new Uint8Array([1]),
  })),
  getDocuments: vi.fn(async () => []),
  downloadDocument: vi.fn(async () => ({
    id: "doc",
    fileUrl: "http://localhost/doc",
    documentType: "payslip",
    contentType: "application/pdf",
    size: 4,
    bytes: new Uint8Array([1]),
  })),
  listExperienceQueue: vi.fn(async () => ({ items: [], total: 0 })),
  listExperienceHistory: vi.fn(async () => ({ items: [], total: 0 })),
  reviewExperience: vi.fn(async () => ({ ok: true })),
  listPendingVerdicts: vi.fn(async () => ({ items: [], total: 0 })),
  confirmVerdict: vi.fn(async () => ({ ok: true })),
  overrideVerdict: vi.fn(async () => ({ ok: true })),
  listVerdictHistory: vi.fn(async () => ({ items: [], total: 0 })),
  overrideConcludedVerdict: vi.fn(async () => ({ ok: true })),
  listIdentityQueue: vi.fn(async () => ({ items: [], total: 0 })),
  listIdentityHistory: vi.fn(async () => ({ items: [], total: 0 })),
  reviewIdentity: vi.fn(async () => ({ ok: true })),
}));

function chain(rows: unknown[]) {
  const self = {
    from: () => self,
    where: () => self,
    limit: () => self,
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
vi.mock("../services/verification", () => ({ verificationService }));

import { adminVerificationRouter } from "./admin-verification";

const adminId = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000010";
const documentId = "00000000-0000-4000-8000-000000000011";

function asRole(role: string) {
  queue.rows.push([{ role }]);
}

function call<T>(
  procedure: { callable: (options: object) => (input?: object) => Promise<T> },
  input?: object,
  cookie?: string,
) {
  const reqHeaders = new Headers();
  if (cookie) reqHeaders.set("cookie", cookie);
  return procedure.callable({ context: { locale: "en-US", reqHeaders } })(input);
}

describe("adminVerificationRouter", () => {
  beforeEach(() => {
    queue.rows = [];
    getSession.mockReset();
    getSession.mockResolvedValue({ user: { id: adminId, emailVerified: true, email: "ada@example.com", name: "Ada" } });
    verificationService.listQueue.mockClear();
    verificationService.reviewIdentity.mockClear();
    verificationService.listExperienceQueue.mockClear();
  });

  it("rejects a signed-in user who is not a reviewer", async () => {
    asRole("company");
    await expect(call(adminVerificationRouter.listQueue)).rejects.toMatchObject({ code: "FORBIDDEN" });

    asRole("reviewer_admin");
    await expect(
      call(adminVerificationRouter.listQueue, undefined, "dashboardMode=user"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("forwards the reviewer id and strips document bytes", async () => {
    asRole("reviewer_admin");
    await expect(call(adminVerificationRouter.listQueue)).resolves.toEqual([]);
    expect(verificationService.listQueue).toHaveBeenCalledWith(adminId);

    asRole("reviewer_admin");
    await call(adminVerificationRouter.acceptCase, {
      requestId,
      file: new File(["x"], "a.pdf"),
      message: "ok",
    });
    expect(verificationService.acceptCase).toHaveBeenCalledWith(expect.objectContaining({ adminId, requestId }));

    asRole("reviewer_admin");
    await call(adminVerificationRouter.submitVerdict, { requestId, verdict: "verified", notes: "matches" });
    expect(verificationService.submitVerdict).toHaveBeenCalledWith(
      expect.objectContaining({ adminId, requestId, verdict: "verified" }),
    );

    asRole("reviewer_admin");
    await expect(
      call(adminVerificationRouter.downloadReviewerDocument, { requestId, documentId }),
    ).resolves.toEqual({
      id: "doc",
      documentType: "payslip",
      contentType: "application/pdf",
      size: 4,
    });
  });

  it("forwards admin list filters and the acting admin id", async () => {
    asRole("skill_verdict_admin");
    await call(adminVerificationRouter.listExperienceQueue, { query: "  Ada  ", page: 2 });
    expect(verificationService.listExperienceQueue).toHaveBeenCalledWith(
      expect.objectContaining({ query: "Ada", page: 2, pageSize: 20 }),
    );

    asRole("skill_verdict_admin");
    await call(adminVerificationRouter.listIdentityHistory, { query: "   " });
    expect(verificationService.listIdentityHistory).toHaveBeenCalledWith(expect.objectContaining({ query: undefined }));

    asRole("skill_verdict_admin");
    await call(adminVerificationRouter.reviewIdentity, { requestId, action: "rejected", notes: "mismatch" });
    expect(verificationService.reviewIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ adminId, requestId, action: "rejected" }),
    );

    asRole("skill_verdict_admin");
    await call(adminVerificationRouter.overrideVerdict, { requestId, action: "issue", reason: "wrong skill" });
    expect(verificationService.overrideVerdict).toHaveBeenCalledWith(
      expect.objectContaining({ adminId, reason: "wrong skill" }),
    );

    asRole("reviewer_admin");
    await expect(call(adminVerificationRouter.confirmVerdict, { requestId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    asRole("skill_verdict_admin");
    await expect(call(adminVerificationRouter.downloadDocument, { documentId })).resolves.toEqual({
      id: "doc",
      fileUrl: "http://localhost/doc",
      documentType: "payslip",
      contentType: "application/pdf",
      size: 4,
    });

    asRole("reviewer_admin");
    await call(adminVerificationRouter.listMyCases);
    expect(verificationService.listMyCases).toHaveBeenCalledWith(adminId);

    asRole("skill_verdict_admin");
    await call(adminVerificationRouter.reviewExperience, { requestId, action: "verified" });
    expect(verificationService.reviewExperience).toHaveBeenCalledWith(expect.objectContaining({ adminId, requestId }));

    asRole("skill_verdict_admin");
    await call(adminVerificationRouter.confirmVerdict, { requestId });
    expect(verificationService.confirmVerdict).toHaveBeenCalledWith({ requestId, adminId });

    asRole("skill_verdict_admin");
    await call(adminVerificationRouter.overrideConcludedVerdict, { requestId, action: "verified", reason: "appeal" });
    expect(verificationService.overrideConcludedVerdict).toHaveBeenCalledWith(
      expect.objectContaining({ adminId, reason: "appeal" }),
    );
  });
});
