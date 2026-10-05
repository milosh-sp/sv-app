import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

import { ErrorScreen } from "./error-screen";

describe("error screen", () => {
  it("shows an Error message and stringifies anything else", async () => {
    const reset = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ErrorScreen error={new Error("boom")} reset={reset} />);
    });
    expect(container.textContent).toContain("boom");
    await act(async () => {
      container.querySelector("button")?.click();
    });
    expect(reset).toHaveBeenCalled();

    await act(async () => {
      root.render(<ErrorScreen error={"plain" as never} reset={reset} />);
    });
    expect(container.textContent).toContain("plain");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
