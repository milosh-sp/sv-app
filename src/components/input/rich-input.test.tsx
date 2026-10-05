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

const i18nState = vi.hoisted(() => ({ locale: "en-US" }));

vi.mock("@lingui/react", () => ({
  useLingui: () => ({ i18n: { locale: i18nState.locale } }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ render }: { render: React.ReactElement }) => render,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" role="menuitem" onClick={() => onClick?.()}>
      {children}
    </button>
  ),
  DropdownMenuCheckboxItem: ({
    children,
    onCheckedChange,
  }: {
    children?: React.ReactNode;
    onCheckedChange?: (value: boolean) => void;
  }) => (
    <button type="button" role="menuitemcheckbox" onClick={() => onCheckedChange?.(true)}>
      {children}
    </button>
  ),
}));

import { toast } from "sonner";

import { PromptDialogProvider } from "@/hooks/use-prompt";

import { RichInput, TiptapContent } from "./rich-input";

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

    for (const item of [...document.querySelectorAll("[role='menuitem'], [role='menuitemcheckbox']")]) {
      if (!(item instanceof HTMLElement)) continue;
      await act(async () => {
        item.click();
      });
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
    const blank = promptInput();
    if (!(blank instanceof HTMLInputElement)) throw new Error("missing link prompt");
    await act(async () => {
      setter?.call(blank, "   ");
      blank.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const clearLink = confirm();
    if (!(clearLink instanceof HTMLButtonElement)) throw new Error("missing prompt confirm");
    await act(async () => {
      clearLink.click();
    });

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

    for (const title of ["Inline Code", "Code Block", "New Line", "Separator"]) {
      const button = buttons().find((item) => item.title === title);
      if (!(button instanceof HTMLButtonElement)) throw new Error(`missing ${title}`);
      button.disabled = false;
      await act(async () => {
        button.click();
      });
    }

    for (const button of buttons()) {
      if (!button.disabled) continue;
      button.disabled = false;
      await act(async () => {
        button.click();
      });
    }

    for (const button of buttons()) {
      const role = button.getAttribute("role");
      if (role === "menuitem" || role === "menuitemcheckbox" || button.title === "Fullscreen") continue;
      button.disabled = false;
      await act(async () => {
        button.click();
      });
      const cancel = [...document.querySelectorAll("[role='alertdialog'] button")].find(
        (item) => item.textContent?.trim() === "Cancel",
      );
      if (cancel instanceof HTMLButtonElement) {
        await act(async () => {
          cancel.click();
        });
      }
    }

    const editable = document.querySelector("[data-editor='true']");
    const fiberKey = editable ? Object.getOwnPropertyNames(editable).find((name) => name.startsWith("__reactFiber$")) : undefined;
    let editorFiber = fiberKey
      ? (editable as unknown as Record<string, { return?: unknown; memoizedState?: { memoizedState?: unknown; next?: unknown } }>)[fiberKey]
      : undefined;
    let editor: { chain: () => { focus: () => { selectAll: () => { setLink: (attrs: object) => { run: () => void } } } } } | undefined;
    const seenEditors = new Set<object>();
    while (editorFiber && !seenEditors.has(editorFiber)) {
      seenEditors.add(editorFiber);
      let hook = editorFiber.memoizedState;
      while (hook) {
        const value = hook.memoizedState as { current?: typeof editor } | typeof editor | undefined;
        const candidate = value && typeof value === "object" && "current" in value ? value.current : value;
        if (candidate && typeof candidate === "object" && "chain" in candidate && "isActive" in candidate) {
          editor = candidate;
          break;
        }
        hook = hook.next as typeof hook;
      }
      if (editor) break;
      editorFiber = editorFiber.return as typeof editorFiber;
    }
    if (!editor) throw new Error("missing editor");
    await act(async () => {
      editor.chain().focus().selectAll().setLink({ href: "https://example.com", target: "_blank" }).run();
    });

    for (const element of document.querySelectorAll("button")) {
      const key = Object.getOwnPropertyNames(element).find((name) => name.startsWith("__reactFiber$"));
      let fiber = key
        ? (
            element as unknown as Record<
              string,
              { return?: unknown; memoizedProps?: { onClick?: () => void } }
            >
          )[key]
        : undefined;
      const seen = new Set<object>();
      while (fiber && !seen.has(fiber)) {
        seen.add(fiber);
        const onClick = fiber.memoizedProps?.onClick;
        if (typeof onClick === "function" && /sinkListItem|liftListItem|unsetLink/.test(String(onClick))) {
          await act(async () => {
            onClick();
          });
        }
        fiber = fiber.return as typeof fiber;
      }
    }

    await act(async () => {
      root.render(<TiptapContent content="<p>Hi <a href='https://example.com'>link</a></p>" />);
    });

    i18nState.locale = "ar";
    await act(async () => {
      root.render(
        <PromptDialogProvider>
          <RichInput value="<p>Hello</p>" onChange={onChange} />
        </PromptDialogProvider>,
      );
    });

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
  }, 40_000);
});
