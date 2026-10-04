import { i18n, type MessageDescriptor, type Messages } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { createIsomorphicFn, createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import Cookies from "js-cookie";
import z from "zod";

const localeSchema = z.union([z.literal("en-US"), z.literal("de-DE"), z.literal("es-ES"), z.literal("ru-RU")]);

export type Locale = z.infer<typeof localeSchema>;

const storageKey = "locale";
const defaultLocale: Locale = "en-US";

export const localeMap = {
  "en-US": msg`English`,
  "de-DE": msg`German`,
  "es-ES": msg`Spanish`,
  "ru-RU": msg`Russian`,
} satisfies Record<Locale, MessageDescriptor>;

export function isLocale(locale: string): locale is Locale {
  return localeSchema.safeParse(locale).success;
}

const RTL_LANGUAGES = new Set([
  "ar", // Arabic
  "ckb", // Kurdish (Sorani)
  "dv", // Dhivehi
  "fa", // Persian
  "he", // Hebrew
  "ps", // Pashto
  "sd", // Sindhi
  "ug", // Uyghur
  "ur", // Urdu
  "yi", // Yiddish
]);

export function isRTL(locale: string): boolean {
  const language = locale.split("-")[0].toLowerCase();
  return RTL_LANGUAGES.has(language);
}

export const getLocale = createIsomorphicFn()
  .client(() => {
    const locale = Cookies.get(storageKey);
    if (!locale || !isLocale(locale)) return defaultLocale;
    return locale;
  })
  .server(async () => {
    const cookieLocale = getCookie(storageKey);
    if (!cookieLocale || !isLocale(cookieLocale)) return defaultLocale;
    return cookieLocale;
  });

export const setLocaleServerFn = createServerFn({ method: "POST" })
  .validator(localeSchema)
  .handler(async ({ data }) => {
    setCookie(storageKey, data);
  });

const loadMessages = async (locale: Locale) => {
  const catalogs = {
    "en-US": () => import("../../locales/en-US.po"),
    "de-DE": () => import("../../locales/de-DE.po"),
    "es-ES": () => import("../../locales/es-ES.po"),
    "ru-RU": () => import("../../locales/ru-RU.po"),
  } satisfies Record<Locale, () => Promise<{ messages: Messages }>>;
  const { messages } = await catalogs[locale]();
  return messages;
};

export const loadLocale = async (locale: string) => {
  const activeLocale = isLocale(locale) ? locale : defaultLocale;

  const messages = await loadMessages(activeLocale);
  if (activeLocale === defaultLocale) {
    i18n.loadAndActivate({ locale: activeLocale, messages });
    return;
  }

  const defaultMessages = await loadMessages(defaultLocale);
  const translatedMessages = Object.fromEntries(Object.entries(messages).filter(([, message]) => message !== ""));

  i18n.loadAndActivate({ locale: activeLocale, messages: { ...defaultMessages, ...translatedMessages } });
};
