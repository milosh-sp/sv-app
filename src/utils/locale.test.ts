import { describe, expect, it, vi } from "vite-plus/test";

// Mock @lingui/core/macro since the `msg` macro requires babel transformation
vi.mock("@lingui/core/macro", () => ({
  msg: (strings: TemplateStringsArray) => ({ id: strings[0] }),
}));

// Import after mock setup
const { isLocale, isRTL } = await import("./locale");

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
