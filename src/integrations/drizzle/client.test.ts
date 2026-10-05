// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("pg", () => ({
  Pool: vi.fn(function Pool() {
    return { end: vi.fn() };
  }),
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn(() => ({ kind: "drizzle" })),
}));

describe("database client", () => {
  beforeEach(() => {
    vi.resetModules();
    delete globalThis.__pool;
    delete globalThis.__drizzle;
  });

  it("reuses an existing pool and an existing drizzle client", async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");

    globalThis.__pool = { end: vi.fn() } as never;
    await import("./client");
    expect(Pool).not.toHaveBeenCalled();
    expect(drizzle).toHaveBeenCalledOnce();

    vi.resetModules();
    await import("./client");
    expect(drizzle).toHaveBeenCalledOnce();
  });
});
