/** Supported UI locales. F24b: `en` + `hi` + `fr`. */
export const SUPPORTED_LOCALES = ["en", "hi", "fr"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Options shown in Settings → Language. */
export const LOCALE_OPTIONS: ReadonlyArray<{ value: Locale; labelKey: string }> = [
  { value: "en", labelKey: "settings.language.english" },
  { value: "hi", labelKey: "settings.language.hindi" },
  { value: "fr", labelKey: "settings.language.french" },
];

export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Resolve a stored / requested locale to a supported one.
 * Unknown or missing values fall back to {@link DEFAULT_LOCALE}.
 */
export function resolveLocale(value: unknown): Locale {
  if (isSupportedLocale(value)) return value;
  return DEFAULT_LOCALE;
}

/** Map app locale → BCP 47 tag for Intl formatters. */
export function localeToBcp47(locale: Locale): string {
  switch (locale) {
    case "en":
      return "en";
    case "hi":
      return "hi-IN";
    case "fr":
      return "fr-FR";
    default: {
      const _exhaustive: never = locale;
      return _exhaustive;
    }
  }
}
