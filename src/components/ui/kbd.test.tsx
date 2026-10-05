import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { Kbd, KbdGroup } from "./kbd";

describe("kbd", () => {
  it("groups keys", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
        </KbdGroup>,
      );
    });
    expect(container.textContent).toContain("Ctrl");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
