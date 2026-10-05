import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./context-menu";

describe("context menu", () => {
  it("renders every slot", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ContextMenu open>
          <ContextMenuTrigger>Open</ContextMenuTrigger>
          <ContextMenuPortal>
            <ContextMenuContent>
              <ContextMenuGroup>
                <ContextMenuLabel>Label</ContextMenuLabel>
                <ContextMenuItem>Item</ContextMenuItem>
                <ContextMenuCheckboxItem checked>Check</ContextMenuCheckboxItem>
                <ContextMenuRadioGroup>
                  <ContextMenuRadioItem value="a">Radio</ContextMenuRadioItem>
                </ContextMenuRadioGroup>
                <ContextMenuSeparator />
                <ContextMenuShortcut>⌘K</ContextMenuShortcut>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
                  <ContextMenuSubContent>Nested</ContextMenuSubContent>
                </ContextMenuSub>
              </ContextMenuGroup>
            </ContextMenuContent>
          </ContextMenuPortal>
        </ContextMenu>,
      );
    });
    expect(document.body.textContent).toContain("Item");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
