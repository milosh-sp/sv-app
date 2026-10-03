import Cookies from "js-cookie";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vite-plus/test";

// Mock @lingui/core/macro since the `msg` macro requires babel transformation
vi.mock("@lingui/core/macro", () => ({
  msg: (strings: TemplateStringsArray) => ({ id: strings[0] }),
}));

// Import after mock setup
const { getLocale, isLocale, isRTL } = await import("./locale");

describe("isLocale", () => {
  it("should return true for valid locales", () => {
    expect(isLocale("en-US")).toBe(true);
    expect(isLocale("de-DE")).toBe(true);
    expect(isLocale("es-ES")).toBe(true);
    expect(isLocale("ru-RU")).toBe(true);
  });

  it("should return false for hidden locales", () => {
    expect(isLocale("fr-FR")).toBe(false);
    expect(isLocale("zh-CN")).toBe(false);
  });

  it("should return false for invalid locales", () => {
    expect(isLocale("xx-YY")).toBe(false);
    expect(isLocale("english")).toBe(false);
    expect(isLocale("")).toBe(false);
  });
});

describe("isRTL", () => {
  it("should return true for RTL languages", () => {
    expect(isRTL("ar-SA")).toBe(true);
    expect(isRTL("he-IL")).toBe(true);
    expect(isRTL("fa-IR")).toBe(true);
    expect(isRTL("ur-PK")).toBe(true);
  });

  it("should return false for LTR languages", () => {
    expect(isRTL("en-US")).toBe(false);
    expect(isRTL("fr-FR")).toBe(false);
    expect(isRTL("zh-CN")).toBe(false);
  });
});

describe("getLocale", () => {
  it("reads a valid cookie and falls back otherwise", () => {
    Cookies.set("locale", "de-DE");
    expect(getLocale()).toBe("de-DE");

    Cookies.set("locale", "nope");
    expect(getLocale()).toBe("en-US");

    Cookies.remove("locale");
    expect(getLocale()).toBe("en-US");
  });
});

// Plural categories legitimately differ per language, so only depth-0 argument names are compared.
const topLevelArgs = (message: string) => {
  const args: string[] = [];
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    if (message[i] === "{") {
      if (depth === 0) args.push(/^\{\s*([^\s,{}]+)/.exec(message.slice(i))?.[1] ?? "");
      depth++;
    } else if (message[i] === "}") depth--;
  }
  return args.sort();
};

describe("locale catalogs", () => {
  const dir = resolve(process.cwd(), "locales");

  it("should keep the same placeholders as the source message", () => {
    const mismatches: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".po"))) {
      const catalog = readFileSync(resolve(dir, file), "utf8");
      // ponytail: single-line msgid/msgstr pairs only; multi-line entries (just the header today) are skipped.
      for (const [, id, str] of catalog.matchAll(/msgid "((?:[^"\\]|\\.)*)"\nmsgstr "((?:[^"\\]|\\.)*)"/g)) {
        if (str && topLevelArgs(id).join() !== topLevelArgs(str).join()) mismatches.push(`${file}: ${str}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
