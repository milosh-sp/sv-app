import { act } from "react";
import { createRoot } from "react-dom/client";
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

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    HeadContent: () => null,
    Scripts: () => null,
  };
});

vi.mock("@/integrations/auth/functions", () => ({
  getSession: async () => null,
}));

vi.mock("@/integrations/orpc/client", () => ({
  client: { flags: { get: async () => ({ disableSignups: false }) } },
  orpc: {},
}));

vi.mock("@/components/dashboard-mode/provider", () => ({
  DashboardModeProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock("@/components/command-palette", () => ({ CommandPalette: () => null }));
vi.mock("@/dialogs/manager", () => ({ DialogManager: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));

import { Route } from "./__root";

describe("root route", () => {
  it("builds document head, loads context, and renders both directions", async () => {
    const env = process.env as { APP_URL?: string };
    const previous = env.APP_URL;
    delete env.APP_URL;
    const head = Route.options.head;
    if (!head) throw new Error("root head missing");
    const fallback = head({} as never) as { meta: Array<{ property?: string; content?: string }> };
    env.APP_URL = previous;
    const local = head({} as never) as { meta: Array<{ property?: string; content?: string }> };
    const fallbackUrl = fallback.meta.find((item) => item.property === "og:url")?.content;
    const localUrl = local.meta.find((item) => item.property === "og:url")?.content;
    expect(fallbackUrl).toBe("https://skillverdict.com");
    expect(localUrl).toContain("localhost");

    const loaded = (await Route.options.beforeLoad?.({} as never)) as { locale: string; theme: string };
    expect(loaded.locale).toBeTruthy();
    expect(loaded.theme).toBeTruthy();

    const Shell = (Route.options as { shellComponent?: React.ComponentType<{ children?: React.ReactNode }> })
      .shellComponent;
    if (!Shell) throw new Error("root shell missing");
    const context = vi.spyOn(Route, "useRouteContext");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    for (const locale of ["en-US", "ar"]) {
      context.mockReturnValue({ theme: "dark", locale, dashboardMode: "user" } as never);
      await act(async () => {
        root.render(
          <Shell>
            <p>child</p>
          </Shell>,
        );
      });
    }
    expect(container.querySelector("p")?.textContent).toBe("child");
    act(() => root.unmount());
    container.remove();
  });
});
