import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("../ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@uiw/react-color-colorful", () => ({
  default: ({ onChange }: { onChange: (color: { hsva: { h: number; s: number; v: number; a: number } }) => void }) => (
    <button type="button" onClick={() => onChange({ hsva: { h: 200, s: 50, v: 80, a: 1 } })}>
      pick
    </button>
  ),
}));

import { ColorPicker } from "./color-picker";

describe("color picker", () => {
  it("writes the picked color", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ColorPicker defaultValue="rgba(0, 0, 0, 1)" onChange={onChange} />);
    });
    await act(async () => {
      container.querySelector("button")?.click();
    });
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("rgba"));
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
