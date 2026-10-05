import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => children ?? null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/routes/dashboard/-components/header", () => ({
  DashboardHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const api = vi.hoisted(() => ({
  settings: null as null | { apiKeySet: boolean; connectionTestOk: boolean },
  settingsError: false,
  testResult: { success: true },
  testError: false,
  storedResult: { success: false },
  storedError: false,
  saveResult: { testOk: true },
  saveError: false,
}));

function mutation(run: () => Promise<unknown>) {
  return { mutationOptions: () => ({ mutationFn: async () => run() }) };
}

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    admin: {
      jobSearch: {
        getSettings: {
          queryOptions: () => ({
            queryKey: ["job-settings", api.settingsError, api.settings],
            queryFn: async () => {
              if (api.settingsError) throw new Error("settings down");
              return api.settings;
            },
          }),
        },
        testConnection: mutation(async () => {
          if (api.testError) throw new Error("test failed");
          return api.testResult;
        }),
        testStoredConnection: mutation(async () => {
          if (api.storedError) throw new Error("stored failed");
          return api.storedResult;
        }),
        setSettings: mutation(async () => {
          if (api.saveError) throw new Error("save failed");
          return api.saveResult;
        }),
      },
    },
    jobs: { getAvailability: { queryOptions: () => ({ queryKey: ["jobs-avail"] }) } },
  },
}));

import { toast } from "sonner";

import { Route } from "./job-search";

async function render() {
  const Screen = Route.options.component as ComponentType & { preload?: () => Promise<void> };
  await Screen.preload?.();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Screen />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("admin job search settings", () => {
  it("tests a typed key, a stored key, and a failed save", async () => {
    api.settings = null;
    const loading = await render();
    expect(loading.container.textContent).toContain("Loading");
    loading.unmount();

    api.settingsError = true;
    const failed = await render();
    expect(failed.container.textContent).toBe("");
    failed.unmount();

    api.settingsError = false;
    api.settings = { apiKeySet: false, connectionTestOk: false };
    const view = await render();
    const input = document.getElementById("admin-job-search-api-key");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing key");
    const setValue = (value: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const click = async (label: string) => {
      await act(async () => {
        [...document.querySelectorAll("button")].find((button) => button.textContent?.includes(label))?.click();
      });
    };
    await act(async () => setValue("  rapid  "));
    api.testResult = { success: true };
    await click("Test connection");
    api.testResult = { success: false };
    await click("Test connection");
    api.testError = true;
    await click("Test connection");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("test failed");
    await act(async () => setValue("   "));
    await click("Test connection");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Enter an API key before testing.");
    view.unmount();

    api.settings = { apiKeySet: true, connectionTestOk: true };
    api.testError = false;
    const stored = await render();
    await click("Test connection");
    api.storedResult = { success: true };
    await click("Test connection");
    api.storedError = true;
    await click("Test connection");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("stored failed");
    api.saveResult = { testOk: false };
    await click("Save and verify");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Saved, but the connection test did not succeed");
    api.saveResult = { testOk: true };
    await click("Save and verify");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Settings saved");
    api.saveError = true;
    await click("Save and verify");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("save failed");
    stored.unmount();
  }, 20000);
});
