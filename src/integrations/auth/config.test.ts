// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const verifyAccessToken = vi.hoisted(() => vi.fn(async () => ({ sub: "user-1" })));
const sendEmail = vi.hoisted(() => vi.fn(async (_options: { text: string }) => undefined));
const betterAuth = vi.hoisted(() =>
  vi.fn(
    (config: {
      trustedOrigins: string[];
      advanced: { useSecureCookies: boolean };
      emailVerification: { sendVerificationEmail: (input: { user: { email: string }; url: string }) => Promise<void> };
    }) => config,
  ),
);
const rows = vi.hoisted(() => ({ value: [] as unknown[] }));

vi.mock("better-auth/oauth2", () => ({ verifyAccessToken }));
vi.mock("better-auth", () => ({
  betterAuth,
  BetterAuthError: class BetterAuthError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
      super(message);
      this.cause = options?.cause;
    }
  },
}));
vi.mock("better-auth/plugins", () => ({
  jwt: () => ({ id: "jwt" }),
  openAPI: () => ({ id: "openapi" }),
  twoFactor: () => ({ id: "two-factor" }),
  username: (options: object) => ({ id: "username", ...options }),
}));
vi.mock("better-auth/plugins/generic-oauth", () => ({
  genericOAuth: (options: { config: unknown[] }) => options,
}));
vi.mock("better-auth/plugins/two-factor", () => ({ twoFactor: () => ({ id: "two-factor" }) }));
vi.mock("@better-auth/api-key", () => ({ apiKey: () => ({ id: "api-key" }) }));
vi.mock("@better-auth/infra", () => ({ dash: () => ({ id: "dash" }) }));
vi.mock("@better-auth/oauth-provider", () => ({ oauthProvider: () => ({ id: "oauth-provider" }) }));
vi.mock("@better-auth/drizzle-adapter", () => ({ drizzleAdapter: () => ({ id: "drizzle" }) }));
vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: async () => rows.value,
          }),
        }),
      }),
    }),
  },
}));
vi.mock("@/integrations/email/service", () => ({ sendEmail }));

import { env } from "@/utils/env";

const originalAppUrl = process.env.APP_URL;
const originalBetterAuthUrl = process.env.BETTER_AUTH_URL;

async function loadConfig() {
  vi.resetModules();
  betterAuth.mockClear();
  const auth = await import("./config");
  const config = betterAuth.mock.calls.at(-1)?.[0];
  if (!config) throw new Error("auth config was not created");
  return { ...auth, config };
}

describe("OAuth audience and verification URL", () => {
  afterEach(() => {
    if (originalAppUrl === undefined) Reflect.deleteProperty(process.env, "APP_URL");
    else process.env.APP_URL = originalAppUrl;
    (env as { APP_URL: string }).APP_URL = originalAppUrl ?? env.APP_URL;
    if (originalBetterAuthUrl === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = originalBetterAuthUrl;
  });

  it("verifies a token against the four local audiences and keeps the verification link", async () => {
    delete process.env.BETTER_AUTH_URL;
    process.env.APP_URL = "http://localhost:3000";
    (env as { APP_URL: string }).APP_URL = "http://localhost:3000";
    const { verifyOAuthToken, config } = await loadConfig();

    await expect(verifyOAuthToken("token")).resolves.toEqual({ sub: "user-1" });
    expect(verifyAccessToken).toHaveBeenCalledWith("token", {
      jwksUrl: "http://localhost:3000/api/auth/jwks",
      verifyOptions: {
        issuer: "http://localhost:3000/api/auth",
        audience: [
          "http://localhost:3000",
          "http://localhost:3000/",
          "http://localhost:3000/mcp",
          "http://localhost:3000/mcp/",
        ],
      },
    });
    expect(config.trustedOrigins).toEqual(["http://localhost:3000", "http://127.0.0.1:3000"]);
    expect(config.advanced.useSecureCookies).toBe(false);

    await config.emailVerification.sendVerificationEmail({
      user: { email: "ada@example.com" },
      url: "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2Fdashboard",
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ada@example.com",
        text: expect.stringContaining("token=abc"),
      }),
    );
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0]?.text).toContain("callbackURL=%2Fdashboard");
  });

  it("omits the localhost alias when the app host is public", async () => {
    process.env.BETTER_AUTH_URL = "https://app.example.com";
    process.env.APP_URL = "https://app.example.com";
    (env as { APP_URL: string }).APP_URL = "https://app.example.com";
    const { verifyOAuthToken, config } = await loadConfig();

    await verifyOAuthToken("token");
    expect(verifyAccessToken).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        jwksUrl: "https://app.example.com/api/auth/jwks",
        verifyOptions: expect.objectContaining({
          audience: [
            "https://app.example.com",
            "https://app.example.com/",
            "https://app.example.com/mcp",
            "https://app.example.com/mcp/",
          ],
        }),
      }),
    );
    expect(config.trustedOrigins).toEqual(["https://app.example.com"]);
    expect(config.advanced.useSecureCookies).toBe(true);
  });

  it("maps social profiles and rejects a custom provider profile without an email", async () => {
    process.env.OAUTH_CLIENT_ID = "client";
    process.env.OAUTH_CLIENT_SECRET = "secret";
    process.env.OAUTH_DISCOVERY_URL = "https://idp.example.com/.well-known/openid-configuration";
    rows.value = [];
    const { config } = await loadConfig();
    const social = config as unknown as {
      socialProviders: {
        google: {
          mapProfileToUser: (
            profile: Record<string, string | undefined>,
          ) => Promise<{ name: string; username: string }>;
        };
        github: {
          mapProfileToUser: (
            profile: Record<string, string | undefined>,
          ) => Promise<{ id?: string; name: string; email: string }>;
        };
      };
      plugins: Array<{
        config?: Array<{ mapProfileToUser?: (profile: Record<string, string | undefined>) => Promise<unknown> }>;
        usernameNormalization?: (value: string) => string;
        displayUsernameNormalization?: (value: string) => string;
      }>;
    };

    await expect(
      social.socialProviders.google.mapProfileToUser({
        email: "ada@example.com",
        name: "Ada Lovelace",
        picture: "https://example.com/a.png",
      }),
    ).resolves.toMatchObject({
      name: "Ada Lovelace",
      username: "ada",
    });
    await expect(social.socialProviders.google.mapProfileToUser({ email: "grace@example.com" })).resolves.toMatchObject(
      {
        name: "grace",
        username: "grace",
      },
    );

    await expect(
      social.socialProviders.github.mapProfileToUser({
        email: "ada@example.com",
        login: "Ada",
        id: "7",
        avatar_url: "https://example.com/g.png",
      }),
    ).resolves.toMatchObject({ name: "Ada", username: "ada" });
    await expect(social.socialProviders.github.mapProfileToUser({ id: "9" })).resolves.toMatchObject({ name: "9" });

    rows.value = [
      {
        accountId: "acct-1",
        email: "legacy@example.com",
        emailVerified: false,
        username: "ada",
        displayUsername: "Ada",
      },
    ];
    await expect(social.socialProviders.github.mapProfileToUser({ login: "ada", id: "7" })).resolves.toMatchObject({
      id: "acct-1",
      email: "legacy@example.com",
      emailVerified: false,
    });

    const custom = social.plugins
      .flatMap((plugin) => plugin.config ?? [])
      .find((provider) => provider.mapProfileToUser);
    if (!custom?.mapProfileToUser) throw new Error("custom oauth mapper missing");
    await expect(custom.mapProfileToUser({})).rejects.toThrow(/email address/);
    await expect(
      custom.mapProfileToUser({
        email: "ada@example.com",
        preferred_username: "ada",
        avatar_url: "https://example.com/c.png",
      }),
    ).resolves.toMatchObject({ username: "ada", image: "https://example.com/c.png" });
    await expect(custom.mapProfileToUser({ email: "ada@example.com", name: "Ada" })).resolves.toMatchObject({
      name: "Ada",
      username: "ada",
    });

    delete process.env.OAUTH_CLIENT_ID;
    delete process.env.OAUTH_CLIENT_SECRET;
    delete process.env.OAUTH_DISCOVERY_URL;
    rows.value = [];
  });
});
