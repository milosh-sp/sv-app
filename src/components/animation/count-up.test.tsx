import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const springHooks = vi.hoisted(() => ({ listeners: [] as Array<(value: number) => void> }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("motion/react");
  return {
    ...actual,
    useInView: () => true,
    useSpring: (...args: Parameters<typeof actual.useSpring>) => {
      const spring = actual.useSpring(...args);
      const originalOn = spring.on.bind(spring);
      spring.on = ((event: string, callback: (value: number) => void) => {
        if (event === "change") springHooks.listeners.push(callback);
        return originalOn(event, callback);
      }) as typeof spring.on;
      return spring;
    },
  };
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
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();

    await act(async () => {
      root.render(<CountUp to={4} duration={0} startWhen={false} />);
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(onEnd).toHaveBeenCalled();

    root.unmount();
    container.remove();
    for (const listener of springHooks.listeners) listener(1);
    vi.useRealTimers();
  });
});
