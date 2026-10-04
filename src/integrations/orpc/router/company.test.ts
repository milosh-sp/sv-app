// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.hoisted(() => vi.fn());
const roleRows = vi.hoisted(() => ({ value: [] as unknown[] }));
const companyService = vi.hoisted(() => ({
  matchCandidates: vi.fn(async () => []),
  listSaved: vi.fn(async () => []),
  setSaved: vi.fn(async () => ({ ok: true as const })),
  createContactRequest: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000010", status: "pending" as const })),
  listContactRequests: vi.fn(async () => []),
  listMyContactRequests: vi.fn(async () => []),
  respondToContactRequest: vi.fn(async () => ({
    id: "00000000-0000-4000-8000-000000000010",
    status: "accepted" as const,
  })),
}));

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession, verifyApiKey: vi.fn() } },
  verifyOAuthToken: vi.fn(),
}));
vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => roleRows.value,
        }),
      }),
    }),
  },
}));
vi.mock("../services/company", () => ({ companyService }));

import { callProcedure } from "../call-procedure";
import { companyRouter } from "./company";

const user = { id: "user-1", email: "ada@example.com", name: "Ada", emailVerified: true };
const candidateUserId = "00000000-0000-4000-8000-000000000002";

function call<P extends object>(procedure: P, input?: object) {
  return callProcedure(procedure, { locale: "en-US", reqHeaders: new Headers() }, input);
}

describe("companyRouter", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ user });
    roleRows.value = [{ role: "company" }];
    companyService.matchCandidates.mockClear();
    companyService.respondToContactRequest.mockClear();
  });

  it("rejects a signed-in user who is not a company", async () => {
    roleRows.value = [];
    await expect(
      call(companyRouter.matchCandidates, { jobDescription: "Build compilers and tools." }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("forwards the company id and the candidate's response", async () => {
    await expect(
      call(companyRouter.matchCandidates, { jobDescription: "Build compilers and tools." }),
    ).resolves.toEqual([]);
    expect(companyService.matchCandidates).toHaveBeenCalledWith("user-1", expect.any(Object));

    await call(companyRouter.respondToContactRequest, {
      id: "00000000-0000-4000-8000-000000000010",
      decision: "accepted",
    });
    expect(companyService.respondToContactRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateUserId: "user-1",
        candidateName: "Ada",
        candidateEmail: "ada@example.com",
        decision: "accepted",
      }),
    );

    await call(companyRouter.setSaved, { candidateUserId, listType: "favorite", saved: true });
    expect(companyService.setSaved).toHaveBeenCalledWith(expect.objectContaining({ companyUserId: "user-1" }));

    await call(companyRouter.listSaved, {});
    await call(companyRouter.createContactRequest, { candidateUserId });
    await call(companyRouter.listContactRequests, {});
    roleRows.value = [];
    getSession.mockResolvedValue({ user });
    await call(companyRouter.listMyContactRequests, {});
    expect(companyService.listSaved).toHaveBeenCalled();
    expect(companyService.createContactRequest).toHaveBeenCalledWith(
      expect.objectContaining({ companyUserId: "user-1", companyName: "Ada", candidateUserId }),
    );
    expect(companyService.listMyContactRequests).toHaveBeenCalledWith("user-1", expect.any(Object));
  });
});
