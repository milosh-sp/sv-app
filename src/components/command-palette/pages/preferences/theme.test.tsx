import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const setTheme = vi.hoisted(() => vi.fn());

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@/components/theme/provider", () => ({
  useTheme: () => ({ setTheme }),
}));
vi.mock("@/components/ui/command", () => ({
  CommandItem: ({ onSelect, children }: { onSelect?: () => void; children?: React.ReactNode }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  CommandGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { useCommandPaletteStore } from "../../store";
import { ThemeCommandPage } from "./theme";

describe("theme command page", () => {
  it("switches theme without sound and closes the palette", async () => {
    useCommandPaletteStore.setState({ open: true, search: "", pages: ["theme"] });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ThemeCommandPage />);
    });

    const click = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(label));
      await act(async () => {
        button?.click();
      });
    };

    await click("Light");
    expect(setTheme).toHaveBeenCalledWith("light", { playSound: false });
    expect(useCommandPaletteStore.getState().open).toBe(false);

    useCommandPaletteStore.setState({ open: true, search: "", pages: ["theme"] });
    await act(async () => {
      root.render(<ThemeCommandPage />);
    });
    await click("Dark");
    expect(setTheme).toHaveBeenCalledWith("dark", { playSound: false });

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
