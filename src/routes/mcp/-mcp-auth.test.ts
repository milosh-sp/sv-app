// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const verifyOAuthToken = vi.hoisted(() => vi.fn());
const verifyApiKey = vi.hoisted(() => vi.fn());
const connect = vi.hoisted(() => vi.fn());
const handleRequest = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { verifyApiKey } },
  verifyOAuthToken,
  authBaseUrl: "http://localhost:3000",
}));

vi.mock("@/integrations/orpc/client", () => ({
  client: {},
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    connect = connect;
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js", () => ({
  WebStandardStreamableHTTPServerTransport: class {
    handleRequest = handleRequest;
  },
}));

vi.mock("./-helpers/resources", () => ({ registerResources: vi.fn() }));
vi.mock("./-helpers/prompts", () => ({ registerPrompts: vi.fn() }));
vi.mock("./-helpers/tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./-helpers/tools")>();
  return { ...actual, registerTools: vi.fn() };
});

import { errorHint } from "./-helpers/tools";
import { Route, authenticateRequest } from "./index";

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

type Handler = (args: { request: Request }) => Promise<Response>;

function mcpHandler() {
  const handlers = Route.options.server?.handlers as unknown as { ANY?: Handler } | undefined;
  const handler = handlers?.ANY;
  if (!handler) throw new Error("mcp handler missing");
  return handler;
}

describe("mcp route handler", () => {
  beforeEach(() => {
    connect.mockReset();
    connect.mockResolvedValue(undefined);
    handleRequest.mockReset();
    handleRequest.mockResolvedValue(new Response("ok"));
    verifyOAuthToken.mockReset();
    verifyApiKey.mockReset();
  });

  it("serves an authenticated request and rejects a token without a subject", async () => {
    verifyOAuthToken.mockResolvedValueOnce({});
    verifyApiKey.mockResolvedValueOnce({ valid: false });
    const handler = mcpHandler();
    const denied = await handler({
      request: new Request("http://localhost/mcp", {
        headers: { authorization: "Bearer token", "x-api-key": "key" },
      }),
    });
    expect(denied.status).toBe(401);

    verifyOAuthToken.mockResolvedValueOnce({ sub: "user-1" });
    const ok = await handler({
      request: new Request("http://localhost/mcp", { headers: { authorization: "Bearer token" } }),
    });
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("ok");
  });

  it("returns the transport error for an Error and a thrown string", async () => {
    verifyApiKey.mockResolvedValue({ valid: true });
    const handler = mcpHandler();
    connect.mockRejectedValueOnce(new Error("boom"));
    const failed = await handler({
      request: new Request("http://localhost/mcp", { headers: { "x-api-key": "key" } }),
    });
    expect(await failed.json()).toMatchObject({ error: { message: expect.stringContaining("boom") } });

    connect.mockRejectedValueOnce("nope");
    const plain = await handler({
      request: new Request("http://localhost/mcp", { headers: { "x-api-key": "key" } }),
    });
    expect(await plain.json()).toMatchObject({ error: { message: expect.stringContaining("nope") } });
  });
});
