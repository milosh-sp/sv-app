import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { BreakpointIndicator } from "./breakpoint-indicator";

describe("breakpoint indicator", () => {
  it("places the badge in each corner", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const positions = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

    for (const position of positions) {
      await act(async () => {
        root.render(<BreakpointIndicator position={position} />);
      });
      expect(container.textContent).toContain("XS");
    }

    await act(async () => {
      root.render(<BreakpointIndicator />);
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
