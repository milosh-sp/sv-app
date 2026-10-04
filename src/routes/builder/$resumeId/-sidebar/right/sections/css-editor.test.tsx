import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const monacoState = vi.hoisted(() => ({
  providers: [] as Array<{
    provideCompletionItems: (
      model: {
        getValueInRange: () => string;
        getWordUntilPosition: () => { startColumn: number; endColumn: number };
      },
      position: { lineNumber: number; column: number },
    ) => { suggestions: Array<{ label: string }> };
  }>,
}));

vi.mock("@monaco-editor/react", () => ({
  useMonaco: () => ({
    languages: {
      CompletionItemKind: { Class: 7 },
      registerCompletionItemProvider: (_language: string, provider: (typeof monacoState.providers)[number]) => {
        monacoState.providers.push(provider);
        return { dispose: vi.fn() };
      },
    },
  }),
  default: () => <div>editor</div>,
}));

import CSSMonacoEditor from "./css-editor";

describe("css editor completions", () => {
  it("suggests resume selectors after a dot and nothing for other text", async () => {
    monacoState.providers = [];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<CSSMonacoEditor theme="dark" defaultValue=".page" onChange={() => undefined} />);
    });

    const provider = monacoState.providers[0];
    if (!provider) throw new Error("missing completion provider");
    const position = { lineNumber: 1, column: 4 };
    const word = { startColumn: 1, endColumn: 4 };

    const suggestions = provider.provideCompletionItems(
      {
        getValueInRange: () => ".page",
        getWordUntilPosition: () => word,
      },
      position,
    );
    expect(suggestions.suggestions.map((item) => item.label)).toContain(".page");

    expect(
      provider.provideCompletionItems(
        {
          getValueInRange: () => "color",
          getWordUntilPosition: () => word,
        },
        position,
      ).suggestions,
    ).toEqual([]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
