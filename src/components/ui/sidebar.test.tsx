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

import { Sidebar, SidebarProvider, SidebarTrigger } from "./sidebar";

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
});
