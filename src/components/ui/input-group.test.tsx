import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "./input-group";

describe("input group", () => {
  it("focuses the input unless the click landed on a button", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <InputGroup>
          <InputGroupInput aria-label="value" />
          <InputGroupAddon>
            <button type="button">x</button>
            <span>label</span>
          </InputGroupAddon>
          <InputGroupText>text</InputGroupText>
          <InputGroupButton>go</InputGroupButton>
          <InputGroupTextarea />
        </InputGroup>,
      );
    });

    const input = container.querySelector("input");
    const span = container.querySelector("span");
    const button = [...container.querySelectorAll("button")].find((item) => item.textContent === "x");
    await act(async () => {
      span?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.activeElement).toBe(input);
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector("textarea")).toBeTruthy();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
