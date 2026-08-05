import { en } from "@/lib/i18n/messages/en";
import { fr } from "@/lib/i18n/messages/fr";
import { hi } from "@/lib/i18n/messages/hi";
import { DEFAULT_LOCALE, type Locale, resolveLocale } from "@/lib/i18n/locales";

export type MessageTree = {
  [key: string]: string | MessageTree;
};

function deepMerge(base: MessageTree, overlay: MessageTree): MessageTree {
  const out: MessageTree = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const existing = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

const catalogs: Record<Locale, MessageTree> = {
  en,
  hi,
  fr: deepMerge(en, fr),
};

export function getMessages(locale: Locale): MessageTree {
  return catalogs[locale] ?? catalogs[DEFAULT_LOCALE];
}

/** Resolve locale then return its message catalog (safe for unknown input). */
export function messagesFor(value: unknown): MessageTree {
  return getMessages(resolveLocale(value));
}
