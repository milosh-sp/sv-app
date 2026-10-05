import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/react", () => ({
  useLingui: () => ({ i18n: { t: () => "Language" } }),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@/components/ui/command", () => ({
  CommandItem: ({ onSelect, children }: { onSelect?: () => void; children?: React.ReactNode }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  CommandGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/utils/locale", () => ({
  localeMap: {
    "en-US": "English",
    "de-DE": "German",
    "es-ES": "Spanish",
    "ru-RU": "Russian",
  },
  loadLocale: vi.fn(async () => undefined),
  setLocaleServerFn: vi.fn(async () => undefined),
}));

import { loadLocale, setLocaleServerFn } from "@/utils/locale";

import { useCommandPaletteStore } from "../../store";
import { LanguageCommandPage } from "./language";

describe("language command page", () => {
  it("loads the selected locale", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    useCommandPaletteStore.setState({ open: true, search: "", pages: ["language"] });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<LanguageCommandPage />);
    });

    const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes("en-US"));
    await act(async () => {
      button?.click();
    });
    expect(loadLocale).toHaveBeenCalledWith("en-US");
    expect(setLocaleServerFn).toHaveBeenCalledWith({ data: "en-US" });
    expect(reload).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });
});
