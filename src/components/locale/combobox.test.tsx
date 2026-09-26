import { i18n } from "@lingui/core";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  msg: (strings: TemplateStringsArray) => ({ id: strings[0] }),
  t: (strings: TemplateStringsArray) => strings[0],
}));

const { getLocaleOptions } = await import("./combobox");

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
});
