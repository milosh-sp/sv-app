import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { CometCard } from "./comet-card";

describe("comet card", () => {
  it("follows the pointer and resets when the pointer leaves", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<CometCard className="card">comet</CometCard>);
    });

    const card = container.querySelector(".relative");
    if (!(card instanceof HTMLElement)) throw new Error("missing card");
    card.getBoundingClientRect = () =>
      ({
        width: 200,
        height: 100,
        left: 10,
        top: 20,
        right: 210,
        bottom: 120,
        x: 10,
        y: 20,
        toJSON() {
          return {};
        },
      }) as DOMRect;

    await act(async () => {
      card.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 110, clientY: 70 }));
      card.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      card.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    });
    expect(container.textContent).toContain("comet");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
