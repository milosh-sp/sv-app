globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const viewport = vi.hoisted(() => ({ mobile: false, width: 1200 }));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => viewport.mobile,
}));
vi.mock("usehooks-ts", () => ({
  useWindowSize: () => ({ width: viewport.width, height: 800 }),
}));

import { useBuilderSidebar, useBuilderSidebarStore } from "./sidebar";

function panel() {
  return {
    isCollapsed: vi.fn(() => true),
    resize: vi.fn(),
    collapse: vi.fn(),
  };
}

describe("builder sidebar", () => {
  beforeEach(() => {
    viewport.mobile = false;
    viewport.width = 1200;
    useBuilderSidebarStore.setState({
      leftSidebar: null,
      leftSheetOpen: false,
      rightSidebar: null,
      rightSheetOpen: false,
    });
  });

  it("opens and closes the desktop sidebars", async () => {
    const left = panel();
    const right = panel();
    right.isCollapsed.mockReturnValue(false);
    useBuilderSidebarStore.getState().setLeftSidebar({ current: left } as never);
    useBuilderSidebarStore.getState().setRightSidebar({ current: right } as never);

    const seen: { collapsed: boolean; max: string | number } = { collapsed: true, max: 0 };
    function Probe() {
      const sidebar = useBuilderSidebar();
      seen.collapsed = sidebar.isCollapsed("left");
      seen.max = sidebar.maxSidebarSize;
      return (
        <button
          type="button"
          onClick={() => {
            sidebar.toggleSidebar("left");
            sidebar.toggleSidebar("right", false);
            sidebar.toggleSidebar("left", true);
          }}
        >
          toggle
        </button>
      );
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<Probe />);
    });
    expect(seen.max).toBe("28%");
    expect(seen.collapsed).toBe(true);

    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(left.resize).toHaveBeenCalledWith("22%");
    expect(right.collapse).toHaveBeenCalled();

    viewport.width = 0;
    await act(async () => {
      root.render(<Probe />);
    });
    expect(seen.max).toBe(0);

    useBuilderSidebarStore.getState().setLeftSidebar(null);
    await act(async () => {
      root.render(<Probe />);
    });
    expect(seen.collapsed).toBe(false);

    root.unmount();
    container.remove();
  });

  it("opens and closes the mobile sheets", async () => {
    viewport.mobile = true;
    let open = false;
    function Probe() {
      const sidebar = useBuilderSidebar((state) => state.toggleSidebar);
      open = useBuilderSidebarStore((state) => state.leftSheetOpen);
      return (
        <button
          type="button"
          onClick={() => {
            sidebar("left");
            sidebar("right", true);
          }}
        >
          toggle
        </button>
      );
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<Probe />);
    });
    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(useBuilderSidebarStore.getState().leftSheetOpen).toBe(true);
    expect(useBuilderSidebarStore.getState().rightSheetOpen).toBe(true);
    expect(open).toBe(true);

    root.unmount();
    container.remove();
  });
});
