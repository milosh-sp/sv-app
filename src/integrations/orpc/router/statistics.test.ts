// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const statisticsService = vi.hoisted(() => ({
  user: { getCount: vi.fn(async () => 4) },
  resume: { getCount: vi.fn(async () => 9) },
}));

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession: vi.fn(), verifyApiKey: vi.fn() } },
  verifyOAuthToken: vi.fn(),
}));
vi.mock("../services/statistics", () => ({ statisticsService }));

import { callProcedure } from "../call-procedure";
import { statisticsRouter } from "./statistics";

function call<P extends object>(procedure: P) {
  return callProcedure(procedure, { locale: "en-US", reqHeaders: new Headers() });
}

describe("statisticsRouter", () => {
  beforeEach(() => {
    statisticsService.user.getCount.mockClear();
    statisticsService.resume.getCount.mockClear();
  });

  it("returns public user and resume counts", async () => {
    await expect(call(statisticsRouter.user.getCount)).resolves.toBe(4);
    await expect(call(statisticsRouter.resume.getCount)).resolves.toBe(9);
    expect(statisticsService.user.getCount).toHaveBeenCalledOnce();
    expect(statisticsService.resume.getCount).toHaveBeenCalledOnce();
  });
});
