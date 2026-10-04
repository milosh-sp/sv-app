import { describe, expect, it, vi } from "vite-plus/test";

const redirect = vi.hoisted(() => ({ current: null as null | (() => void) }));

vi.mock("better-auth/react", () => ({
  createAuthClient: (options: { plugins: Array<{ onTwoFactorRedirect?: () => void }> }) => {
    redirect.current = options.plugins.find((plugin) => plugin.onTwoFactorRedirect)?.onTwoFactorRedirect ?? null;
    return {};
  },
}));
vi.mock("better-auth/client/plugins", () => ({
  genericOAuthClient: () => ({}),
  inferAdditionalFields: () => ({}),
  usernameClient: () => ({}),
  twoFactorClient: (options: { onTwoFactorRedirect: () => void }) => options,
}));
vi.mock("@better-auth/api-key/client", () => ({ apiKeyClient: () => ({}) }));
vi.mock("@better-auth/infra/client", () => ({ dashClient: () => ({}) }));
vi.mock("@better-auth/oauth-provider/client", () => ({ oauthProviderClient: () => ({}) }));
vi.mock("@better-auth/oauth-provider/resource-client", () => ({ oauthProviderResourceClient: () => ({}) }));

import "./client";

describe("auth client", () => {
  it("sends the browser to the two-factor page", () => {
    const location = { href: "http://localhost:3000/" };
    vi.stubGlobal("window", { location });
    redirect.current?.();
    expect(location.href).toBe("/auth/verify-2fa");

    vi.stubGlobal("window", undefined);
    redirect.current?.();
    vi.unstubAllGlobals();
  });
});
