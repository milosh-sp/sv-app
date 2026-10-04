// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

describe("env", () => {
  afterEach(() => {
    delete process.env.OAUTH_SCOPES;
    vi.resetModules();
  });

  it("splits a custom oauth scope string", async () => {
    process.env.OAUTH_SCOPES = "openid email";
    vi.resetModules();
    const { env } = await import("./env");
    expect(env.OAUTH_SCOPES).toEqual(["openid", "email"]);
  });
});
