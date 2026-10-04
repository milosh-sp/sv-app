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
});
