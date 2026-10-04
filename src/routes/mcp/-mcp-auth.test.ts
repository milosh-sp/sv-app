// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const verifyOAuthToken = vi.hoisted(() => vi.fn());
const verifyApiKey = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { verifyApiKey } },
  verifyOAuthToken,
  authBaseUrl: "http://localhost:3000",
}));

vi.mock("@/integrations/orpc/client", () => ({
  client: {},
}));

import { errorHint } from "./-helpers/tools";
import { authenticateRequest } from "./index";

describe("authenticateRequest", () => {
  beforeEach(() => {
    verifyOAuthToken.mockReset();
    verifyApiKey.mockReset();
  });

  it("accepts a valid bearer token", async () => {
    verifyOAuthToken.mockResolvedValue({ sub: "user-1" });

    await expect(
      authenticateRequest(new Request("http://localhost/mcp", { headers: { authorization: "Bearer token" } })),
    ).resolves.toBeUndefined();
    expect(verifyApiKey).not.toHaveBeenCalled();
  });

  it("falls through an invalid bearer token to a valid API key", async () => {
    verifyOAuthToken.mockRejectedValue(new Error("expired"));
    verifyApiKey.mockResolvedValue({ valid: true });

    await expect(
      authenticateRequest(
        new Request("http://localhost/mcp", {
          headers: { authorization: "Bearer expired", "x-api-key": "key-1" },
        }),
      ),
    ).resolves.toBeUndefined();
    expect(verifyApiKey).toHaveBeenCalledWith({ body: { key: "key-1" } });
  });

  it("rejects a request with neither credential", async () => {
    await expect(authenticateRequest(new Request("http://localhost/mcp"))).rejects.toThrow("Unauthorized");
  });
});

describe("errorHint", () => {
  it("adds a hint for slug, lock, and status errors", () => {
    expect(errorHint(new Error("slug already exists"))).toContain("slug is already in use");
    expect(errorHint(new Error("resume is locked"))).toContain("unlock_resume");
    expect(errorHint(new Error("404 not found"))).toContain("list_resumes");
    expect(errorHint(new Error("400 bad request"))).toContain("Invalid request");
    expect(errorHint(new Error("403 forbidden"))).toContain("Permission denied");
  });

  it("adds no hint for an unknown error", () => {
    expect(errorHint(new Error("boom"))).toBe("");
  });
});
