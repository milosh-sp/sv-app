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

const ai = vi.hoisted(() => ({
  settings: null as null | {
    provider: "openai" | "ollama";
    model: string;
    baseURL: string;
    apiKeySet: boolean;
    connectionTestOk: boolean;
  },
  settingsError: false,
  testResult: true as boolean,
  testError: false,
  storedResult: false as boolean,
  storedError: false,
  saveResult: { testOk: true } as { testOk: boolean },
  saveError: false,
  hang: null as null | ((value?: unknown) => void),
}));

function mutation(run: () => Promise<unknown>) {
  return {
    mutationOptions: () => ({
      mutationFn: async () => {
        if (ai.hang) await new Promise((resolve) => (ai.hang = resolve));
        return run();
      },
    }),
  };
}

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    admin: {
      ai: {
        getSettings: {
          queryOptions: () => ({
            queryKey: ["ai-settings", ai.settingsError, ai.settings],
            queryFn: async () => {
              if (ai.settingsError) throw new Error("settings down");
              return ai.settings;
            },
          }),
        },
        testConnection: mutation(async () => {
          if (ai.testError) throw new Error("test failed");
          return ai.testResult;
        }),
        testStoredConnection: mutation(async () => {
          if (ai.storedError) throw new Error("stored failed");
          return ai.storedResult;
        }),
        setSettings: mutation(async () => {
          if (ai.saveError) throw new Error("save failed");
          return ai.saveResult;
        }),
      },
    },
    ai: { getAvailability: { queryOptions: () => ({ queryKey: ["ai-avail"] }) } },
  },
}));

import { toast } from "sonner";

import { Route } from "./ai";

function setValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

type Fiber = {
  child?: Fiber;
  sibling?: Fiber;
  return?: Fiber;
  memoizedProps?: { onValueChange?: (value: unknown) => void };
};

function changeComboboxes(value: unknown) {
  const host = document.body;
  const fiberKey = Object.getOwnPropertyNames(host).find((name) => name.startsWith("__reactContainer$"));
  const rootKey = fiberKey ?? Object.getOwnPropertyNames(host).find((name) => name.startsWith("__reactFiber$"));
  let start = rootKey ? (host as unknown as Record<string, Fiber>)[rootKey] : undefined;
  if (!start) {
    const child = document.body.firstElementChild;
    const key = child ? Object.getOwnPropertyNames(child).find((name) => name.startsWith("__reactFiber$")) : undefined;
    start = key && child ? (child as unknown as Record<string, Fiber>)[key] : undefined;
    while (start?.return) start = start.return;
  }
  const stack = start ? [start] : [];
  const seen = new Set<unknown>();
  const walked = new Set<Fiber>();
  while (stack.length > 0) {
    const fiber = stack.pop();
    if (!fiber || walked.has(fiber)) continue;
    walked.add(fiber);
    const onValueChange = fiber.memoizedProps?.onValueChange;
    if (typeof onValueChange === "function" && !seen.has(onValueChange)) {
      seen.add(onValueChange);
      onValueChange(value);
    }
    if (fiber.child) stack.push(fiber.child);
    if (fiber.sibling) stack.push(fiber.sibling);
  }
}

async function render() {
  const Screen = Route.options.component as ComponentType & { preload?: () => Promise<void> };
  await Screen.preload?.();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
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

describe("admin AI settings", () => {
  it("loads settings, tests both key sources, and saves", async () => {
    ai.settings = null;
    ai.settingsError = false;
    const loading = await render();
    expect(loading.container.textContent).toContain("Loading");
    loading.unmount();

    ai.settingsError = true;
    const failed = await render();
    expect(failed.container.textContent).toBe("");
    failed.unmount();

    ai.settingsError = false;
    ai.settings = {
      provider: "openai",
      model: "gpt-4",
      baseURL: "https://api.openai.com/v1",
      apiKeySet: false,
      connectionTestOk: false,
    };
    const view = await render();
    expect(view.container.textContent).toContain("Global AI");

    const model = document.getElementById("admin-ai-model");
    const key = document.getElementById("admin-ai-api-key");
    const base = document.getElementById("admin-ai-base-url");
    if (!(model instanceof HTMLInputElement) || !(key instanceof HTMLInputElement) || !(base instanceof HTMLInputElement)) {
      throw new Error("missing fields");
    }
    await act(async () => {
      setValue(model, "claude");
      setValue(key, "  secret  ");
      setValue(base, "http://localhost:11434");
      changeComboboxes(null);
      changeComboboxes("ollama");
    });

    const click = async (label: string) => {
      await act(async () => {
        [...document.querySelectorAll("button")].find((button) => button.textContent?.includes(label))?.click();
      });
    };

    ai.testResult = true;
    await click("Test connection");
    ai.testResult = false;
    await click("Test connection");
    ai.testError = true;
    await click("Test connection");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("test failed");

    await act(async () => {
      setValue(key, "   ");
    });
    await click("Test connection");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Enter an API key before testing.");

    view.unmount();
    ai.settings = { ...ai.settings, apiKeySet: true, connectionTestOk: true };
    ai.testError = false;
    const stored = await render();
    await act(async () => {
      const blank = document.getElementById("admin-ai-api-key");
      if (blank instanceof HTMLInputElement) setValue(blank, "");
    });
    ai.storedResult = true;
    await click("Test connection");
    ai.storedResult = false;
    await click("Test connection");
    ai.storedError = true;
    await click("Test connection");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("stored failed");

    ai.saveResult = { testOk: true };
    await click("Save and verify");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Settings saved");
    ai.saveResult = { testOk: false };
    await click("Save and verify");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Saved, but the connection test did not succeed");
    ai.saveError = true;
    await click("Save and verify");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("save failed");

    stored.unmount();
  }, 20000);
});
