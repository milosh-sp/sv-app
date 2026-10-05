import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const view = vi.hoisted(() => ({ inView: true }));

vi.mock("motion/react", () => ({
  useInView: () => view.inView,
}));

import { FontDisplay } from "./font-display";

class FakeFontFace {
  constructor(
    public family: string,
    public source: string,
    public descriptors?: unknown,
  ) {}

  load() {
    return Promise.resolve(this);
  }
}

describe("font display", () => {
  it("loads a web font once it is on screen", async () => {
    vi.stubGlobal("FontFace", FakeFontFace);
    let known = false;
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        has: () => known,
        add: () => {
          known = true;
        },
      },
    });

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    view.inView = true;
    await act(async () => {
      root.render(<FontDisplay key="arial" name="Arial" type="local" />);
    });

    view.inView = false;
    await act(async () => {
      root.render(<FontDisplay key="one" name="Fresh One" type="web" url="/fresh-one.woff2" />);
    });

    view.inView = true;
    await act(async () => {
      root.render(<FontDisplay key="one" name="Fresh One" type="web" url="/fresh-one.woff2" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      root.render(<FontDisplay key="two" name="Fresh Two" type="web" url="/fresh-two.woff2" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      root.render(<FontDisplay key="none" name="No Url" type="web" />);
    });
    expect(container.textContent).toContain("No Url");

    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });
});
