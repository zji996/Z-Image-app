import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { translations, type Locale, type TranslationKey, type TranslationValues } from "./translations";

export type Translator = (key: TranslationKey, values?: TranslationValues) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translator;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const STORAGE_KEY = "zimage_locale";

const detectLocale = (): Locale => {
  if (typeof navigator === "undefined") {
    return "en";
  }
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  const match = candidates?.find((lang) => lang?.toLowerCase().startsWith("zh"));
  return match ? "zh" : "en";
};

const getStoredLocale = (): Locale | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = window.localStorage?.getItem(STORAGE_KEY);
    return value === "en" || value === "zh" ? (value as Locale) : null;
  } catch {
    return null;
  }
};

const persistLocale = (locale: Locale) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage?.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore persistence errors (e.g. private mode)
  }
};

const formatMessage = (template: string, values?: TranslationValues) => {
  if (!values) {
    return template;
  }
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? "" : String(value);
  });
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getStoredLocale() ?? detectLocale());

  const translate = useCallback<Translator>(
    (key, values) => {
      const localeTable = translations[locale] ?? translations.en;
      const template = localeTable[key] ?? translations.en[key] ?? key;
      return formatMessage(template, values);
    },
    [locale],
  );

  const changeLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale: changeLocale,
    t: translate,
  }), [changeLocale, locale, translate]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
