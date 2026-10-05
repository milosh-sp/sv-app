import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const drag = vi.hoisted(() => ({ isDragging: false }));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/sortable")>();
  return {
    ...actual,
    useSortable: (args: { id: string }) => {
      const result = actual.useSortable(args);
      return { ...result, isDragging: drag.isDragging };
    },
  };
});

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

  it("covers hover, empty edits, and reordering while a chip is being edited", async () => {
    drag.isDragging = true;
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ChipInput value={["Rust", "Go", "Zig"]} onChange={onChange} />);
    });

    const chip = container.querySelector(".touch-none");
    if (!(chip instanceof HTMLElement)) throw new Error("missing chip");
    const propKey = Object.keys(chip).find((name) => name.startsWith("__reactProps$"));
    const chipProps = propKey ? (chip as unknown as Record<string, { onMouseEnter?: () => void; onMouseLeave?: () => void }>)[propKey] : undefined;
    if (!chipProps?.onMouseEnter) throw new Error("missing hover handler");
    await act(async () => {
      chipProps.onMouseEnter?.();
    });
    await act(async () => {
      chipProps.onMouseLeave?.();
    });

    const input = () => {
      const field = setInput(",");
      return field;
    };
    await act(async () => {
      input();
    });
    await act(async () => {
      setInput("a");
      document.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
      document.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Edit Zig']")?.click();
    });
    await act(async () => {
      setInput("   ");
      document.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Edit Zig']")?.click();
    });
    await act(async () => {
      setInput(",");
    });

    await act(async () => {
      root.render(<ChipInput value={["Rust", "Go", "Zig"]} onChange={onChange} />);
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Edit Zig']")?.click();
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Remove Rust']")?.click();
    });

    await act(async () => {
      root.render(<ChipInput value={["Rust", "Go", "Zig"]} onChange={onChange} />);
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Edit Rust']")?.click();
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Remove Zig']")?.click();
    });

    await act(async () => {
      root.render(<ChipInput value={["Rust", "Go"]} onChange={onChange} />);
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Edit Go']")?.click();
    });
    await act(async () => {
      root.render(<ChipInput value={["Rust"]} onChange={onChange} />);
    });
    await act(async () => {
      setInput("Later,");
    });

    const props = walkProps(container);
    const onRemove = props.find((item) => typeof item.onRemove === "function")?.onRemove as
      | ((index: number) => void)
      | undefined;
    const onDragEnd = props.find((item) => typeof item.onDragEnd === "function")?.onDragEnd as
      | ((event: { active: { id: string }; over: { id: string } | null }) => void)
      | undefined;
    act(() => {
      onRemove?.(-1);
      onRemove?.(99);
    });

    await act(async () => {
      root.render(<ChipInput value={["Rust", "Go", "Zig"]} onChange={onChange} />);
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Edit Go']")?.click();
    });
    const dragging = walkProps(container).find((item) => typeof item.onDragEnd === "function")?.onDragEnd as
      | ((event: { active: { id: string }; over: { id: string } | null }) => void)
      | undefined;
    act(() => {
      dragging?.({ active: { id: "Zig" }, over: { id: "Rust" } });
      dragging?.({ active: { id: "Go" }, over: { id: "Zig" } });
    });
    await act(async () => {
      root.render(<ChipInput value={["Rust", "Go", "Zig"]} onChange={onChange} />);
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[aria-label='Edit Rust']")?.click();
    });
    const parked = walkProps(container).find((item) => typeof item.onDragEnd === "function")?.onDragEnd as
      | ((event: { active: { id: string }; over: { id: string } | null }) => void)
      | undefined;
    if (!parked) throw new Error("missing drag end while editing");
    act(() => {
      parked({ active: { id: "Go" }, over: { id: "Zig" } });
      parked({ active: { id: "Rust" }, over: { id: "Zig" } });
    });
    expect(onDragEnd).toBeTypeOf("function");

    drag.isDragging = false;
    root.unmount();
    container.remove();
  });
});

function walkProps(container: HTMLElement) {
  const node = container.firstElementChild ?? container;
  const key = Object.keys(node).find((name) => name.startsWith("__reactFiber$"));
  const start = key
    ? (node as unknown as Record<string, { child?: unknown; sibling?: unknown; memoizedProps?: Record<string, unknown> }>)[
        key
      ]
    : undefined;
  const stack = start ? [start] : [];
  const seen = new Set<object>();
  const props: Array<Record<string, unknown>> = [];
  while (stack.length > 0) {
    const fiber = stack.pop();
    if (!fiber || seen.has(fiber)) continue;
    seen.add(fiber);
    if (fiber.memoizedProps) props.push(fiber.memoizedProps);
    if (fiber.child) stack.push(fiber.child as typeof fiber);
    if (fiber.sibling) stack.push(fiber.sibling as typeof fiber);
  }
  return props;
}
