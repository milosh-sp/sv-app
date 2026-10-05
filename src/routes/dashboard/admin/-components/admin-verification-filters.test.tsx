import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

import {
    defaultAdminExperienceSearch,
    defaultAdminVerdictSearch,
    defaultAdminVerificationSearch,
} from "@/utils/verification/admin-verification-search";

import {
    AdminExperienceFilterBar,
    AdminVerdictFilterBar,
    AdminVerificationFilterBar,
} from "./admin-verification-filters";

function setInput(id: string, value: string) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) throw new Error(`missing ${id}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("missing setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("admin verification filters", () => {
  it("commits a search, changes a method, and resets", async () => {
    const onSearchChange = vi.fn();
    const onReset = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <>
          <AdminVerificationFilterBar
            variant="experience"
            tab="history"
            search={{ ...defaultAdminVerificationSearch, q: "ada", statuses: ["verified"] }}
            onSearchChange={onSearchChange}
            onReset={onReset}
          />
          <AdminExperienceFilterBar
            tab="history"
            search={{ ...defaultAdminExperienceSearch, q: "ada", types: ["skill"] }}
            onSearchChange={onSearchChange}
            onReset={onReset}
          />
          <AdminVerdictFilterBar
            tab="history"
            search={{ ...defaultAdminVerdictSearch, q: "ada", proposed: ["issue"] }}
            onSearchChange={onSearchChange}
            onReset={onReset}
          />
        </>,
      );
    });

    const searches = [...document.querySelectorAll("input")].filter((input) => input.id.includes("search"));
    expect(searches.length).toBeGreaterThan(0);
    for (const input of searches) setInput(input.id, "grace");
    expect(onSearchChange).toHaveBeenCalledWith(expect.objectContaining({ q: "grace", page: 1 }));

    const resets = [...document.querySelectorAll("button")].filter((button) =>
      button.textContent?.includes("Reset filters"),
    );
    expect(resets.length).toBeGreaterThan(0);
    for (const button of resets) {
      act(() => {
        button.click();
      });
    }
    expect(onReset).toHaveBeenCalled();

    const jobs: Array<(value: unknown) => void> = [];
    const seen = new Set<unknown>();
    const host = container.firstElementChild ?? container;
    const fiberKey = Object.keys(host).find((name) => name.startsWith("__reactFiber$"));
    type Fiber = {
      child?: Fiber;
      sibling?: Fiber;
      memoizedProps?: { onValueChange?: (value: unknown) => void };
    };
    const start = fiberKey ? (host as unknown as Record<string, Fiber>)[fiberKey] : undefined;
    const stack = start ? [start] : [];
    const walked = new Set<Fiber>();
    while (stack.length > 0) {
      const fiber = stack.pop();
      if (!fiber || walked.has(fiber)) continue;
      walked.add(fiber);
      const onValueChange = fiber.memoizedProps?.onValueChange;
      if (typeof onValueChange === "function" && !seen.has(onValueChange)) {
        seen.add(onValueChange);
        jobs.push(onValueChange);
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    for (const onValueChange of jobs) {
      act(() => {
        onValueChange("document_upload");
        onValueChange(null);
        onValueChange(["verified"]);
      });
    }
    expect(onSearchChange.mock.calls.length).toBeGreaterThan(searches.length);

    root.unmount();
    container.remove();
  });

  it("syncs a committed query and clears nullable combobox values", async () => {
    const onSearchChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const experience = { ...defaultAdminExperienceSearch, q: "ada", statuses: ["issue" as const] };
    const verdict = { ...defaultAdminVerdictSearch, q: "ada", proposed: ["verified" as const], types: ["skill" as const] };

    await act(async () => {
      root.render(
        <>
          <AdminExperienceFilterBar tab="queue" search={experience} onSearchChange={onSearchChange} onReset={vi.fn()} />
          <AdminVerdictFilterBar tab="queue" search={verdict} onSearchChange={onSearchChange} onReset={vi.fn()} />
          <AdminVerdictFilterBar
            tab="history"
            search={{ ...defaultAdminVerdictSearch, q: "ada", statuses: ["rejected"] }}
            onSearchChange={onSearchChange}
            onReset={vi.fn()}
          />
        </>,
      );
    });

    await act(async () => {
      root.render(
        <>
          <AdminExperienceFilterBar
            tab="queue"
            search={{ ...experience, q: "grace" }}
            onSearchChange={onSearchChange}
            onReset={vi.fn()}
          />
          <AdminVerdictFilterBar tab="queue" search={{ ...verdict, q: "grace" }} onSearchChange={onSearchChange} onReset={vi.fn()} />
          <AdminVerdictFilterBar
            tab="history"
            search={{ ...defaultAdminVerdictSearch, q: "grace", statuses: ["rejected"] }}
            onSearchChange={onSearchChange}
            onReset={vi.fn()}
          />
        </>,
      );
    });
    const inputs = [...container.querySelectorAll("input")].filter((input) => input.id.includes("search"));
    expect(inputs.every((input) => input.value === "grace")).toBe(true);

    type Fiber = {
      child?: Fiber;
      sibling?: Fiber;
      return?: Fiber;
      memoizedProps?: { onValueChange?: (value: unknown) => void };
    };
    const host = container.firstElementChild;
    if (!(host instanceof HTMLElement)) throw new Error("missing filter");
    const fiberKey = Object.keys(host).find((name) => name.startsWith("__reactFiber$"));
    let start = fiberKey ? (host as unknown as Record<string, Fiber>)[fiberKey] : undefined;
    while (start?.return) start = start.return;
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
        act(() => {
          onValueChange("freelancer_link");
          onValueChange(null);
          onValueChange(["rejected"]);
          onValueChange(undefined);
        });
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    expect(onSearchChange).toHaveBeenCalledWith(expect.objectContaining({ method: "all", page: 1 }));
    expect(onSearchChange).toHaveBeenCalledWith(expect.objectContaining({ statuses: [], page: 1 }));
    expect(onSearchChange).toHaveBeenCalledWith(expect.objectContaining({ proposed: [], page: 1 }));
    expect(onSearchChange).toHaveBeenCalledWith(expect.objectContaining({ types: [], page: 1 }));

    root.unmount();
    container.remove();
  });
});
