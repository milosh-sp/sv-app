// @vitest-environment node
import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.hoisted(() => vi.fn());
const authHandler = vi.hoisted(() => vi.fn(async () => new Response("auth")));
const generateOpenAPISchema = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
const getProtectedResourceMetadata = vi.hoisted(() => vi.fn(async () => ({ resource: "http://localhost:3000" })));
const limit = vi.hoisted(() => vi.fn());
const downloadReviewerDocument = vi.hoisted(() => vi.fn());
const openApiHandle = vi.hoisted(() => vi.fn());
const rpcHandle = vi.hoisted(() => vi.fn());
const generateSpec = vi.hoisted(() => vi.fn());
const errorHooks = vi.hoisted(() => [] as Array<(error: unknown) => void>);

vi.mock("@/integrations/auth/config", () => ({
  auth: { handler: authHandler, api: { getSession, generateOpenAPISchema } },
  authBaseUrl: "http://localhost:3000",
}));

vi.mock("@/integrations/auth/client", () => ({
  authClient: { getProtectedResourceMetadata },
}));

vi.mock("@better-auth/oauth-provider", () => ({
  oauthProviderAuthServerMetadata: () => (request: Request) => Response.json({ kind: "auth-server", url: request.url }),
  oauthProviderOpenIdConfigMetadata: () => (request: Request) => Response.json({ kind: "oidc", url: request.url }),
}));

vi.mock("@/integrations/drizzle/client", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit }) }) }) },
}));

vi.mock("@/integrations/orpc/services/verification", () => ({
  verificationService: { downloadReviewerDocument },
}));

vi.mock("@/integrations/orpc/router", () => ({ default: { id: "router" } }));

vi.mock("@/utils/locale", () => ({
  getLocale: async () => "en-US",
}));

vi.mock("@orpc/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@orpc/server")>();
  return {
    ...actual,
    onError: (fn: (error: unknown) => void) => {
      errorHooks.push(fn);
      return actual.onError(fn);
    },
  };
});

vi.mock("@orpc/openapi", () => ({
  OpenAPIGenerator: class {
    generate = generateSpec;
  },
}));

vi.mock("@orpc/openapi/fetch", () => ({
  OpenAPIHandler: class {
    handle = openApiHandle;
  },
}));

vi.mock("@orpc/server/fetch", () => ({
  RPCHandler: class {
    handle = rpcHandle;
  },
}));

import { Route as AuthServerRoute } from "../[.]well-known/oauth-authorization-server";
import { Route as AuthServerSplatRoute } from "../[.]well-known/oauth-authorization-server.$";
import { Route as ProtectedRoute } from "../[.]well-known/oauth-protected-resource";
import { Route as ProtectedSplatRoute } from "../[.]well-known/oauth-protected-resource.$";
import { Route as OpenIdRoute } from "../[.]well-known/openid-configuration";
import { Route as SchemaRoute } from "../schema[.]json";
import { Route as AuthRoute } from "./auth.$";
import { Route as OpenApiRoute } from "./openapi.$";
import { Route as ReviewerDocumentRoute } from "./reviewer/documents/$requestId.$documentId";
import { Route as RpcRoute } from "./rpc.$";

type RequestHandler = (args: { request: Request; params?: Record<string, string> }) => Promise<Response>;

function lastAuthRequest() {
  const calls = authHandler.mock.calls as unknown as Array<[Request]>;
  const request = calls.at(-1)?.[0];
  if (!request) throw new Error("auth handler was not called");
  return request;
}

function handlerOf(route: object, method: string) {
  const handler = (route as { options: { server?: { handlers?: Record<string, RequestHandler> } } }).options.server
    ?.handlers?.[method];
  if (!handler) throw new Error(`${method} handler missing`);
  return handler;
}

describe("auth catch-all", () => {
  beforeEach(() => {
    authHandler.mockClear();
    authHandler.mockResolvedValue(new Response("auth"));
    generateOpenAPISchema.mockClear();
  });

  it("sanitizes authorize queries and registers public clients", async () => {
    const handle = handlerOf(AuthRoute, "POST");
    const get = handlerOf(AuthRoute, "GET");

    await get({ request: new Request("http://localhost:3000/api/auth/ok") });
    expect(authHandler).toHaveBeenCalled();

    const dirty = new Request(
      "http://localhost:3000/api/auth/oauth2/authorize?prompt=login%0Aconsent&redirect_uri=https%253A%252F%252Fapp.example%252Fcb&client_id=%20app%20",
    );
    await get({ request: dirty });
    const sanitized = lastAuthRequest();
    const sanitizedUrl = new URL(sanitized.url);
    expect(sanitizedUrl.searchParams.get("prompt")).toBe("login consent");
    expect(sanitizedUrl.searchParams.get("redirect_uri")).toBe("https://app.example/cb");

    await get({
      request: new Request(
        "http://localhost:3000/api/auth/oauth2/authorize?redirect_uri=https://app.example/cb&prompt=login",
      ),
    });
    await get({
      request: new Request("http://localhost:3000/api/auth/oauth2/authorize?redirect_uri=%E0%A4%A"),
    });
    await get({
      request: new Request("http://localhost:3000/api/auth/oauth2/authorize?redirect_uri=not-a-url"),
    });

    const spec = await get({ request: new Request("http://localhost:3000/api/auth/spec.json") });
    expect(spec.headers.get("content-type")).toContain("application/json");
    expect(generateOpenAPISchema).toHaveBeenCalled();

    await handle({ request: new Request("http://localhost:3000/api/auth/sign-in", { method: "POST" }) });

    const badJson = await handle({
      request: new Request("http://localhost:3000/api/auth/oauth2/register", {
        method: "POST",
        body: "not-json",
      }),
    });
    expect(badJson.status).toBe(200);

    const registered = new Request("http://localhost:3000/api/auth/oauth2/register", {
      method: "POST",
      body: JSON.stringify({ token_endpoint_auth_method: "client_secret_post" }),
    });
    await handle({ request: registered });
    const publicBody = await lastAuthRequest().json();
    expect(publicBody.token_endpoint_auth_method).toBe("none");

    const secret = new Request("http://localhost:3000/api/auth/oauth2/register", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({ token_endpoint_auth_method: "client_secret_post" }),
    });
    await handle({ request: secret });
    const secretBody = await lastAuthRequest().json();
    expect(secretBody.token_endpoint_auth_method).toBe("client_secret_post");
  });
});

describe("openapi and rpc", () => {
  beforeEach(() => {
    generateSpec.mockReset();
    generateSpec.mockImplementation(async (_router: unknown, spec: { filter: (input: unknown) => boolean }) => {
      spec.filter({ contract: { "~orpc": { route: { tags: ["Internal"] } } } });
      spec.filter({ contract: { "~orpc": { route: { tags: ["Public"] } } } });
      spec.filter({ contract: { "~orpc": { route: {} } } });
      return { openapi: "3.1.0" };
    });
    openApiHandle.mockReset();
    rpcHandle.mockReset();
  });

  it("serves a spec, a proxied response, and a 404", async () => {
    const openapi = handlerOf(OpenApiRoute, "ANY");
    const spec = await openapi({ request: new Request("http://localhost:3000/api/openapi/spec.json") });
    expect(spec.status).toBe(200);

    openApiHandle.mockResolvedValueOnce({ response: new Response("proxied") });
    const proxied = await openapi({ request: new Request("http://localhost:3000/api/openapi/resume") });
    expect(await proxied.text()).toBe("proxied");

    openApiHandle.mockResolvedValueOnce({ response: undefined });
    const missing = await openapi({ request: new Request("http://localhost:3000/api/openapi/missing") });
    expect(missing.status).toBe(404);

    const rpc = handlerOf(RpcRoute, "ANY");
    rpcHandle.mockResolvedValueOnce({ response: new Response("rpc") });
    expect(await (await rpc({ request: new Request("http://localhost:3000/api/rpc/flags") })).text()).toBe("rpc");
    rpcHandle.mockResolvedValueOnce({});
    expect((await rpc({ request: new Request("http://localhost:3000/api/rpc/missing") })).status).toBe(404);
  });

  it("logs server failures and ignores client errors", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const hook of errorHooks) {
      hook(new ORPCError("BAD_REQUEST", { status: 400 }));
      hook(new ORPCError("INTERNAL_SERVER_ERROR", { status: 500 }));
      hook(new Error("boom"));
    }
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("reviewer document download", () => {
  const handle = () => handlerOf(ReviewerDocumentRoute, "GET");
  const args = (headers?: HeadersInit) => ({
    request: new Request("http://localhost:3000/api/reviewer/documents/req/doc", { headers }),
    params: { requestId: "req", documentId: "doc" },
  });

  beforeEach(() => {
    getSession.mockReset();
    limit.mockReset();
    downloadReviewerDocument.mockReset();
  });

  it("requires a reviewer session that is not in user mode", async () => {
    getSession.mockResolvedValueOnce(null);
    expect((await handle()(args())).status).toBe(401);

    getSession.mockResolvedValueOnce({ user: {} });
    expect((await handle()(args())).status).toBe(401);

    getSession.mockResolvedValue({ user: { id: "admin" } });
    limit.mockResolvedValueOnce([]);
    expect((await handle()(args())).status).toBe(403);

    limit.mockResolvedValueOnce([{ role: "support" }]);
    expect((await handle()(args())).status).toBe(403);

    limit.mockResolvedValueOnce([{ role: "reviewer_admin" }]);
    expect((await handle()(args({ cookie: "dashboardMode=user" }))).status).toBe(403);
  });

  it("streams a pdf or another file and maps download errors", async () => {
    getSession.mockResolvedValue({ user: { id: "admin" } });
    limit.mockResolvedValue([{ role: "reviewer_admin" }]);
    downloadReviewerDocument.mockResolvedValueOnce({
      contentType: "application/pdf",
      documentType: "passport",
      size: 4,
      data: Uint8Array.from([1, 2, 3, 4]),
    });
    const pdf = await handle()(args());
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toContain("passport.pdf");

    downloadReviewerDocument.mockResolvedValueOnce({
      contentType: "image/png",
      documentType: "selfie",
      size: 2,
      data: Uint8Array.from([1, 2]),
    });
    const image = await handle()(args());
    expect(image.headers.get("content-disposition")).toContain('filename="selfie"');

    for (const code of ["NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED", "BAD_REQUEST"] as const) {
      downloadReviewerDocument.mockRejectedValueOnce(new ORPCError(code, { message: code }));
      const response = await handle()(args());
      expect(response.status).toBe(
        code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : code === "UNAUTHORIZED" ? 401 : 400,
      );
    }

    downloadReviewerDocument.mockRejectedValueOnce(new Error("disk"));
    expect(await (await handle()(args())).text()).toBe("disk");
    downloadReviewerDocument.mockRejectedValueOnce("nope");
    expect((await handle()(args())).status).toBe(500);
  });
});

describe("schema and oauth discovery", () => {
  it("returns the resume schema and metadata documents", async () => {
    const schema = await handlerOf(SchemaRoute, "GET")({ request: new Request("http://localhost:3000/schema.json") });
    expect(schema.headers.get("content-type")).toContain("application/schema+json");

    const discovery = [
      AuthServerRoute,
      AuthServerSplatRoute,
      OpenIdRoute,
      ProtectedRoute,
      ProtectedSplatRoute,
    ] as const;
    for (const route of discovery) {
      const response = await handlerOf(
        route,
        "GET",
      )({
        request: new Request("http://localhost:3000/.well-known/oauth"),
      });
      expect(response.status).toBe(200);
    }
    expect(getProtectedResourceMetadata).toHaveBeenCalled();
  });
});
