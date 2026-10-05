import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("./font-display", () => ({
  FontDisplay: ({ name }: { name: string }) => <span>{name}</span>,
}));
vi.mock("../ui/combobox", () => ({
  Combobox: ({ options }: { options?: Array<{ label: React.ReactNode }> }) => <div>{options?.[0]?.label}</div>,
}));

import { FontFamilyCombobox, FontWeightCombobox, getNextWeights } from "./combobox";

describe("typography combobox", () => {
  it("builds weight lists for web, local, and unknown families", async () => {
    expect(getNextWeights("missing-font")).toBeNull();
    expect(getNextWeights("Roboto")).toEqual(["400", "600"]);
    expect(getNextWeights("Gravitas One")).toEqual(["400"]);
    expect(getNextWeights("Computer Modern Bright")).toEqual(["400", "700"]);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <>
          <FontFamilyCombobox />
          <FontWeightCombobox fontFamily="Roboto" />
          <FontWeightCombobox fontFamily="Arial" />
          <FontWeightCombobox fontFamily="Nope" />
        </>,
      );
    });
    expect(container.textContent).toBeTruthy();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
