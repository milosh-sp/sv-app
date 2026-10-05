import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const setTheme = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());

vi.mock("@lingui/react", () => ({
  useLingui: () => ({ i18n: { t: () => "label" } }),
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));
vi.mock("./provider", () => ({
  useTheme: () => ({ theme: "dark", setTheme }),
}));
vi.mock("../ui/combobox", () => ({
  Combobox: ({ onValueChange }: { onValueChange?: (value: string | null) => void }) => (
    <div>
      <button type="button" onClick={() => onValueChange?.(null)}>
        clear
      </button>
      <button type="button" onClick={() => onValueChange?.("nope")}>
        bad
      </button>
      <button type="button" onClick={() => onValueChange?.("light")}>
        light
      </button>
    </div>
  ),
}));
vi.mock("@/utils/theme", () => ({
  isTheme: (value: string) => value === "light" || value === "dark",
  themeMap: { light: "Light", dark: "Dark" },
  setThemeServerFn: vi.fn(async () => undefined),
}));

import { setThemeServerFn } from "@/utils/theme";

import { ThemeCombobox } from "./combobox";

describe("theme combobox", () => {
  it("applies a real theme and ignores other values", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ThemeCombobox />);
    });

    const click = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent === label);
      await act(async () => {
        button?.click();
      });
    };

    await click("clear");
    await click("bad");
    expect(setTheme).not.toHaveBeenCalled();
    await click("light");
    expect(setThemeServerFn).toHaveBeenCalledWith({ data: "light" });
    expect(setTheme).toHaveBeenCalledWith("light");
    expect(invalidate).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
