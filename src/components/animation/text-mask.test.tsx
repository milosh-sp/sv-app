import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  },
);

import { TextMaskEffect } from "./text-mask";

describe("text mask", () => {
  it("tracks hover and pointer movement", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<TextMaskEffect text="Skill" />);
    });

    const svg = container.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) throw new Error("missing svg");
    svg.getBoundingClientRect = () =>
      ({
        width: 300,
        height: 40,
        left: 0,
        top: 0,
        right: 300,
        bottom: 40,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      }) as DOMRect;

    await act(async () => {
      svg.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 30, clientY: 10 }));
      svg.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 40, clientY: 12 }));
    });
    expect(svg.getAttribute("style") ?? container.innerHTML).toBeTruthy();

    await act(async () => {
      svg.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
