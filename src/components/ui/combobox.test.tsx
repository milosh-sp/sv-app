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
    ComboboxCollection,
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

    await act(async () => {
      root.render(
        <ComboboxRoot open items={[{ value: "a", label: "Alpha" }]}>
          <ComboboxTrigger>Open slots</ComboboxTrigger>
          <ComboboxContent>
            <ComboboxGroup>
              <ComboboxLabel>Labels</ComboboxLabel>
              <ComboboxItem value="a">Alpha</ComboboxItem>
            </ComboboxGroup>
            <ComboboxEmpty>None</ComboboxEmpty>
            <ComboboxSeparator />
            <ComboboxCollection>
              {(item: { value?: string }) => <span>{String(item?.value ?? "")}</span>}
            </ComboboxCollection>
          </ComboboxContent>
        </ComboboxRoot>,
      );
    });
    await act(async () => {
      document.querySelector<HTMLElement>("[data-slot='combobox-trigger']")?.click();
    });
    expect(document.body.textContent).toContain("Labels");

    await act(async () => {
      root.render(
        <>
          <Combobox
            multiple
            options={[
              { value: "a", label: "Alpha", keywords: ["first"] },
              { value: "b", label: <em>Beta</em> },
            ]}
            value={["a", "missing"]}
            onValueChange={() => undefined}
            showClear
          />
          <Combobox multiple options={[{ value: "a", label: "Alpha" }]} value={null as unknown as string[]} />
          <Combobox options={[{ value: "a", label: "Alpha" }]} defaultValue="a" showClear={false} />
        </>,
      );
    });

    const filters = walkProps(container)
      .filter((item) => typeof item.itemToStringLabel === "function" && typeof item.filter === "function")
      .map(
        (item) =>
          item.filter as (
            option: { value: string; label: React.ReactNode; keywords?: string[] },
            query: string,
          ) => boolean,
      );
    if (filters.length === 0) {
      const keys = [...new Set(walkProps(document.body).flatMap((item) => Object.keys(item)))].slice(0, 30);
      throw new Error(`no filter: ${keys.join(",")}`);
    }
    for (const filter of filters) {
      filter({ value: "b", label: <em>Beta</em>, keywords: ["beta"] }, "beta");
      filter({ value: "b", label: <em>Beta</em> }, "nope");
      filter({ value: "a", label: "Alpha" }, "alpha");
    }
    expect(container.textContent).toContain("Alpha");

    root.unmount();
    container.remove();
  });
});

function walkProps(container: HTMLElement) {
  const nodes = [container, ...document.querySelectorAll("*")];
  const stack: Array<{
    child?: unknown;
    sibling?: unknown;
    return?: unknown;
    memoizedProps?: Record<string, unknown>;
  }> = [];
  for (const node of nodes) {
    const key = Object.keys(node).find((name) => name.startsWith("__reactFiber$"));
    const start = key
      ? (node as unknown as Record<string, { child?: unknown; sibling?: unknown; memoizedProps?: Record<string, unknown> }>)[key]
      : undefined;
    if (start) stack.push(start);
  }
  const seen = new Set<object>();
  const props: Array<Record<string, unknown>> = [];
  while (stack.length > 0) {
    const fiber = stack.pop();
    if (!fiber || seen.has(fiber)) continue;
    seen.add(fiber);
    if (fiber.memoizedProps) props.push(fiber.memoizedProps);
    if (fiber.child) stack.push(fiber.child as typeof fiber);
    if (fiber.sibling) stack.push(fiber.sibling as typeof fiber);
    if (fiber.return) stack.push(fiber.return as typeof fiber);
  }
  return props;
}
