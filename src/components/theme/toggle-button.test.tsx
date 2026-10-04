import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const toggleTheme = vi.hoisted(() => vi.fn());
const theme = vi.hoisted(() => ({ value: "dark" as "dark" | "light" }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));

vi.mock("./provider", () => ({
  useTheme: () => ({ theme: theme.value, toggleTheme }),
}));

import { ThemeToggleButton } from "./toggle-button";

describe("theme toggle", () => {
  it("toggles immediately when motion is reduced, and animates otherwise", async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ThemeToggleButton />);
    });

    const button = container.querySelector("button");
    if (!(button instanceof HTMLButtonElement)) throw new Error("missing theme toggle");
    expect(button.getAttribute("aria-label")).toContain("light");
    await act(async () => {
      button.click();
    });
    expect(toggleTheme).toHaveBeenCalledTimes(1);

    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    document.startViewTransition = ((callback: () => void) => {
      callback();
      return { ready: Promise.resolve() };
    }) as typeof document.startViewTransition;
    document.documentElement.animate = (() => ({ cancel: () => undefined })) as unknown as typeof document.documentElement.animate;

    theme.value = "light";
    vi.useFakeTimers();
    await act(async () => {
      root.render(<ThemeToggleButton />);
    });
    await act(async () => {
      button.click();
    });
    expect(toggleTheme).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    vi.useRealTimers();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
