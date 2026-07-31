import { getMessages } from "@/lib/i18n/messages";
import type { MessageTree } from "@/lib/i18n/messages";
import { resolveLocale, type Locale } from "@/lib/i18n/locales";

export type TranslateParams = Record<string, string | number>;

/**
 * Look up a dotted key in a message tree.
 * Returns undefined when the path is missing or lands on a nested object.
 */
export function lookupMessage(tree: MessageTree, key: string): string | undefined {
  if (!key) return undefined;
  const parts = key.split(".");
  let cur: string | MessageTree | undefined = tree;
  for (const part of parts) {
    if (cur == null || typeof cur === "string") return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Translate a key against a message tree.
 * Missing keys return the key itself (safe fallback — never throws).
 */
export function t(messages: MessageTree, key: string, params?: TranslateParams): string {
  const raw = lookupMessage(messages, key);
  if (raw === undefined) return key;
  return interpolate(raw, params);
}

/** Build a bound translator for a locale (server or client). */
export function createTranslator(locale: Locale) {
  const messages = getMessages(locale);
  return (key: string, params?: TranslateParams) => t(messages, key, params);
}

/**
 * Resolve locale from unknown input and return a translator.
 * Prefer {@link createTranslator} when the locale is already validated.
 */
export function translatorFor(value: unknown) {
  return createTranslator(resolveLocale(value));
}
