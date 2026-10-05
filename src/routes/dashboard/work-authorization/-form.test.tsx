import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";

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
  resumes: [] as Array<{ id: string; name: string; slug: string }>,
  resume: null as { id: string; name: string; slug: string; data: Record<string, unknown> } | null,
  pending: false,
  error: "" as "" | "message" | "blank",
  release: null as null | (() => void),
}));

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    resume: {
      list: {
        queryOptions: () => ({
          queryKey: ["resumes", api.resumes],
          queryFn: async () => api.resumes,
        }),
      },
      getById: {
        queryOptions: () => ({
          queryKey: ["resume", api.resume, api.pending],
          queryFn: async () => api.resume,
        }),
      },
      update: {
        mutationOptions: () => ({
          mutationFn: async () => {
            if (api.error === "message") throw new Error("save failed");
            if (api.error === "blank") throw new Error("");
            return {};
          },
        }),
      },
    },
  },
}));

import { toast } from "sonner";

import { Route } from "./index";

type Fiber = {
  child?: Fiber;
  sibling?: Fiber;
  return?: Fiber;
  memoizedProps?: { onValueChange?: (value: unknown) => void; options?: Array<{ value: string }> };
};

function comboboxes(root: HTMLElement) {
  const fiberKey = Object.getOwnPropertyNames(root).find((name) => name.startsWith("__reactFiber$"));
  let start = fiberKey ? (root as unknown as Record<string, Fiber>)[fiberKey] : undefined;
  while (start?.return) start = start.return;
  const stack = start ? [start] : [];
  const seen = new Set<Fiber>();
  const found: Array<{ onValueChange: (value: unknown) => void; options: string[] }> = [];
  while (stack.length > 0) {
    const fiber = stack.pop();
    if (!fiber || seen.has(fiber)) continue;
    seen.add(fiber);
    const onValueChange = fiber.memoizedProps?.onValueChange;
    const options = fiber.memoizedProps?.options;
    if (typeof onValueChange === "function" && options) {
      found.push({ onValueChange, options: options.map((option) => option.value) });
    }
    if (fiber.child) stack.push(fiber.child);
    if (fiber.sibling) stack.push(fiber.sibling);
  }
  return found;
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
    client,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("work authorization", () => {
  it("saves each status and reports a missing resume", async () => {
    const empty = await render();
    expect(empty.container.textContent).toContain("Create a resume first");
    empty.unmount();

    api.resumes = [{ id: "resume-1", name: "", slug: "cv" }];
    api.resume = null;
    const missing = await render();
    for (let attempt = 0; attempt < 10 && missing.container.textContent?.includes("Loading"); attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    expect(missing.container.textContent).toContain("Could not load the selected resume");
    const form = missing.container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Please select a resume before saving.");
    missing.unmount();

    api.resume = { id: "resume-1", name: "", slug: "cv", data: { ...sampleResumeData, workAuthorization: undefined } };
    const view = await render();
    expect(view.container.textContent).toContain("cv");
    const pick = (values: string[]) =>
      comboboxes(view.container).find((box) => values.every((value) => box.options.includes(value)));
    await act(async () => {
      pick(["resume-1"])?.onValueChange(null);
      pick(["resume-1"])?.onValueChange("resume-1");
      pick(["eu", "usa", "uk"])?.onValueChange(null);
      pick(["eu", "usa", "uk"])?.onValueChange("usa");
    });
    const status = () => pick(["citizen", "visa_holder", "needs_sponsorship"]);
    await act(async () => {
      status()?.onValueChange(null);
      status()?.onValueChange("citizen");
      status()?.onValueChange("permanent_resident");
      status()?.onValueChange("needs_sponsorship");
      status()?.onValueChange("not_authorized");
      status()?.onValueChange("prefer_not_to_say");
      status()?.onValueChange("visa_holder");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const sponsor = () => pick(["yes", "no", "unknown"]);
    await act(async () => {
      sponsor()?.onValueChange(null);
      sponsor()?.onValueChange("case_by_case");
    });
    const dates = [...view.container.querySelectorAll("input[type='date']")];
    const showPicker = vi.fn();
    for (const date of dates) {
      Object.defineProperty(date, "showPicker", { configurable: true, value: showPicker });
    }
    await act(async () => {
      for (const date of dates) {
        date.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        date.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      }
    });
    for (const date of dates) delete (date as HTMLInputElement).showPicker;
    await act(async () => {
      for (const date of dates) {
        date.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        date.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      }
    });
    const box = view.container.querySelector("input[type='checkbox']");
    if (box instanceof HTMLInputElement) {
      await act(async () => {
        box.checked = true;
        box.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    const notes = view.container.querySelector("textarea");
    if (notes instanceof HTMLTextAreaElement) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(notes, "note");
        notes.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    const save = async () => {
      await act(async () => {
        [...view.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Save work authorization"))?.click();
      });
    };
    await save();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Work authorization saved.");
    if (box instanceof HTMLInputElement) {
      await act(async () => {
        box.checked = false;
        box.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    await act(async () => {
      status()?.onValueChange("citizen");
    });
    api.error = "message";
    await save();
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("save failed");
    api.error = "blank";
    await save();
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Failed to save work authorization.");
    api.error = "";
    api.resume = { ...api.resume, id: "resume-1", data: sampleResumeData };
    await view.client.invalidateQueries();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    view.unmount();
  }, 20000);
});
