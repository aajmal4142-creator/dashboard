"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  createTranslator,
  formatDate,
  formatDecimal,
  formatNumber,
  resolveLocale,
  type Locale,
  type TranslateParams,
} from "@/lib/i18n";

type I18nValue = {
  locale: Locale;
  t: (key: string, params?: TranslateParams) => string;
  formatDate: (
    value: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDecimal: (value: number, fractionDigits?: number) => string;
};

const defaultLocale: Locale = "en";
const defaultTranslate = createTranslator(defaultLocale);

const I18nContext = createContext<I18nValue>({
  locale: defaultLocale,
  t: defaultTranslate,
  formatDate: (value, options) => formatDate(defaultLocale, value, options),
  formatNumber: (value, options) => formatNumber(defaultLocale, value, options),
  formatDecimal: (value, digits) => formatDecimal(defaultLocale, value, digits),
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale | string | null | undefined;
  children: ReactNode;
}) {
  const resolved = resolveLocale(locale);
  const value = useMemo<I18nValue>(() => {
    const translate = createTranslator(resolved);
    return {
      locale: resolved,
      t: translate,
      formatDate: (v, options) => formatDate(resolved, v, options),
      formatNumber: (v, options) => formatNumber(resolved, v, options),
      formatDecimal: (v, digits) => formatDecimal(resolved, v, digits),
    };
  }, [resolved]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function useT() {
  return useI18n().t;
}
