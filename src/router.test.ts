import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  createRouter: (options: unknown) => ({ options }),
}));

vi.mock("@tanstack/react-router-ssr-query", () => ({
  setupRouterSsrQueryIntegration: vi.fn(),
}));

vi.mock("./routeTree.gen", () => ({ routeTree: { id: "root" } }));
vi.mock("./components/layout/error-screen", () => ({ ErrorScreen: () => null }));
vi.mock("./components/layout/loading-screen", () => ({ LoadingScreen: () => null }));
vi.mock("./components/layout/not-found-screen", () => ({ NotFoundScreen: () => null }));
vi.mock("./integrations/auth/functions", () => ({ getSession: async () => null }));
vi.mock("./integrations/orpc/client", () => ({
  client: { flags: { get: async () => ({ disableSignups: false }) } },
  orpc: { name: "orpc" },
}));
vi.mock("./integrations/query/client", () => ({ getQueryClient: () => ({ id: "query" }) }));
vi.mock("./utils/dashboard-mode", () => ({ getDashboardMode: async () => "user" }));
vi.mock("./utils/locale", () => ({ getLocale: async () => "en-US", loadLocale: async () => undefined }));
vi.mock("./utils/theme", () => ({ getTheme: async () => "dark" }));

import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { getRouter } from "./router";

describe("getRouter", () => {
  it("builds a router from the request context", async () => {
    const router = await getRouter();
    expect(router).toMatchObject({ options: { context: { locale: "en-US", theme: "dark" } } });
    expect(setupRouterSsrQueryIntegration).toHaveBeenCalled();
  });
});
