import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const setLocked = vi.hoisted(() => vi.fn());
const deleteResume = vi.hoisted(() => vi.fn());

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => "toast") },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/integrations/ai/use-ai-integration", () => ({
  useAiIntegration: () => ({ canUse: true }),
}));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    resume: {
      delete: { mutationOptions: () => ({ mutationFn: deleteResume }) },
      setLocked: { mutationOptions: () => ({ mutationFn: setLocked }) },
    },
  },
}));

import { toast } from "sonner";

import { useDialogStore } from "@/dialogs/store";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";

import { ResumeContextMenu } from "./context-menu";
import { ResumeDropdownMenu } from "./dropdown-menu";

const resume = {
  id: "resume-1",
  name: "Ada",
  slug: "ada",
  isLocked: false,
  tags: [],
} as never;

async function openAndClick(label: string) {
  const trigger = document.querySelector("[data-slot='dropdown-menu-trigger'], [data-slot='context-menu-trigger']");
  if (!(trigger instanceof HTMLElement)) throw new Error("missing menu trigger");
  act(() => {
    trigger.click();
    trigger.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
  });
  const item = [...document.querySelectorAll("[data-slot='dropdown-menu-item'], [data-slot='context-menu-item']")].find(
    (element) => element.textContent?.includes(label),
  );
  if (!(item instanceof HTMLElement)) throw new Error(`missing ${label}`);
  await act(async () => {
    item.click();
  });
}

describe("resume menus", () => {
  it("updates, duplicates, reviews, locks, and deletes from both menus", async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ConfirmDialogProvider>
            <ResumeDropdownMenu resume={resume}>
              <button type="button">Open menu</button>
            </ResumeDropdownMenu>
            <ResumeContextMenu resume={{ id: "resume-1", name: "Ada", slug: "ada", isLocked: true, tags: [] } as never}>
              <button type="button">Open context</button>
            </ResumeContextMenu>
          </ConfirmDialogProvider>
        </QueryClientProvider>,
      );
    });

    await openAndClick("Update");
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.update");
    await openAndClick("Duplicate");
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.duplicate");
    await openAndClick("AI review");
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.ai.review");

    setLocked.mockImplementation((_input: unknown, options: { onError: (error: Error) => void }) => {
      options.onError(new Error("locked"));
    });
    await openAndClick("Lock");
    const cancel = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Cancel");
    await act(async () => {
      cancel?.click();
    });
    await openAndClick("Lock");
    const confirm = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Confirm");
    await act(async () => {
      confirm?.click();
    });
    expect(setLocked).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();

    deleteResume.mockImplementation((_input: unknown, options: { onError: (error: Error) => void }) => {
      options.onError(new Error("gone"));
    });
    await openAndClick("Delete");
    const confirmDelete = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Confirm",
    );
    await act(async () => {
      confirmDelete?.click();
    });
    expect(deleteResume).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("cancels a delete, unlocks without confirming, and reports a successful delete", async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const locked = { id: "resume-1", name: "Ada", slug: "ada", isLocked: true, tags: [] } as never;
    const unlocked = { id: "resume-2", name: "Grace", slug: "grace", isLocked: false, tags: [] } as never;
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ConfirmDialogProvider>
            <ResumeDropdownMenu resume={locked}>
              <button type="button">Menu</button>
            </ResumeDropdownMenu>
            <ResumeContextMenu resume={unlocked}>
              <button type="button">Context</button>
            </ResumeContextMenu>
          </ConfirmDialogProvider>
        </QueryClientProvider>,
      );
    });

    await openAndClick("Unlock");
    if (setLocked.mock.calls.length === 0) throw new Error(document.body.innerText.slice(0, 400));

    const openContext = async (label: string) => {
      const trigger = document.querySelector("[data-slot='context-menu-trigger']");
      act(() => {
        trigger?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
      });
      const item = [...document.querySelectorAll("[data-slot='context-menu-item']")].find((element) =>
        element.textContent?.includes(label),
      );
      if (!(item instanceof HTMLElement)) throw new Error(`missing context ${label}: ${document.body.innerText.slice(0, 300)}`);
      await act(async () => {
        item.click();
      });
    };

    await openContext("Update");
    await openContext("Duplicate");
    await openContext("AI review");
    await openContext("Lock");
    const cancelLock = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Cancel");
    await act(async () => {
      cancelLock?.click();
    });

    deleteResume.mockImplementation(async () => undefined);
    await openContext("Delete");
    const cancel = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Cancel");
    await act(async () => {
      cancel?.click();
    });
    await openContext("Delete");
    const confirm = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Confirm");
    if (!(confirm instanceof HTMLButtonElement)) throw new Error(document.body.innerText.slice(0, 500));
    await act(async () => {
      confirm.click();
      await Promise.resolve();
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalled();

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ConfirmDialogProvider>
            <ResumeDropdownMenu resume={unlocked}>
              <button type="button">Menu</button>
            </ResumeDropdownMenu>
          </ConfirmDialogProvider>
        </QueryClientProvider>,
      );
    });
    await openAndClick("Delete");
    const cancelDelete = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Cancel");
    await act(async () => {
      cancelDelete?.click();
    });
    await openAndClick("Delete");
    const confirmDelete = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Confirm");
    await act(async () => {
      confirmDelete?.click();
      await Promise.resolve();
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
