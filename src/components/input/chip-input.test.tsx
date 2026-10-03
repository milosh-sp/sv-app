import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

import { ChipInput } from "./chip-input";

function setInput(value: string) {
  const input = document.querySelector("input");
  if (!input) throw new Error("chip input missing");
  // oxlint-disable-next-line typescript/unbound-method -- native setter must be called with the input as this
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input;
}

describe("chip input", () => {
  it("adds, edits, and removes keywords", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ChipInput defaultValue={["Rust"]} onChange={onChange} />);
    });

    const input = setInput("  Go  ");
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(["Rust", "Go"]);

    await act(async () => {
      root.render(<ChipInput value={["Rust", "Go"]} onChange={onChange} />);
    });
    await act(async () => {
      setInput("   ");
      document.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await act(async () => {
      setInput("TypeScript, Zig,");
    });
    expect(onChange).toHaveBeenCalledWith(["Rust", "Go", "TypeScript"]);
    expect(onChange).toHaveBeenCalledWith(["Rust", "Go", "Zig"]);

    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Edit Go']")?.click();
    });
    await act(async () => {
      setInput("Golang,");
    });
    expect(onChange).toHaveBeenCalledWith(["Rust", "Golang", "Zig"]);

    await act(async () => {
      root.render(<ChipInput value={["Rust", "Golang"]} onChange={onChange} />);
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Edit Golang']")?.click();
    });
    await act(async () => {
      setInput("Rust");
      document.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Edit Golang']")?.click();
    });
    await act(async () => {
      document.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Edit Golang']")?.click();
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Remove Golang']")?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(["Rust"]);

    root.unmount();
    container.remove();
  });
});
