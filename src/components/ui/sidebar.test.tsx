import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const mobile = vi.hoisted(() => ({ value: false }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mobile.value,
}));

import { TooltipProvider } from "./tooltip";
import {
  Sidebar,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebarState,
} from "./sidebar";

function key(combo: { key: string; ctrlKey?: boolean }) {
  window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...combo }));
}

describe("sidebar", () => {
  it("toggles from the button, the keyboard, and a controlled open state", async () => {
    mobile.value = false;
    const onOpenChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SidebarProvider>
          <Sidebar>
            <SidebarTrigger />
          </Sidebar>
        </SidebarProvider>,
      );
    });

    const trigger = container.querySelector("[data-slot='sidebar-trigger']");
    if (!(trigger instanceof HTMLButtonElement)) throw new Error("missing sidebar trigger");
    await act(async () => {
      trigger.click();
    });
    expect(document.cookie).toContain("sidebar_state=false");

    await act(async () => {
      key({ key: "b", ctrlKey: true });
    });
    expect(document.cookie).toContain("sidebar_state=true");

    await act(async () => {
      root.render(
        <SidebarProvider open onOpenChange={onOpenChange}>
          <Sidebar collapsible="none">plain</Sidebar>
          <SidebarTrigger onClick={() => undefined} />
        </SidebarProvider>,
      );
    });
    expect(container.textContent).toContain("plain");
    const controlled = container.querySelector("[data-slot='sidebar-trigger']");
    await act(async () => {
      if (controlled instanceof HTMLButtonElement) controlled.click();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    mobile.value = true;
    await act(async () => {
      root.render(
        <SidebarProvider>
          <Sidebar>mobile</Sidebar>
          <SidebarTrigger />
        </SidebarProvider>,
      );
    });
    const mobileTrigger = container.querySelector("[data-slot='sidebar-trigger']");
    await act(async () => {
      if (mobileTrigger instanceof HTMLButtonElement) mobileTrigger.click();
      key({ key: "b", ctrlKey: true });
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the remaining slots and both tooltip shapes", async () => {
    mobile.value = false;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    function OpenFlag() {
      const { setOpen } = useSidebarState();
      return (
        <button type="button" onClick={() => setOpen(false)}>
          set-closed
        </button>
      );
    }

    await act(async () => {
      root.render(
        <TooltipProvider>
          <SidebarProvider defaultOpen={false}>
            <Sidebar variant="floating" side="right">
              <SidebarFooter>
                <SidebarInput />
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Tip">Tip</SidebarMenuButton>
                    <SidebarMenuAction />
                    <SidebarMenuAction showOnHover>x</SidebarMenuAction>
                    <SidebarMenuBadge>1</SidebarMenuBadge>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip={{ children: "Obj" }}>Obj</SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuSkeleton />
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton>sub</SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenu>
              </SidebarFooter>
            </Sidebar>
            <Sidebar variant="inset" />
            <SidebarInset>main</SidebarInset>
            <SidebarGroup>
              <SidebarGroupAction>group</SidebarGroupAction>
            </SidebarGroup>
            <OpenFlag />
          </SidebarProvider>
        </TooltipProvider>,
      );
    });
    expect(container.textContent).toContain("main");
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "set-closed")?.click();
      key({ key: "a" });
      key({ key: "b" });
    });

    mobile.value = true;
    await act(async () => {
      root.render(
        <TooltipProvider>
          <SidebarProvider defaultOpen={false}>
            <SidebarMenuButton tooltip="Tip">mobile</SidebarMenuButton>
          </SidebarProvider>
        </TooltipProvider>,
      );
    });

    mobile.value = false;
    await act(async () => {
      root.render(
        <SidebarProvider>
          <SidebarMenuButton>plain</SidebarMenuButton>
        </SidebarProvider>,
      );
    });

    function Bare() {
      useSidebarState();
      return null;
    }
    await expect(
      act(async () => {
        root.render(<Bare />);
      }),
    ).rejects.toThrow("useSidebarState must be used within a SidebarProvider.");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
