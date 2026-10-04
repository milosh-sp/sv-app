import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray | { message?: string }, ...values: Array<string | number>) => {
    if (!Array.isArray(strings)) return "message" in strings ? (strings.message ?? "") : "";
    return strings.reduce((result, part, index) => result + part + (values[index] ?? ""), "");
  },
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock("@lingui/react", () => ({
  useLingui: () => ({ i18n: { locale: "en-US" } }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from "sonner";

import { PromptDialogProvider } from "@/hooks/use-prompt";

import { RichInput } from "./rich-input";

const rect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  top: 0,
  left: 0,
  bottom: 1,
  right: 1,
  toJSON() {
    return {};
  },
};

beforeAll(() => {
  // ponytail: jsdom has no layout, prosemirror only needs a rect to scroll the selection
  const rects = () => [rect] as unknown as DOMRectList;
  Element.prototype.getClientRects = rects;
  Element.prototype.getBoundingClientRect = () => rect as DOMRect;
  (Text.prototype as unknown as { getClientRects: typeof rects }).getClientRects = rects;
  Range.prototype.getClientRects = rects;
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  document.elementFromPoint = () => document.body;
});

function buttons() {
  return [...document.querySelectorAll("button")].filter((button) => button instanceof HTMLButtonElement);
}

describe("rich input", () => {
  it("applies toolbar marks, toggles fullscreen, and validates links", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PromptDialogProvider>
          <RichInput value="<p>Hello</p>" onChange={onChange} />
        </PromptDialogProvider>,
      );
    });

    expect(buttons().length).toBeGreaterThan(5);
    expect(document.body.textContent).toContain("Hello");

    for (const trigger of [...document.querySelectorAll("[data-slot='dropdown-menu-trigger']")]) {
      if (!(trigger instanceof HTMLElement)) continue;
      act(() => {
        trigger.click();
      });
      for (const item of [...document.querySelectorAll("[role='menuitem'], [role='menuitemcheckbox']")]) {
        if (!(item instanceof HTMLElement)) continue;
        await act(async () => {
          item.click();
        });
      }
    }

    const promptInput = () => document.querySelector("[role='alertdialog'] input");
    let link: HTMLButtonElement | undefined;

    for (const button of buttons()) {
      if (button.disabled || button.title === "Fullscreen") continue;
      await act(async () => {
        button.click();
      });
      if (promptInput()) {
        link = button;
        break;
      }
    }

    const input = promptInput();
    if (!(input instanceof HTMLInputElement)) throw new Error("missing link prompt");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    const confirm = () =>
      [...document.querySelectorAll("[role='alertdialog'] button")].find(
        (button) => button.textContent?.trim() === "Confirm",
      );

    await act(async () => {
      setter?.call(input, "notaurl");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const reject = confirm();
    if (!(reject instanceof HTMLButtonElement)) throw new Error("missing prompt confirm");
    await act(async () => {
      reject.click();
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalled();

    if (!(link instanceof HTMLButtonElement)) throw new Error("missing link");
    await act(async () => {
      link.click();
    });
    const valid = promptInput();
    if (!(valid instanceof HTMLInputElement)) throw new Error("missing link prompt");
    await act(async () => {
      setter?.call(valid, "https://example.com");
      valid.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const accept = confirm();
    if (!(accept instanceof HTMLButtonElement)) throw new Error("missing prompt confirm");
    await act(async () => {
      accept.click();
    });
    expect(onChange).toHaveBeenCalled();

    const fullscreen = buttons().find((button) => button.title === "Fullscreen");
    if (!(fullscreen instanceof HTMLButtonElement)) throw new Error("missing fullscreen");
    await act(async () => {
      fullscreen.click();
    });
    expect(document.body.textContent).toContain("Fullscreen Editor");

    act(() => {
      root.unmount();
    });
    container.remove();
  }, 20_000);
});
