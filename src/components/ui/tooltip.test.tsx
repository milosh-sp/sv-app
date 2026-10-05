import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

describe("tooltip", () => {
  it("uses the default open delay", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>tip</TooltipTrigger>
            <TooltipContent>hello</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );
    });
    expect(container.textContent).toContain("tip");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
