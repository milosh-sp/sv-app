// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.hoisted(() => vi.fn());
const limit = vi.hoisted(() => vi.fn(async () => [] as unknown[]));
const insertValues = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession } },
  authBaseUrl: "http://localhost:3000",
}));
vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
    insert: () => ({ values: insertValues }),
  },
}));

import { Route } from "./oauth";

type Handler = (args: { request: Request }) => Promise<Response>;

function handlers() {
  const server = Route.options.server?.handlers as unknown as { GET?: Handler; POST?: Handler } | undefined;
  if (!server?.GET || !server.POST) throw new Error("oauth handlers missing");
  return { GET: server.GET, POST: server.POST };
}

const session = {
  user: { id: "user-1" },
  session: { id: "sess-1", createdAt: new Date("2024-01-01T00:00:00.000Z") },
};

const client = {
  clientId: "client",
  name: "App <script>",
  redirectUris: ["https://app.example/callback"],
  skipConsent: false,
};

describe("oauth authorize", () => {
  beforeEach(() => {
    getSession.mockReset();
    limit.mockReset();
    insertValues.mockReset();
    insertValues.mockResolvedValue(undefined);
  });

  it("sends anonymous visitors to login and rejects a bad query", async () => {
    getSession.mockResolvedValue(null);
    const { GET } = handlers();
    const login = await GET({
      request: new Request(
        "http://localhost:3000/auth/oauth?client_id=client&redirect_uri=https://app.example/callback",
      ),
    });
    expect(login.status).toBe(302);
    expect(login.headers.get("location")).toContain("/auth/login");
    expect(login.headers.get("location")).toContain("callbackURL");

    getSession.mockResolvedValue(session);
    const missing = await GET({ request: new Request("http://localhost:3000/auth/oauth") });
    expect(missing.status).toBe(400);

    limit.mockResolvedValueOnce([]);
    const unknown = await GET({
      request: new Request(
        "http://localhost:3000/auth/oauth?client_id=missing&redirect_uri=https://app.example/callback",
      ),
    });
    expect(unknown.status).toBe(400);

    limit.mockResolvedValueOnce([client]);
    const redirect = await GET({
      request: new Request(
        "http://localhost:3000/auth/oauth?client_id=client&redirect_uri=https://evil.example/callback",
      ),
    });
    expect(redirect.status).toBe(400);
  });

  it("shows a consent page and issues a code when consent is skipped or posted", async () => {
    getSession.mockResolvedValue(session);
    limit.mockResolvedValue([client]);
    const { GET, POST } = handlers();

    const consent = await GET({
      request: new Request(
        "http://localhost:3000/auth/oauth?client_id=client&redirect_uri=https://app.example/callback&state=abc&scope=openid",
      ),
    });
    expect(consent.status).toBe(200);
    const html = await consent.text();
    expect(html).toContain("App &lt;script&gt;");
    expect(html).toContain("openid");

    limit.mockResolvedValue([{ ...client, skipConsent: true, name: "" }]);
    const skipped = await GET({
      request: new Request(
        "http://localhost:3000/auth/oauth?client_id=client&redirect_uri=https://app.example/callback",
      ),
    });
    expect(skipped.status).toBe(302);
    expect(skipped.headers.get("location")).toContain("code=");
    expect(insertValues).toHaveBeenCalled();

    getSession.mockResolvedValue(null);
    const form = new FormData();
    form.set("client_id", "client");
    form.set("redirect_uri", "https://app.example/callback");
    const anonymousPost = await POST({
      request: new Request("http://localhost:3000/auth/oauth", { method: "POST", body: form }),
    });
    expect(anonymousPost.status).toBe(302);

    getSession.mockResolvedValue(session);
    const allow = new FormData();
    allow.set("client_id", "client");
    allow.set("redirect_uri", "https://app.example/callback");
    allow.set("state", "abc");
    const issued = await POST({
      request: new Request("http://localhost:3000/auth/oauth", { method: "POST", body: allow }),
    });
    expect(issued.status).toBe(302);
    expect(issued.headers.get("location")).toContain("state=abc");
  });

  it("drops signature params, names a blank client, and ignores file fields", async () => {
    getSession.mockResolvedValue(null);
    const { GET, POST } = handlers();
    const login = await GET({
      request: new Request(
        "http://localhost:3000/auth/oauth?client_id=client&redirect_uri=https://app.example/callback&exp=1&sig=2",
      ),
    });
    const callback = new URL(login.headers.get("location") ?? "", "http://localhost:3000").searchParams.get(
      "callbackURL",
    );
    expect(callback).not.toContain("exp=");
    expect(callback).not.toContain("sig=");

    getSession.mockResolvedValue(session);
    limit.mockResolvedValue([{ ...client, name: "", skipConsent: false }]);
    const unnamed = await GET({
      request: new Request(
        "http://localhost:3000/auth/oauth?client_id=client&redirect_uri=https://app.example/callback",
      ),
    });
    const page = await unnamed.text();
    expect(page).toContain("Scopes: none");
    expect(page).toContain("Authorize client");

    const form = new FormData();
    form.set("client_id", "client");
    form.set("redirect_uri", "https://app.example/callback");
    form.set("file", new File(["x"], "a.txt"));
    const posted = await POST({
      request: new Request("http://localhost:3000/auth/oauth", { method: "POST", body: form }),
    });
    expect(posted.status).toBe(302);
  });
});
