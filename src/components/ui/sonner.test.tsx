import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("../theme/provider", () => ({
  useTheme: () => ({ theme: "dark" }),
}));
vi.mock("sonner", () => ({
  Toaster: ({ theme, icons }: { theme?: string; icons?: { success?: React.ReactNode } }) => (
    <div data-theme={theme}>{icons?.success}</div>
  ),
}));

import { Toaster } from "./sonner";

describe("toaster", () => {
  it("follows the active theme", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<Toaster />);
    });
    expect(container.querySelector("[data-theme='dark']")).toBeTruthy();
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
