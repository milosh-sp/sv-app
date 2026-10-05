import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./dropdown-menu";

describe("dropdown menu", () => {
  it("renders the portal, label, radio item, and shortcut", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Label</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuRadioGroup>
                <DropdownMenuRadioItem value="a">Radio</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>,
      );
    });
    expect(document.body.textContent).toContain("Label");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
