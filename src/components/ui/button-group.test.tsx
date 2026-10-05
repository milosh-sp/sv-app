import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "./button-group";

describe("button group", () => {
  it("renders text and the default separator", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ButtonGroup>
          <ButtonGroupText>text</ButtonGroupText>
          <ButtonGroupText render={<span />}>via</ButtonGroupText>
          <ButtonGroupSeparator />
        </ButtonGroup>,
      );
    });
    expect(container.textContent).toContain("text");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
