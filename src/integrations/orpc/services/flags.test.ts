// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

describe("flagsService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("follows the signup and email auth flags", async () => {
    vi.resetModules();
    vi.stubEnv("FLAG_DISABLE_SIGNUPS", "true");
    vi.stubEnv("FLAG_DISABLE_EMAIL_AUTH", "false");

    const { flagsService } = await import("./flags");

    expect(flagsService.getFlags()).toEqual({
      disableSignups: true,
      disableEmailAuth: false,
    });
  });
});
