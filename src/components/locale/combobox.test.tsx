import { i18n } from "@lingui/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import * as localeUtils from "@/utils/locale";

vi.mock("@lingui/core/macro", () => ({
  msg: (strings: TemplateStringsArray) => ({ id: strings[0] }),
  t: (strings: TemplateStringsArray) => strings[0],
}));
vi.mock("@lingui/react", () => ({
  useLingui: () => ({ i18n: { locale: "en-US" } }),
}));
vi.mock("../ui/combobox", () => ({
  Combobox: ({
    onValueChange,
    defaultValue,
  }: {
    onValueChange?: (value: string | null) => void;
    defaultValue?: string;
  }) => (
    <div>
      <span>{defaultValue}</span>
      <button type="button" onClick={() => onValueChange?.(null)}>
        clear
      </button>
      <button type="button" onClick={() => onValueChange?.("nope")}>
        bad
      </button>
      <button type="button" onClick={() => onValueChange?.("de-DE")}>
        german
      </button>
    </div>
  ),
}));
const { getLocaleOptions, LocaleCombobox } = await import("./combobox");

function getOptionLabels() {
  return new Map(getLocaleOptions().map((option) => [option.value, String(option.label)]));
}

describe("LocaleCombobox options", () => {
  it("updates visible language names when the selected UI language changes", () => {
    i18n.loadAndActivate({
      locale: "en-US",
      messages: {
        English: "English",
        German: "German",
        Spanish: "Spanish",
      },
    });

    const englishLabels = getOptionLabels();
    expect(englishLabels.get("en-US")).toBe("English");
    expect(englishLabels.get("de-DE")).toBe("German");
    expect(englishLabels.get("es-ES")).toBe("Spanish");

    i18n.loadAndActivate({
      locale: "de-DE",
      messages: {
        English: "Englisch",
        German: "Deutsch",
        Spanish: "Spanisch",
      },
    });

    const germanLabels = getOptionLabels();
    expect(germanLabels.get("en-US")).toBe("Englisch");
    expect(germanLabels.get("de-DE")).toBe("Deutsch");
    expect(germanLabels.get("es-ES")).toBe("Spanisch");

    i18n.loadAndActivate({
      locale: "es-ES",
      messages: {
        English: "Inglés",
        German: "Alemán",
        Spanish: "Español",
      },
    });

    const spanishLabels = getOptionLabels();
    expect(spanishLabels.get("en-US")).toBe("Inglés");
    expect(spanishLabels.get("de-DE")).toBe("Alemán");
    expect(spanishLabels.get("es-ES")).toBe("Español");
  });

  it("reloads for a real locale and ignores anything else", async () => {
    vi.spyOn(localeUtils, "loadLocale").mockResolvedValue(undefined);
    vi.spyOn(localeUtils, "setLocaleServerFn").mockResolvedValue(undefined);
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<LocaleCombobox />);
    });
    const click = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent === label);
      await act(async () => {
        button?.click();
      });
    };
    await click("clear");
    await click("bad");
    expect(localeUtils.loadLocale).not.toHaveBeenCalled();
    await click("german");
    expect(localeUtils.loadLocale).toHaveBeenCalledWith("de-DE");
    expect(localeUtils.setLocaleServerFn).toHaveBeenCalledWith({ data: "de-DE" });
    expect(reload).toHaveBeenCalled();
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });
});
