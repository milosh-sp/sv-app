import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));

import { PromptDialogProvider, usePrompt } from "./use-prompt";

function Harness({ onReady }: { onReady: (prompt: ReturnType<typeof usePrompt>) => void }) {
  onReady(usePrompt());
  return null;
}

async function renderPrompt() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let prompt: ReturnType<typeof usePrompt> | undefined;
  await act(async () => {
    root.render(
      <PromptDialogProvider>
        <Harness onReady={(value) => (prompt = value)} />
      </PromptDialogProvider>,
    );
  });
  return { root, container, prompt: prompt! };
}

function setInput(value: string) {
  const input = document.querySelector("input");
  if (!input) throw new Error("prompt input missing");
  // oxlint-disable-next-line typescript/unbound-method -- native setter must be called with the input as this
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input;
}

describe("prompt dialog", () => {
  it("returns the submitted value and null on cancel", async () => {
    const view = await renderPrompt();

    const submitted = view.prompt("Rename", { defaultValue: "  Ada  " });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      document.querySelector<HTMLElement>("[data-slot='alert-dialog-action']")?.click();
    });
    await expect(submitted).resolves.toBe("  Ada  ");

    const typed = view.prompt("Rename");
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      setInput("CV");
    });
    await act(async () => {
      document.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await expect(typed).resolves.toBe("CV");

    const cancelled = view.prompt("Rename", { defaultValue: "Ada" });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      document.querySelector<HTMLElement>("[data-slot='alert-dialog-cancel']")?.click();
    });
    await expect(cancelled).resolves.toBeNull();

    view.root.unmount();
    view.container.remove();
  });

  it("throws outside the provider", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await expect(
      act(async () => {
        root.render(<Harness onReady={() => undefined} />);
      }),
    ).rejects.toThrow("usePrompt must be used within");
    root.unmount();
  });
});
