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

  it("reorders chips when a drag ends on another chip", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ChipInput value={["Rust", "Go"]} onChange={onChange} />);
    });

    const node = container.firstElementChild ?? container;
    const key = Object.keys(node).find((name) => name.startsWith("__reactFiber$"));
    const start = key
      ? (
          node as unknown as Record<
            string,
            {
              child?: unknown;
              sibling?: unknown;
              memoizedProps?: { onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void };
            }
          >
        )[key]
      : undefined;
    const stack = start ? [start] : [];
    const seen = new Set<object>();
    let onDragEnd: ((event: { active: { id: string }; over: { id: string } | null }) => void) | undefined;
    while (stack.length > 0) {
      const fiber = stack.pop();
      if (!fiber || seen.has(fiber)) continue;
      seen.add(fiber);
      if (fiber.memoizedProps?.onDragEnd) onDragEnd = fiber.memoizedProps.onDragEnd;
      if (fiber.child) stack.push(fiber.child as typeof fiber);
      if (fiber.sibling) stack.push(fiber.sibling as typeof fiber);
    }
    if (!onDragEnd) throw new Error("missing drag end");
    act(() => {
      onDragEnd?.({ active: { id: "Rust" }, over: null });
      onDragEnd?.({ active: { id: "Rust" }, over: { id: "Rust" } });
      onDragEnd?.({ active: { id: "missing" }, over: { id: "Go" } });
      onDragEnd?.({ active: { id: "Rust" }, over: { id: "Go" } });
    });
    expect(onChange).toHaveBeenCalledWith(["Go", "Rust"]);

    root.unmount();
    container.remove();
  });
});
