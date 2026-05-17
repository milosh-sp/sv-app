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
        French: "French",
        Spanish: "Spanish",
      },
    });

    const englishLabels = getOptionLabels();
    expect(englishLabels.get("en-US")).toBe("English");
    expect(englishLabels.get("fr-FR")).toBe("French");
    expect(englishLabels.get("es-ES")).toBe("Spanish");

    i18n.loadAndActivate({
      locale: "fr-FR",
      messages: {
        English: "Anglais",
        French: "Français",
        Spanish: "Espagnol",
      },
    });

    const frenchLabels = getOptionLabels();
    expect(frenchLabels.get("en-US")).toBe("Anglais");
    expect(frenchLabels.get("fr-FR")).toBe("Français");
    expect(frenchLabels.get("es-ES")).toBe("Espagnol");

    i18n.loadAndActivate({
      locale: "es-ES",
      messages: {
        English: "Inglés",
        French: "Francés",
        Spanish: "Español",
      },
    });

    const spanishLabels = getOptionLabels();
    expect(spanishLabels.get("en-US")).toBe("Inglés");
    expect(spanishLabels.get("fr-FR")).toBe("Francés");
    expect(spanishLabels.get("es-ES")).toBe("Español");
  });
});
