// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.hoisted(() => vi.fn());
const getGlobalJobSearchApiKeyForService = vi.hoisted(() => vi.fn());
const jobsService = vi.hoisted(() => ({
  search: vi.fn(),
  deduplicateJobs: vi.fn((jobs: unknown[]) => jobs),
  applyPostFilters: vi.fn((jobs: unknown[]) => jobs),
}));

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession, verifyApiKey: vi.fn() } },
  verifyOAuthToken: vi.fn(),
}));
vi.mock("../services/global-job-search-settings", () => ({ getGlobalJobSearchApiKeyForService }));
vi.mock("../services/jobs", () => ({ jobsService }));

import { jobsRouter } from "./jobs";

const user = { id: "user-1", email: "ada@example.com", name: "Ada", emailVerified: true };
const params = { query: "engineer" };

function call<T>(procedure: { callable: (options: object) => (input?: object) => Promise<T> }, input?: object) {
  return procedure.callable({ context: { locale: "en-US", reqHeaders: new Headers() } })(input);
}

describe("jobsRouter", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ user });
    getGlobalJobSearchApiKeyForService.mockReset();
    jobsService.search.mockReset();
  });

  it("rejects an anonymous search and a missing API key", async () => {
    getSession.mockResolvedValueOnce(null);
    await expect(call(jobsRouter.search, { params })).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    getGlobalJobSearchApiKeyForService.mockResolvedValue(null);
    await expect(call(jobsRouter.getAvailability)).resolves.toEqual({ configured: false });
    await expect(call(jobsRouter.search, { params })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("forwards the search and maps a provider failure", async () => {
    getGlobalJobSearchApiKeyForService.mockResolvedValue("key");
    jobsService.search.mockResolvedValueOnce({ data: [{ id: "job-1" }], rapidApiQuota: undefined });

    await expect(call(jobsRouter.search, { params, filters: { directApplyOnly: true } })).resolves.toEqual({
      data: [{ id: "job-1" }],
      rapidApiQuota: undefined,
    });
    expect(jobsService.search).toHaveBeenCalledWith("key", params);
    expect(jobsService.applyPostFilters).toHaveBeenCalled();

    jobsService.search.mockRejectedValueOnce("nope");
    await expect(call(jobsRouter.search, { params })).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: "Search failed",
    });
  });
});
