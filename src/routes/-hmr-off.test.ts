import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => (Array.isArray(strings) ? strings.join("") : ""),
  msg: (strings: TemplateStringsArray) => ({ id: Array.isArray(strings) ? strings.join("") : "" }),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@lingui/react", () => ({
  I18nProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
  useLingui: () => ({ i18n: { _: () => "" } }),
}));

vi.mock("@/integrations/drizzle/client", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) },
}));

vi.mock("@/integrations/orpc/router", () => ({ default: {} }));

vi.mock("@/utils/locale", () => ({
  getLocale: async () => "en-US",
  loadLocale: async () => undefined,
  isRTL: () => false,
}));

vi.mock("@/integrations/auth/config", () => ({
  auth: { handler: async () => new Response(null), api: { getSession: async () => null } },
  authBaseUrl: "http://localhost:3000",
  verifyOAuthToken: async () => null,
}));

vi.mock("@/integrations/auth/client", () => ({
  authClient: { getProtectedResourceMetadata: async () => ({}) },
}));

vi.mock("@better-auth/oauth-provider", () => ({
  oauthProviderAuthServerMetadata: () => () => new Response(null),
  oauthProviderOpenIdConfigMetadata: () => () => new Response(null),
}));

import "../test-hmr-off-setup";
import "./$username/$slug";
import "./__root";
import "./_home/index";
import "./_home/route";
import "./auth/forgot-password";
import "./auth/index";
import "./auth/login";
import "./auth/register";
import "./auth/reset-password";
import "./auth/resume-password";
import "./auth/route";
import "./auth/verify-2fa";
import "./auth/verify-2fa-backup";
import "./auth/verify-email";
import "./printer/$id";
import "./reviewer/$adminId";
import "./schema[.]json";
import "./[.]well-known/oauth-authorization-server";
import "./[.]well-known/oauth-authorization-server.$";
import "./[.]well-known/oauth-protected-resource";
import "./[.]well-known/oauth-protected-resource.$";
import "./[.]well-known/openid-configuration";

describe("route modules without hot context", () => {
  it("imports when hot reload is disabled", () => {
    expect(true).toBe(true);
  });
});
