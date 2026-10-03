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

import { statisticsRouter } from "./statistics";

function call<T>(procedure: { callable: (options: object) => (input?: object) => Promise<T> }) {
  return procedure.callable({ context: { locale: "en-US", reqHeaders: new Headers() } })();
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
