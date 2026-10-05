import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { Progress, ProgressLabel, ProgressValue } from "./progress";

describe("progress", () => {
  it("renders the label and value", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Progress value={40}>
          <ProgressLabel>Loading</ProgressLabel>
          <ProgressValue />
        </Progress>,
      );
    });
    expect(container.textContent).toContain("Loading");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
