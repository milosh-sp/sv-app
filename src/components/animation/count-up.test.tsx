import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("motion/react", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useInView: () => true };
});

import { CountUp } from "./count-up";

describe("CountUp", () => {
  it("formats decimals, runs downward, and notifies start and end", async () => {
    vi.useFakeTimers();
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CountUp
          from={1.5}
          to={2.25}
          direction="down"
          delay={0}
          duration={0}
          separator="."
          onStart={onStart}
          onEnd={onEnd}
        />,
      );
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(onStart).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalled();
    expect(container.textContent).toMatch(/1/);

    await act(async () => {
      root.render(<CountUp to={3} aria-hidden />);
    });
    expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.useRealTimers();
  });
});
