import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
vi.mock("../ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ render }: { render: React.ReactElement }) => render,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-window", () => ({
  Grid: ({
    cellComponent: Cell,
    cellProps,
    columnCount,
  }: {
    cellComponent: React.ComponentType<{
      columnIndex: number;
      rowIndex: number;
      style: React.CSSProperties;
      icons: string[];
      onChange: (icon: string) => void;
    }>;
    cellProps: { icons: string[]; onChange: (icon: string) => void };
    columnCount: number;
  }) => (
    <div>
      <Cell columnIndex={0} rowIndex={0} style={{}} {...cellProps} />
      <Cell columnIndex={columnCount - 1} rowIndex={999} style={{}} {...cellProps} />
    </div>
  ),
}));

import { IconPicker } from "./icon-picker";

describe("icon picker", () => {
  it("searches and selects an icon cell", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<IconPicker value="star" onChange={onChange} />);
    });

    const input = container.querySelector("input");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing search");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "star");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      setter?.call(input, "   ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const buttons = [...container.querySelectorAll("button")];
    if (buttons.length < 2) throw new Error(container.innerHTML.slice(0, 800));
    await act(async () => {
      for (const button of buttons) button.click();
    });
    expect(onChange).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
