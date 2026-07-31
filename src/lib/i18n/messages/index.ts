import { en } from "@/lib/i18n/messages/en";
import { hi } from "@/lib/i18n/messages/hi";
import { DEFAULT_LOCALE, type Locale, resolveLocale } from "@/lib/i18n/locales";

export type MessageTree = {
  [key: string]: string | MessageTree;
};

const catalogs: Record<Locale, MessageTree> = {
  en,
  hi,
};

export function getMessages(locale: Locale): MessageTree {
  return catalogs[locale] ?? catalogs[DEFAULT_LOCALE];
}

/** Resolve locale then return its message catalog (safe for unknown input). */
export function messagesFor(value: unknown): MessageTree {
  return getMessages(resolveLocale(value));
}
