// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.hoisted(() => vi.fn());
const getFlags = vi.hoisted(() => vi.fn(() => ({ disableSignups: true, disableEmailAuth: false })));

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession, verifyApiKey: vi.fn() } },
  verifyOAuthToken: vi.fn(),
}));
vi.mock("../services/flags", () => ({ flagsService: { getFlags } }));

import { callProcedure } from "../call-procedure";
import { flagsRouter } from "./flags";

function call<P extends object>(procedure: P) {
  return callProcedure(procedure, { locale: "en-US", reqHeaders: new Headers() });
}

describe("flagsRouter", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue(null);
    getFlags.mockClear();
  });

  it("returns the instance feature flags without a session", async () => {
    await expect(call(flagsRouter.get)).resolves.toEqual({ disableSignups: true, disableEmailAuth: false });
    expect(getFlags).toHaveBeenCalledOnce();
  });
});
