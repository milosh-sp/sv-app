// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const order = vi.hoisted(() => ({ steps: [] as string[] }));
const storageDelete = vi.hoisted(() => vi.fn());
const deleteUser = vi.hoisted(() => vi.fn());
const envState = vi.hoisted(() => ({
  GOOGLE_CLIENT_ID: undefined as string | undefined,
  GOOGLE_CLIENT_SECRET: undefined as string | undefined,
  GITHUB_CLIENT_ID: undefined as string | undefined,
  GITHUB_CLIENT_SECRET: undefined as string | undefined,
  OAUTH_CLIENT_ID: undefined as string | undefined,
  OAUTH_CLIENT_SECRET: undefined as string | undefined,
  OAUTH_PROVIDER_NAME: undefined as string | undefined,
}));

vi.mock("@/utils/env", () => ({ env: envState }));

vi.mock("./storage", () => ({
  getStorageService: () => ({ delete: storageDelete }),
}));

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    delete: () => ({
      where: () => deleteUser(),
    }),
  },
}));

import { authService } from "./auth";

describe("authService.deleteAccount", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    order.steps = [];
    storageDelete.mockReset();
    deleteUser.mockReset();
    storageDelete.mockImplementation(async () => {
      order.steps.push("storage");
    });
    deleteUser.mockImplementation(async () => {
      order.steps.push("user");
    });
  });

  it("deletes the user's files before the user row", async () => {
    await authService.deleteAccount({ userId: "user-1" });

    expect(storageDelete).toHaveBeenCalledWith("uploads/user-1");
    expect(order.steps).toEqual(["storage", "user"]);
  });

  it("has already removed files when the user delete fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    deleteUser.mockImplementation(async () => {
      order.steps.push("user");
      throw new Error("db down");
    });

    await expect(authService.deleteAccount({ userId: "user-1" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(order.steps).toEqual(["storage", "user"]);
  });

  it("skips an empty user id and still deletes the user when file cleanup fails", async () => {
    await authService.deleteAccount({ userId: "" });
    expect(storageDelete).not.toHaveBeenCalled();

    storageDelete.mockRejectedValueOnce(new Error("disk"));
    await authService.deleteAccount({ userId: "user-1" });
    expect(order.steps).toEqual(["user"]);
  });
});

describe("authService.providers", () => {
  it("lists password plus whichever social providers are configured", () => {
    expect(authService.providers.list()).toEqual({ credential: "Password" });

    envState.GOOGLE_CLIENT_ID = "g";
    envState.GOOGLE_CLIENT_SECRET = "gs";
    envState.GITHUB_CLIENT_ID = "gh";
    envState.OAUTH_CLIENT_ID = "o";
    envState.OAUTH_CLIENT_SECRET = "os";

    expect(authService.providers.list()).toEqual({
      credential: "Password",
      google: "Google",
      custom: "Custom OAuth",
    });

    envState.GITHUB_CLIENT_SECRET = "ghs";
    envState.OAUTH_PROVIDER_NAME = "Work";

    expect(authService.providers.list()).toMatchObject({ github: "GitHub", custom: "Work" });
  });
});
