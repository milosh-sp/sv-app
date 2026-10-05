import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { Slider } from "./slider";

describe("slider", () => {
  it("uses the value, the default, or the min and max", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <>
          <Slider value={[20]} />
          <Slider defaultValue={[10, 30]} />
          <Slider />
        </>,
      );
    });
    expect(container.querySelectorAll("[data-slot='slider-thumb']").length).toBeGreaterThan(2);
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
