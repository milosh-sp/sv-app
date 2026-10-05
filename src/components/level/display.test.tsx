import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("../resume/shared/page-icon", () => ({
  PageIcon: ({ icon }: { icon: string }) => <i>{icon}</i>,
}));

import { LevelDisplay } from "./display";

const types = ["progress-bar", "icon", "circle", "rectangle", "rectangle-full", "square"] as const;

describe("level display", () => {
  it("renders each design and hides an empty level", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LevelDisplay level={0} type="circle" icon="star" />);
    });
    expect(container.childElementCount).toBe(0);

    await act(async () => {
      root.render(<LevelDisplay level={3} type="hidden" icon="star" />);
    });
    expect(container.childElementCount).toBe(0);

    await act(async () => {
      root.render(<LevelDisplay level={3} type="circle" icon="" />);
    });
    expect(container.childElementCount).toBe(0);

    for (const type of types) {
      await act(async () => {
        root.render(<LevelDisplay level={3} type={type} icon="star" />);
      });
      expect(container.querySelector("[role='presentation']")).toBeTruthy();
    }

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
