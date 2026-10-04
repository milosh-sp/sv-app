// @vitest-environment node
import { AISDKError } from "ai";
import { OllamaError } from "ai-sdk-ollama";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const queue = vi.hoisted(() => ({ rows: [] as unknown[][] }));
const getSession = vi.hoisted(() => vi.fn());
const getPublicGlobalAiSettings = vi.hoisted(() => vi.fn());
const getGlobalAiSettingsRow = vi.hoisted(() => vi.fn());
const upsertGlobalAiSettings = vi.hoisted(() => vi.fn(async () => undefined));
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
vi.mock("../services/global-ai-settings", () => ({
  getPublicGlobalAiSettings,
  getGlobalAiSettingsRow,
  upsertGlobalAiSettings,
}));
vi.mock("../services/ai", async () => {
  const actual = await vi.importActual<typeof AiService>("../services/ai");
  return { ...actual, aiService: { testConnection } };
});

import type * as AiService from "../services/ai";

import { callProcedure } from "../call-procedure";
import { adminAiRouter } from "./admin-ai";

const adminId = "00000000-0000-4000-8000-000000000001";
const creds = { provider: "openai" as const, model: "gpt-test", apiKey: "key", baseURL: "" };

function asAdmin() {
  queue.rows.push([{ role: "skill_verdict_admin" }]);
}

function call<P extends object>(procedure: P, input?: object) {
  return callProcedure(procedure, { locale: "en-US", reqHeaders: new Headers() }, input);
}

describe("adminAiRouter", () => {
  beforeEach(() => {
    queue.rows = [];
    getSession.mockReset();
    getSession.mockResolvedValue({ user: { id: adminId, emailVerified: true } });
    getPublicGlobalAiSettings.mockReset();
    getGlobalAiSettingsRow.mockReset();
    upsertGlobalAiSettings.mockClear();
    testConnection.mockReset();
  });

  it("rejects a non-admin and returns the empty settings shape", async () => {
    await expect(call(adminAiRouter.getSettings)).rejects.toMatchObject({ code: "FORBIDDEN" });

    asAdmin();
    getPublicGlobalAiSettings.mockResolvedValueOnce(null);
    await expect(call(adminAiRouter.getSettings)).resolves.toEqual({
      hasRow: false,
      provider: "openai",
      model: "",
      baseURL: "",
      apiKeySet: false,
      connectionTestOk: false,
    });

    asAdmin();
    getPublicGlobalAiSettings.mockResolvedValueOnce({
      provider: "anthropic",
      model: "claude",
      baseURL: "",
      apiKeySet: true,
      connectionTestOk: true,
    });
    await expect(call(adminAiRouter.getSettings)).resolves.toMatchObject({ hasRow: true, provider: "anthropic" });
  });

  it("maps a provider failure and keeps a blank key from the saved row", async () => {
    asAdmin();
    testConnection.mockRejectedValueOnce(new AISDKError({ name: "AI_APICallError", message: "down" }));
    await expect(call(adminAiRouter.testConnection, creds)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: "down",
    });

    asAdmin();
    testConnection.mockRejectedValueOnce(new Error("unexpected"));
    await expect(call(adminAiRouter.testConnection, creds)).rejects.toThrow("unexpected");

    asAdmin();
    getGlobalAiSettingsRow.mockResolvedValueOnce(null);
    await expect(call(adminAiRouter.testStoredConnection)).rejects.toMatchObject({ code: "BAD_REQUEST" });

    asAdmin();
    getGlobalAiSettingsRow.mockResolvedValueOnce({
      provider: "nope",
      model: "m",
      apiKey: "stored",
      baseURL: "http://local",
    });
    testConnection.mockRejectedValueOnce(new OllamaError({ message: "offline" }));
    await expect(call(adminAiRouter.testStoredConnection)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(testConnection).toHaveBeenLastCalledWith({
      provider: "openai",
      model: "m",
      apiKey: "stored",
      baseURL: "http://local",
    });

    asAdmin();
    getGlobalAiSettingsRow.mockResolvedValueOnce({ apiKey: "stored" });
    testConnection.mockResolvedValueOnce(true);
    await expect(call(adminAiRouter.setSettings, { ...creds, apiKey: "  " })).resolves.toEqual({ testOk: true });
    expect(upsertGlobalAiSettings).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "stored" }), true, adminId);

    asAdmin();
    getGlobalAiSettingsRow.mockResolvedValueOnce(null);
    await expect(call(adminAiRouter.setSettings, { ...creds, apiKey: " " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    asAdmin();
    getGlobalAiSettingsRow.mockResolvedValueOnce(null);
    testConnection.mockRejectedValueOnce(new AISDKError({ name: "AI_APICallError", message: "down" }));
    await expect(call(adminAiRouter.setSettings, creds)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(upsertGlobalAiSettings).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "key" }), false, adminId);
  });
});
