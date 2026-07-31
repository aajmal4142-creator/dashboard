"use client";

import { useState, useTransition } from "react";

import { AppSelectNative } from "@/components/ui/AppField";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  LOCALE_OPTIONS,
  isSupportedLocale,
  resolveLocale,
  type Locale,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  initialLanguage: Locale;
};

export function SettingsLanguageClient({ initialLanguage }: Props) {
  const { t, locale: activeLocale } = useI18n();
  const [language, setLanguage] = useState<Locale>(() => resolveLocale(initialLanguage));
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "neutral">("neutral");
  const [pending, startTransition] = useTransition();

  function note(message: string, tone: "ok" | "error" | "neutral" = "neutral") {
    setStatus(message);
    setStatusTone(tone);
  }

  function save() {
    note(t("settings.language.saving"), "neutral");
    startTransition(async () => {
      const res = await fetch("/api/app/settings/language", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        language?: string;
      };
      if (!res.ok) {
        note(data.error ?? t("settings.language.error"), "error");
        return;
      }
      if (data.language && isSupportedLocale(data.language)) {
        setLanguage(data.language);
      }
      note(t("settings.language.saved"), "ok");
      // Reload so I18nProvider picks up the saved preference.
      if (data.language && data.language !== activeLocale) {
        window.location.reload();
      }
    });
  }

  return (
    <section className="mb-10">
      <div className="max-w-xl">
        <h2 className="font-display text-xl text-ink">{t("settings.language.title")}</h2>
        <div className="title-rule mt-2" />
        <p className="mt-3 text-sm text-ink-muted">{t("settings.language.help")}</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <AppSelectNative
            label={t("settings.language.label")}
            name="language"
            value={language}
            disabled={pending}
            onChange={(e) => {
              const next = resolveLocale(e.target.value);
              setLanguage(next);
              setStatus(null);
            }}
            className="min-w-[12rem]"
          >
            {LOCALE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </AppSelectNative>
          <Button type="button" variant="outline" disabled={pending} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
        {status ? (
          <p
            className={cn(
              "mt-3 text-sm",
              statusTone === "ok" && "text-signal",
              statusTone === "error" && "text-rust",
              statusTone === "neutral" && "text-ink-muted",
            )}
            role="status"
          >
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}
