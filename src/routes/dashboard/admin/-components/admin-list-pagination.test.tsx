import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: unknown }) => children,
}));

import { AdminListPagination } from "./admin-list-pagination";

function render(node: ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return {
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("admin list pagination", () => {
  it("hides itself when the list fits on one page", () => {
    const view = render(
      <AdminListPagination page={1} totalPages={1} total={4} onPrevious={() => {}} onNext={() => {}} />,
    );
    expect(document.body.textContent).not.toContain("Previous");
    view.cleanup();
  });

  it("moves to the next page and blocks the previous button on the first page", () => {
    const onNext = vi.fn();
    const view = render(
      <AdminListPagination page={1} totalPages={3} total={28} onPrevious={() => {}} onNext={onNext} />,
    );
    const previous = [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Previous"),
    );
    const next = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Next"));
    expect(previous?.hasAttribute("disabled") || previous?.getAttribute("aria-disabled") === "true").toBe(true);
    act(() => {
      next?.click();
    });
    expect(onNext).toHaveBeenCalledOnce();
    view.cleanup();
  });

  it("moves to the previous page and blocks the next button on the last page", () => {
    const onPrevious = vi.fn();
    const view = render(
      <AdminListPagination
        page={3}
        totalPages={3}
        total={28}
        disabled={false}
        onPrevious={onPrevious}
        onNext={() => {}}
      />,
    );
    const previous = [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Previous"),
    );
    const next = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Next"));
    expect(next?.hasAttribute("disabled") || next?.getAttribute("aria-disabled") === "true").toBe(true);
    act(() => {
      previous?.click();
    });
    expect(onPrevious).toHaveBeenCalledOnce();
    view.cleanup();
  });
});
