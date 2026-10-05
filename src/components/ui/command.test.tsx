import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

import { Command, CommandDialog, CommandSeparator, CommandShortcut } from "./command";

describe("command", () => {
  it("renders the dialog defaults, separator, and shortcut", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <>
          <Command>
            <CommandSeparator />
            <CommandShortcut>⌘K</CommandShortcut>
          </Command>
          <CommandDialog open>Search</CommandDialog>
        </>,
      );
    });
    expect(document.body.textContent).toContain("Command Palette");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
