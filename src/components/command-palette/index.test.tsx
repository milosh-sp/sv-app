import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const hotkeys = vi.hoisted(() => ({
  map: new Map<string, (event: { preventDefault: () => void }) => void>(),
}));
const flags = vi.hoisted(() => ({ attachRef: true }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((result, part, index) => result + part + String(values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: (key: string | string[], callback: (event: { preventDefault: () => void }) => void) => {
    hotkeys.map.set(JSON.stringify(key), callback);
  },
}));
vi.mock("./pages/navigation", () => ({ NavigationCommandGroup: () => null }));
vi.mock("./pages/preferences", () => ({ PreferencesCommandGroup: () => null }));
vi.mock("./pages/resumes", () => ({ ResumesCommandGroup: () => null }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange?: (open: boolean) => void }) => (
    <div>
      <button type="button" onClick={() => onOpenChange?.(false)}>
        dialog-close
      </button>
      {children}
    </div>
  ),
  DialogContent: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: ({
    onValueChange,
    ref,
  }: {
    onValueChange?: (value: string) => void;
    ref?: React.Ref<HTMLInputElement>;
  }) => <input ref={flags.attachRef ? ref : undefined} onChange={(event) => onValueChange?.(event.target.value)} />,
}));

import { useCommandPaletteStore } from "./store";
import { CommandPalette } from "./index";

function hotkey(key: string | string[]) {
  return hotkeys.map.get(JSON.stringify(key));
}

describe("command palette", () => {
  it("handles shortcuts, search, and nested pages", async () => {
    useCommandPaletteStore.setState({ open: false, search: "", pages: [] });
    flags.attachRef = false;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const render = async () => {
      await act(async () => {
        root.render(<CommandPalette />);
      });
    };
    await render();

    const prevented = { preventDefault: vi.fn() };
    hotkey("backspace")?.(prevented);
    hotkey("escape")?.(prevented);
    hotkey(["meta+k", "ctrl+k"])?.(prevented);
    expect(useCommandPaletteStore.getState().open).toBe(true);

    await render();
    hotkey("backspace")?.(prevented);

    flags.attachRef = true;
    await render();
    hotkey("backspace")?.(prevented);

    const input = container.querySelector("input");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing search");
    input.focus();
    useCommandPaletteStore.getState().setSearch("resume");
    await render();
    hotkey("backspace")?.(prevented);

    useCommandPaletteStore.getState().setSearch("");
    useCommandPaletteStore.getState().pushPage("theme");
    await render();
    expect(container.querySelector("[aria-label]")?.getAttribute("aria-label")).toContain("theme");
    hotkey("backspace")?.(prevented);
    expect(prevented.preventDefault).toHaveBeenCalled();

    useCommandPaletteStore.getState().setOpen(true);
    await render();
    hotkey("escape")?.(prevented);
    expect(useCommandPaletteStore.getState().open).toBe(false);

    useCommandPaletteStore.getState().setOpen(true);
    await render();
    hotkey(["meta+k", "ctrl+k"])?.(prevented);
    expect(useCommandPaletteStore.getState().open).toBe(false);

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      container.querySelector("button")?.click();
      setter?.call(input, "find");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
