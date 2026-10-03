// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const rows = vi.hoisted(() => ({ queue: [] as unknown[][] }));
const getSession = vi.hoisted(() => vi.fn());
const verifyApiKey = vi.hoisted(() => vi.fn());
const verifyOAuthToken = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(rows.queue.shift() ?? []),
        }),
      }),
    }),
  },
}));

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession, verifyApiKey } },
  verifyOAuthToken,
}));

import { companyProcedure, protectedProcedure, reviewerAdminProcedure, serverOnlyProcedure } from "./context";

const locale = "en-US" as const;

function call<T>(procedure: { handler: (fn: () => T) => { callable: (options: object) => () => Promise<T> } }, context: object) {
  return procedure.handler(() => "ok" as T).callable({ context })();
}

describe("oRPC auth procedures", () => {
  beforeEach(() => {
    rows.queue = [];
    getSession.mockReset();
    getSession.mockResolvedValue(null);
    verifyApiKey.mockReset();
    verifyOAuthToken.mockReset();
  });

  it("rejects a request with no user", async () => {
    await expect(call(protectedProcedure, { locale, reqHeaders: new Headers() })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects an unverified session and allows an unverified API key", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1", emailVerified: false } });

    await expect(call(protectedProcedure, { locale, reqHeaders: new Headers() })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Please verify your email address before continuing.",
    });

    verifyApiKey.mockResolvedValue({ valid: true, key: { referenceId: "user-1" } });
    rows.queue.push([{ id: "user-1", emailVerified: false }]);

    await expect(
      call(protectedProcedure, { locale, reqHeaders: new Headers({ "x-api-key": "key-1" }) }),
    ).resolves.toBe("ok");
  });

  it("blocks reviewer actions in user mode and allows reviewer mode", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1", emailVerified: true } });
    rows.queue.push([{ role: "reviewer_admin" }]);

    await expect(
      call(reviewerAdminProcedure, {
        locale,
        reqHeaders: new Headers({ cookie: "dashboardMode=user" }),
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Reviewer actions are unavailable while in User Mode. Switch to Reviewer Mode to continue.",
    });

    rows.queue.push([{ role: "reviewer_admin" }]);
    await expect(
      call(reviewerAdminProcedure, {
        locale,
        reqHeaders: new Headers({ cookie: "dashboardMode=reviewer" }),
      }),
    ).resolves.toBe("ok");
  });

  it("requires the company role", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1", emailVerified: true } });
    rows.queue.push([{ role: "skill_verdict_admin" }]);

    await expect(call(companyProcedure, { locale, reqHeaders: new Headers() })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    rows.queue.push([{ role: "company" }]);
    await expect(call(companyProcedure, { locale, reqHeaders: new Headers() })).resolves.toBe("ok");
  });

  it("rejects a forged server header and accepts an in-process call", async () => {
    await expect(
      call(serverOnlyProcedure, {
        locale,
        reqHeaders: new Headers({ "x-server-side-call": "true" }),
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    await expect(call(serverOnlyProcedure, { locale, internalCall: true })).resolves.toBe("ok");
  });
});
