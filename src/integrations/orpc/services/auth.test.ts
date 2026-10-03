// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const order = vi.hoisted(() => ({ steps: [] as string[] }));
const storageDelete = vi.hoisted(() => vi.fn());
const deleteUser = vi.hoisted(() => vi.fn());

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
});
