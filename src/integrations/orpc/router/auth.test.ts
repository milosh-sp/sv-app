// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.hoisted(() => vi.fn());
const roleRows = vi.hoisted(() => ({ value: [] as unknown[] }));
const deleteAccount = vi.hoisted(() => vi.fn(async () => undefined));

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
vi.mock("../services/auth", () => ({
  authService: {
    providers: { list: () => ({ credential: "Password" }) },
    deleteAccount,
  },
}));

import { authRouter } from "./auth";

const user = { id: "user-1", email: "ada@example.com", name: "Ada", emailVerified: true };

function call<T>(procedure: { callable: (options: object) => (input?: object) => Promise<T> }, input?: object) {
  return procedure.callable({ context: { locale: "en-US", reqHeaders: new Headers() } })(input);
}

describe("authRouter", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ user });
    roleRows.value = [];
    deleteAccount.mockClear();
  });

  it("lists providers without a session and gates account deletion", async () => {
    getSession.mockResolvedValue(null);
    await expect(call(authRouter.providers.list)).resolves.toEqual({ credential: "Password" });
    await expect(call(authRouter.deleteAccount)).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    getSession.mockResolvedValue({ user });
    roleRows.value = [{ role: "company" }];
    await expect(call(authRouter.getAdminRole)).resolves.toEqual({ role: "company" });

    roleRows.value = [];
    await expect(call(authRouter.getAdminRole)).resolves.toEqual({ role: null });
    await call(authRouter.deleteAccount);
    expect(deleteAccount).toHaveBeenCalledWith({ userId: "user-1" });
  });
});
