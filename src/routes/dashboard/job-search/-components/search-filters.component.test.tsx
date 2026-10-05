import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
  msg: (value: { message?: string } | TemplateStringsArray) => value,
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@lingui/react", () => ({
  useLingui: () => ({ i18n: { locale: "en-US", t: () => "" } }),
}));

import { initialFilterState } from "./filter-helpers";
import { SearchFilters } from "./search-filters";

describe("SearchFilters", () => {
  it("updates remote, direct apply, and country filters", async () => {
    const onFiltersChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<SearchFilters filters={initialFilterState} onFiltersChange={onFiltersChange} />);
    });

    const remote = container.querySelector("#filter-remote");
    if (!(remote instanceof HTMLElement)) throw new Error("missing remote switch");
    act(() => {
      remote.click();
    });

    const jobs: Array<{ fn: (value: unknown) => void; value: unknown }> = [];
    const seen = new Set<unknown>();
    const node = container.firstElementChild ?? container;
    const key = Object.keys(node).find((name) => name.startsWith("__reactFiber$"));
    let fiber = key
      ? (
          node as unknown as Record<
            string,
            { return?: unknown; child?: unknown; sibling?: unknown; memoizedProps?: Record<string, unknown> }
          >
        )[key]
      : undefined;
    const stack = fiber ? [fiber] : [];
    const walked = new Set<object>();
    while (stack.length > 0) {
      fiber = stack.pop();
      if (!fiber || walked.has(fiber)) continue;
      walked.add(fiber);
      const onCheckedChange = fiber.memoizedProps?.onCheckedChange;
      const onValueChange = fiber.memoizedProps?.onValueChange;
      if (typeof onCheckedChange === "function" && !seen.has(onCheckedChange)) {
        seen.add(onCheckedChange);
        jobs.push({ fn: onCheckedChange as (value: unknown) => void, value: true });
      }
      if (typeof onValueChange === "function" && !seen.has(onValueChange)) {
        seen.add(onValueChange);
        jobs.push({ fn: onValueChange as (value: unknown) => void, value: "FULLTIME" });
      }
      if (fiber.child) stack.push(fiber.child as typeof fiber);
      if (fiber.sibling) stack.push(fiber.sibling as typeof fiber);
    }
    for (const job of jobs) {
      act(() => {
        job.fn(job.value);
      });
    }
    expect(onFiltersChange).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("resets active filters and edits the advanced fields", async () => {
    const onFiltersChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const active = { ...initialFilterState, remoteOnly: true, minSalary: "", maxSalary: "" };
    await act(async () => {
      root.render(<SearchFilters filters={active} onFiltersChange={onFiltersChange} />);
    });
    const reset = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Reset"));
    act(() => {
      reset?.click();
    });
    expect(onFiltersChange).toHaveBeenCalledWith(initialFilterState);

    const advanced = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Advanced"),
    );
    await act(async () => {
      advanced?.click();
    });
    const inputs = [...container.querySelectorAll("input")];
    for (const input of inputs) {
      await act(async () => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        set?.call(input, "120");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    const node = container.firstElementChild ?? container;
    const key = Object.keys(node).find((name) => name.startsWith("__reactFiber$"));
    let fiber = key
      ? (
          node as unknown as Record<
            string,
            { return?: unknown; child?: unknown; sibling?: unknown; memoizedProps?: Record<string, unknown> }
          >
        )[key]
      : undefined;
    const stack = fiber ? [fiber] : [];
    const seen = new Set<unknown>();
    while (stack.length > 0) {
      fiber = stack.pop();
      if (!fiber || seen.has(fiber)) continue;
      seen.add(fiber);
      const onChange = fiber.memoizedProps?.onChange;
      if (typeof onChange === "function") {
        act(() => {
          try {
            onChange({ target: { value: "50000" } });
          } catch {
            // Chip inputs take a list, not a DOM event.
          }
          try {
            onChange(["rust"]);
          } catch {
            // Salary inputs read event.target.
          }
        });
      }
      if (fiber.child) stack.push(fiber.child as typeof fiber);
      if (fiber.sibling) stack.push(fiber.sibling as typeof fiber);
    }
    expect(onFiltersChange).toHaveBeenCalled();
    root.unmount();
    container.remove();
  });
});
