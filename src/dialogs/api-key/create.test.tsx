import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const createKey = vi.hoisted(() => vi.fn());

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => "toast"), dismiss: vi.fn() },
}));
vi.mock("@/hooks/use-form-blocker", () => ({
  useFormBlocker: () => ({ blockEvents: {} }),
}));
vi.mock("@/integrations/auth/client", () => ({
  authClient: { apiKey: { create: createKey } },
}));

import { toast } from "sonner";

import { DialogManager } from "../manager";
import { useDialogStore } from "../store";

function setInput(value: string) {
  const input = document.querySelector("input");
  if (!(input instanceof HTMLInputElement)) throw new Error("missing name");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("missing setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input;
}

describe("create api key dialog", () => {
  it("shows an error, then copies the created key and closes", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    useDialogStore.setState({ open: true, activeDialog: { type: "api-key.create" } as never });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DialogManager />
        </QueryClientProvider>,
      );
    });

    const expires = [...document.querySelectorAll("label")].find((label) => label.textContent?.trim() === "Expires in");
    const expiresButton = expires?.htmlFor ? document.getElementById(expires.htmlFor) : null;
    if (!(expiresButton instanceof HTMLElement)) throw new Error("missing expires");
    const fiberKey = Object.keys(expiresButton).find((name) => name.startsWith("__reactFiber$"));
    let fiber = fiberKey
      ? (
          expiresButton as unknown as Record<
            string,
            { return: unknown; memoizedProps?: Record<string, unknown> } | null
          >
        )[fiberKey]
      : null;
    let onValueChange: ((value: number | null) => void) | undefined;
    while (fiber) {
      const handler = fiber.memoizedProps?.onValueChange;
      const options = fiber.memoizedProps?.options;
      if (typeof handler === "function" && Array.isArray(options)) {
        onValueChange = handler as (value: number | null) => void;
        break;
      }
      fiber = fiber.return as typeof fiber;
    }
    if (!onValueChange) throw new Error("missing expires handler");
    await act(async () => {
      onValueChange?.(3600 * 24 * 90);
      onValueChange?.(null);
    });
    expect(document.body.textContent).toContain("3 months");

    createKey.mockResolvedValueOnce({ data: null, error: { message: "limit" } });
    setInput("CI");
    const form = document.querySelector("form");
    if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
    await act(async () => {
      form.requestSubmit();
    });
    expect(toast.error).toHaveBeenCalled();

    createKey.mockResolvedValueOnce({ data: { key: "sk_live" }, error: null });
    await act(async () => {
      form.requestSubmit();
    });
    const key = document.querySelector("input[readonly]");
    if (!(key instanceof HTMLInputElement)) throw new Error("missing key");
    expect(key.value).toBe("sk_live");

    const copy = document.querySelector("[data-slot='input-group-button'], button[type='button']");
    if (copy instanceof HTMLButtonElement) {
      await act(async () => {
        copy.click();
      });
    }
    const confirm = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Confirm"));
    if (!(confirm instanceof HTMLButtonElement)) throw new Error("missing confirm");
    act(() => {
      confirm.click();
    });
    expect(invalidate).toHaveBeenCalled();

    root.unmount();
    container.remove();
  });
});
