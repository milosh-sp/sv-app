import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxRoot,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from "./combobox";

describe("combobox slots", () => {
  it("renders the input, chips, and list slots", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Combobox
          options={[
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
          ]}
          value="a"
          onValueChange={() => undefined}
        />,
      );
    });
    expect(container.textContent).toContain("Alpha");

    await act(async () => {
      root.render(
        <ComboboxRoot>
          <ComboboxInput showClear showTrigger placeholder="Search" />
          <ComboboxTrigger>Open</ComboboxTrigger>
          <ComboboxValue />
          <ComboboxChips>
            <ComboboxChip>Alpha</ComboboxChip>
            <ComboboxChipsInput />
          </ComboboxChips>
          <ComboboxContent>
            <ComboboxList>
              <ComboboxEmpty>None</ComboboxEmpty>
              <ComboboxGroup>
                <ComboboxLabel>Group</ComboboxLabel>
                <ComboboxItem value="a">Alpha</ComboboxItem>
              </ComboboxGroup>
              <ComboboxSeparator />
            </ComboboxList>
          </ComboboxContent>
        </ComboboxRoot>,
      );
    });
    expect(document.body.textContent).toContain("Open");

    root.unmount();
    container.remove();
  });
});
