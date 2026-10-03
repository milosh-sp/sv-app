// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const queue = vi.hoisted(() => ({ rows: [] as unknown[][] }));
const getSession = vi.hoisted(() => vi.fn());
const getPublicGlobalJobSearchSettings = vi.hoisted(() => vi.fn());
const getGlobalJobSearchSettingsRow = vi.hoisted(() => vi.fn());
const upsertGlobalJobSearchSettings = vi.hoisted(() => vi.fn(async () => undefined));
const testConnection = vi.hoisted(() => vi.fn());

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
vi.mock("../services/global-job-search-settings", () => ({
  getPublicGlobalJobSearchSettings,
  getGlobalJobSearchSettingsRow,
  upsertGlobalJobSearchSettings,
}));
vi.mock("../services/jobs", () => ({ jobsService: { testConnection } }));

import { callProcedure } from "../call-procedure";
import { adminJobSearchRouter } from "./admin-job-search";

const adminId = "00000000-0000-4000-8000-000000000001";

function asAdmin() {
  queue.rows.push([{ role: "skill_verdict_admin" }]);
}

function call<P extends object>(procedure: P, input?: object) {
  return callProcedure(procedure, { locale: "en-US", reqHeaders: new Headers() }, input);
}

describe("adminJobSearchRouter", () => {
  beforeEach(() => {
    queue.rows = [];
    getSession.mockReset();
    getSession.mockResolvedValue({ user: { id: adminId, emailVerified: true } });
    getPublicGlobalJobSearchSettings.mockReset();
    getGlobalJobSearchSettingsRow.mockReset();
    upsertGlobalJobSearchSettings.mockClear();
    testConnection.mockReset();
  });

  it("rejects a non-admin and returns the empty settings shape", async () => {
    await expect(call(adminJobSearchRouter.getSettings)).rejects.toMatchObject({ code: "FORBIDDEN" });

    asAdmin();
    getPublicGlobalJobSearchSettings.mockResolvedValueOnce(null);
    await expect(call(adminJobSearchRouter.getSettings)).resolves.toEqual({
      hasRow: false,
      apiKeySet: false,
      connectionTestOk: false,
    });

    asAdmin();
    getPublicGlobalJobSearchSettings.mockResolvedValueOnce({ apiKeySet: true, connectionTestOk: true });
    await expect(call(adminJobSearchRouter.getSettings)).resolves.toEqual({
      hasRow: true,
      apiKeySet: true,
      connectionTestOk: true,
    });
  });

  it("maps connection failures and saves the acting admin id", async () => {
    asAdmin();
    testConnection.mockRejectedValueOnce("nope");
    await expect(call(adminJobSearchRouter.testConnection, { apiKey: "key" })).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: "Connection test failed",
    });

    asAdmin();
    testConnection.mockRejectedValueOnce(new Error("down"));
    await expect(call(adminJobSearchRouter.testConnection, { apiKey: "key" })).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: "down",
    });

    asAdmin();
    getGlobalJobSearchSettingsRow.mockResolvedValueOnce(null);
    await expect(call(adminJobSearchRouter.testStoredConnection)).rejects.toMatchObject({ code: "BAD_REQUEST" });

    asAdmin();
    getGlobalJobSearchSettingsRow.mockResolvedValueOnce({ apiKey: "stored" });
    testConnection.mockResolvedValueOnce({ success: true });
    await expect(call(adminJobSearchRouter.testStoredConnection)).resolves.toEqual({ success: true });

    asAdmin();
    getGlobalJobSearchSettingsRow.mockResolvedValueOnce(null);
    await expect(call(adminJobSearchRouter.setSettings, { apiKey: " " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    asAdmin();
    getGlobalJobSearchSettingsRow.mockResolvedValueOnce({ apiKey: "stored" });
    testConnection.mockRejectedValueOnce(new Error("down"));
    await expect(call(adminJobSearchRouter.setSettings, { apiKey: "  " })).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: "down",
    });
    expect(upsertGlobalJobSearchSettings).toHaveBeenCalledWith("stored", false, adminId);

    asAdmin();
    getGlobalJobSearchSettingsRow.mockResolvedValueOnce(null);
    testConnection.mockResolvedValueOnce({ success: false });
    await expect(call(adminJobSearchRouter.setSettings, { apiKey: " fresh " })).resolves.toEqual({ testOk: false });
    expect(upsertGlobalJobSearchSettings).toHaveBeenCalledWith("fresh", false, adminId);
  });
});
