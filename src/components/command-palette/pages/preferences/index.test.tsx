import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@/components/ui/command", () => ({
  CommandItem: ({ onSelect, children }: { onSelect?: () => void; children?: React.ReactNode }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  CommandGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("./language", () => ({ LanguageCommandPage: () => null }));
vi.mock("./theme", () => ({ ThemeCommandPage: () => null }));

import { useCommandPaletteStore } from "../../store";
import { PreferencesCommandGroup } from "./index";

describe("preference commands", () => {
  it("opens the theme and language pages", async () => {
    useCommandPaletteStore.setState({ open: true, search: "", pages: [] });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<PreferencesCommandGroup />);
    });

    const click = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(label));
      await act(async () => {
        button?.click();
      });
    };
    await click("theme");
    expect(useCommandPaletteStore.getState().peekPage()).toBe("theme");
    await act(async () => {
      useCommandPaletteStore.getState().popPage();
    });
    await click("language");
    expect(useCommandPaletteStore.getState().peekPage()).toBe("language");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
