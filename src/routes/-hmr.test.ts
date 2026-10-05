import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    Array.isArray(strings)
      ? strings.reduce((result, part, index) => result + part + String(values[index] ?? ""), "")
      : "",
  msg: (strings: TemplateStringsArray) => ({ id: Array.isArray(strings) ? strings.join("") : "" }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock("@lingui/react", () => ({
  I18nProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
  useLingui: () => ({ i18n: { locale: "en-US", t: () => "", _: () => "" } }),
}));

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    execute: async () => undefined,
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
  },
}));

vi.mock("@/integrations/orpc/router", () => ({ default: {} }));

vi.mock("@/integrations/auth/config", () => ({
  auth: {
    handler: async () => new Response(null),
    api: {
      getSession: async () => null,
      generateOpenAPISchema: async () => ({}),
      verifyApiKey: async () => ({ valid: false }),
    },
  },
  authBaseUrl: "http://localhost:3000",
  verifyOAuthToken: async () => null,
}));

vi.mock("@/integrations/auth/client", () => ({
  authClient: { getProtectedResourceMetadata: async () => ({ resource: "http://localhost:3000" }) },
}));

vi.mock("@better-auth/oauth-provider", () => ({
  oauthProviderAuthServerMetadata: () => () => new Response(null),
  oauthProviderOpenIdConfigMetadata: () => () => new Response(null),
}));

vi.mock("@/utils/locale", () => ({
  getLocale: async () => "en-US",
  loadLocale: async () => undefined,
  isRTL: (locale: string) => locale.startsWith("ar"),
}));

import { fakeRoute, hotCallbacks } from "../test-hmr-setup";
import * as SlugRoute from "./$username/$slug";
import * as AuthServerRoute from "./[.]well-known/oauth-authorization-server";
import * as AuthServerSplatRoute from "./[.]well-known/oauth-authorization-server.$";
import * as ProtectedRoute from "./[.]well-known/oauth-protected-resource";
import * as ProtectedSplatRoute from "./[.]well-known/oauth-protected-resource.$";
import * as OpenIdRoute from "./[.]well-known/openid-configuration";
import * as RootRoute from "./__root";
import * as HomeIndexRoute from "./_home/index";
import * as HomeRoute from "./_home/route";
import * as ForgotPasswordRoute from "./auth/forgot-password";
import * as AuthIndexRoute from "./auth/index";
import * as LoginRoute from "./auth/login";
import * as RegisterRoute from "./auth/register";
import * as ResetPasswordRoute from "./auth/reset-password";
import * as ResumePasswordRoute from "./auth/resume-password";
import * as AuthLayoutRoute from "./auth/route";
import * as VerifyTwoFactorRoute from "./auth/verify-2fa";
import * as VerifyBackupRoute from "./auth/verify-2fa-backup";
import * as VerifyEmailRoute from "./auth/verify-email";
import * as PrinterRoute from "./printer/$id";
import * as ReviewerRoute from "./reviewer/$adminId";
import * as SchemaRoute from "./schema[.]json";

const modules = [
  SlugRoute,
  RootRoute,
  HomeIndexRoute,
  HomeRoute,
  ForgotPasswordRoute,
  AuthIndexRoute,
  LoginRoute,
  RegisterRoute,
  ResetPasswordRoute,
  ResumePasswordRoute,
  AuthLayoutRoute,
  VerifyBackupRoute,
  VerifyTwoFactorRoute,
  VerifyEmailRoute,
  PrinterRoute,
  ReviewerRoute,
  SchemaRoute,
  AuthServerRoute,
  AuthServerSplatRoute,
  ProtectedRoute,
  ProtectedSplatRoute,
  OpenIdRoute,
];

describe("route hot reload", () => {
  it("runs the injected update callback for each route module", () => {
    expect(hotCallbacks.length).toBeGreaterThan(0);
    for (const callback of hotCallbacks) {
      callback(undefined);
      callback({});
      callback({ Route: SlugRoute.Route });
      callback({ Route: fakeRoute });
    }
    for (const mod of modules) {
      (mod as { TSRFastRefreshAnchor?: () => void }).TSRFastRefreshAnchor?.();
    }
    const readIgnored = (window as Window & { __getReactRefreshIgnoredExports?: (ctx: { id: string }) => string[] })
      .__getReactRefreshIgnoredExports;
    readIgnored?.({ id: "missing" });
    readIgnored?.({ id: "present" });
    readIgnored?.({ id: "present" });
  });
});
