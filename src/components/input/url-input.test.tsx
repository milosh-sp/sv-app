import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("../ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ render }: { render: React.ReactElement }) => render,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { URLInput } from "./url-input";

function setValue(element: Element | null, value: string) {
  if (!(element instanceof HTMLInputElement)) throw new Error("missing input");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("url input", () => {
  it("updates the label and stops clicks inside the popover", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<URLInput value={{ url: "https://example.com", label: "Site" }} onChange={onChange} />);
    });

    await act(async () => {
      setValue(container.querySelector("#url-label"), "Docs");
    });
    expect(onChange).toHaveBeenCalledWith({ url: "https://example.com", label: "Docs" });

    const grid = container.querySelector(".grid");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    const stop = vi.spyOn(event, "stopPropagation");
    await act(async () => {
      grid?.dispatchEvent(event);
    });
    expect(stop).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
