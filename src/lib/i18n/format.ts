import { localeToBcp47, type Locale } from "@/lib/i18n/locales";

/**
 * Locale-aware date formatting (`en` / `hi` → hi-IN).
 * Accepts Date or ISO string; invalid input returns empty string.
 */
export function formatDate(
  locale: Locale,
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeToBcp47(locale), options).format(date);
}

/**
 * Locale-aware number formatting (`en` / `hi` → hi-IN).
 * Non-finite numbers return empty string.
 */
export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(localeToBcp47(locale), options).format(value);
}

/** Convenience: format with fixed fraction digits (common for emissions). */
export function formatDecimal(locale: Locale, value: number, fractionDigits = 2): string {
  return formatNumber(locale, value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
