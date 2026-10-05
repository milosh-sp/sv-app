import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const setThemeServerFn = vi.hoisted(() => vi.fn(async () => undefined));
const invalidate = vi.hoisted(() => vi.fn());

vi.mock("@/utils/theme", () => ({
  setThemeServerFn,
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

import { ThemeProvider, useTheme } from "./provider";

function Probe() {
  const theme = useTheme();
  return (
    <>
      <button type="button" onClick={() => theme.setTheme("dark")}>
        dark
      </button>
      <button type="button" onClick={() => theme.setTheme("light", { playSound: false })}>
        quiet
      </button>
      <button type="button" onClick={() => theme.setTheme("light")}>
        loud-light
      </button>
      <button type="button" onClick={() => theme.toggleTheme()}>
        toggle-default
      </button>
      <button type="button" onClick={() => theme.toggleTheme({ playSound: false })}>
        toggle
      </button>
    </>
  );
}

describe("theme provider", () => {
  it("applies the theme, skips sound when asked, and ignores a failed clip", async () => {
    const play = vi.fn(async () => undefined);
    vi.stubGlobal(
      "Audio",
      class {
        play = play;
      },
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ThemeProvider theme="light">
          <Probe />
        </ThemeProvider>,
      );
    });

    const click = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent === label);
      await act(async () => {
        button?.click();
      });
    };

    await click("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(setThemeServerFn).toHaveBeenCalledWith({ data: "dark" });
    expect(invalidate).toHaveBeenCalled();
    expect(play).toHaveBeenCalled();

    await click("quiet");
    expect(setThemeServerFn).toHaveBeenCalledWith({ data: "light" });
    await click("loud-light");
    expect(play).toHaveBeenCalled();
    await click("toggle");

    await act(async () => {
      root.render(
        <ThemeProvider theme="dark">
          <Probe />
        </ThemeProvider>,
      );
    });
    await click("toggle-default");
    expect(setThemeServerFn).toHaveBeenCalledWith({ data: "light" });

    play.mockRejectedValueOnce(new Error("no audio"));
    await click("dark");
    await click("toggle");
    expect(setThemeServerFn).toHaveBeenCalledWith({ data: "dark" });

    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("throws outside the provider", async () => {
    function Bare() {
      useTheme();
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await expect(
      act(async () => {
        root.render(<Bare />);
      }),
    ).rejects.toThrow("useTheme must be used within a ThemeProvider");
    root.unmount();
  });
});
