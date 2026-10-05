import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { useControlledState } from "./use-controlled-state";

function Probe({ value }: { value?: string }) {
  const [state] = useControlledState({ value, defaultValue: "fallback" });
  return <span>{state}</span>;
}

describe("useControlledState", () => {
  it("adopts a new controlled value", async () => {
    const el = document.createElement("div");
    const root = createRoot(el);

    await act(async () => {
      root.render(<Probe value="a" />);
    });
    expect(el.textContent).toBe("a");

    await act(async () => {
      root.render(<Probe value="b" />);
    });
    expect(el.textContent).toBe("b");

    await act(async () => {
      root.render(<Probe />);
    });
    expect(el.textContent).toBe("b");

    await act(async () => {
      root.unmount();
    });
  });
});
