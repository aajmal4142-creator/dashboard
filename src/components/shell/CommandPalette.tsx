"use client";

import { Command } from "cmdk";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { useRouter } from "nextjs-toploader/app";
import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { buildNavGroups } from "@/components/shell/navConfig";
import { detectShortcutPlatform, formatShortcutLabel } from "@/lib/keyboard";
import {
  loadRecentSearches,
  pushRecentSearch,
  SEARCH_TYPES,
  typeLabel,
  type RecentSearch,
  type SearchResponse,
  type SearchResult,
  type SearchResultType,
} from "@/lib/search";
import { cn } from "@/lib/utils";

type SavedSearchItem = {
  id: string;
  name: string;
  query: string;
  type: SearchResultType | null;
  isOwner: boolean;
};

const TYPE_FILTERS: Array<{ id: SearchResultType | "all"; label: string }> = [
  { id: "all", label: "All" },
  ...SEARCH_TYPES.map((t) => ({ id: t, label: typeLabel(t) })),
];

type PaletteProps = {
  orgType: "company" | "consultancy" | null;
  onboarded: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organisationId?: string | null;
};

/** Unmounts when closed so open-session state resets without setState-in-effect. */
export function CommandPalette(props: PaletteProps) {
  if (!props.open) return null;
  return <CommandPaletteOpen {...props} />;
}

function CommandPaletteOpen({
  orgType,
  onboarded,
  onOpenChange,
  organisationId = null,
}: PaletteProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [platform, setPlatform] = useState<"mac" | "win">("mac");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SearchResultType | "all">("all");
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [apiStatus, setApiStatus] = useState<"idle" | "loading" | "error" | "ready">(
    "idle",
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentSearch[]>(() =>
    organisationId ? loadRecentSearches(organisationId) : [],
  );
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const groups = useMemo(
    () => buildNavGroups({ orgType, onboarded }),
    [orgType, onboarded],
  );
  const searchLabel = formatShortcutLabel({ key: "k", metaOrCtrl: true }, platform);
  const helpLabel = formatShortcutLabel({ key: "/", metaOrCtrl: true }, platform);
  const qTrim = query.trim();
  const searchActive = qTrim.length >= 2;

  useEffect(() => {
    void Promise.resolve().then(() => {
      setPlatform(detectShortcutPlatform());
    });
  }, []);

  useEffect(() => {
    if (!organisationId) return;
    const controller = new AbortController();
    void fetch("/api/app/search/saved", { signal: controller.signal })
      .then((res) =>
        res.ok ? (res.json() as Promise<{ searches?: SavedSearchItem[] }>) : null,
      )
      .then((data) => setSavedSearches(data?.searches ?? []))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSavedSearches([]);
      });
    return () => controller.abort();
  }, [organisationId]);

  useEffect(() => {
    if (!searchActive) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setApiStatus("loading");
      setApiError(null);

      const params = new URLSearchParams({ q: qTrim, limit: "20" });
      if (typeFilter !== "all") params.set("type", typeFilter);

      void fetch(`/api/app/search?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(body?.error ?? `Search failed (${res.status})`);
          }
          return res.json() as Promise<SearchResponse>;
        })
        .then((data) => {
          setApiResults(data.results ?? []);
          setApiStatus("ready");
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setApiResults([]);
          setApiStatus("error");
          setApiError(
            err instanceof Error
              ? err.message
              : "Search failed. Check your connection and try again.",
          );
        });
    }, 150);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [qTrim, searchActive, typeFilter]);

  function updateQuery(next: string) {
    setQuery(next);
    setSaveStatus("idle");
  }

  function updateTypeFilter(next: SearchResultType | "all") {
    setTypeFilter(next);
    setSaveStatus("idle");
  }

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function rememberAndGo(result: SearchResult) {
    if (organisationId && qTrim.length >= 2) {
      setRecent(pushRecentSearch(organisationId, qTrim, result.type));
    }
    go(result.href);
  }

  function applyRecent(item: RecentSearch) {
    updateQuery(item.query);
    updateTypeFilter(item.type ?? "all");
  }

  function applySaved(item: SavedSearchItem) {
    updateQuery(item.query);
    updateTypeFilter(item.type ?? "all");
  }

  async function saveCurrentSearch() {
    if (!organisationId || qTrim.length < 2 || saveStatus === "saving") return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/app/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: qTrim.slice(0, 100),
          query: qTrim,
          type: typeFilter === "all" ? null : typeFilter,
        }),
      });
      if (!res.ok) throw new Error("Failed to save search");
      const data = (await res.json()) as { search?: SavedSearchItem };
      if (data.search) {
        setSavedSearches((prev) => [data.search as SavedSearchItem, ...prev]);
      }
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  async function deleteSavedSearch(id: string) {
    const prev = savedSearches;
    setSavedSearches((list) => list.filter((s) => s.id !== id));
    try {
      const res = await fetch(`/api/app/search/saved?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete saved search");
    } catch {
      setSavedSearches(prev);
    }
  }

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        aria-label={t("commandPalette.close")}
        onClick={() => onOpenChange(false)}
      />
      <div className="relative mx-auto mt-[12vh] w-full max-w-lg px-4">
        <Command
          className="overflow-hidden rounded-[6px] border border-rule bg-surface-1 shadow-[0_16px_40px_-20px_rgba(26,23,20,0.35)]"
          label="Search and command palette"
          shouldFilter
        >
          <Command.Input
            value={query}
            onValueChange={updateQuery}
            placeholder={t("commandPalette.placeholder")}
            className="w-full border-b border-rule bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-muted"
            autoFocus
          />

          <div className="flex flex-wrap gap-1.5 border-b border-rule px-3 py-2">
            {TYPE_FILTERS.map((f) => {
              const selected = typeFilter === f.id;
              const label = f.id === "all" ? t("commandPalette.typeAll") : f.label;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => updateTypeFilter(f.id)}
                  className={cn(
                    "rounded-[2px] border px-2 py-0.5 text-[11px] transition-colors",
                    selected
                      ? "border-rule-strong bg-accent text-canvas"
                      : "border-rule bg-surface-2 text-ink-muted hover:text-ink",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {searchActive && organisationId ? (
            <div className="flex items-center justify-end border-b border-rule px-3 py-1.5">
              <button
                type="button"
                onClick={() => void saveCurrentSearch()}
                disabled={saveStatus === "saving" || saveStatus === "saved"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 text-[11px] transition-colors",
                  saveStatus === "saved"
                    ? "border-rule-strong bg-surface-2 text-ink"
                    : "border-rule text-ink-muted hover:text-ink disabled:opacity-60",
                )}
              >
                <BookmarkPlus className="size-3.5" aria-hidden />
                {saveStatus === "saved"
                  ? t("commandPalette.savedConfirm")
                  : saveStatus === "saving"
                    ? t("commandPalette.saving")
                    : saveStatus === "error"
                      ? t("commandPalette.retrySave")
                      : t("commandPalette.saveSearch")}
              </button>
            </div>
          ) : null}

          <Command.List className="max-h-80 overflow-y-auto p-2">
            {!searchActive && recent.length > 0 ? (
              <Command.Group
                heading={t("commandPalette.recent")}
                className="[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-ink-muted"
              >
                {recent.map((item) => (
                  <Command.Item
                    key={`${item.query}:${item.type ?? "all"}:${item.at}`}
                    value={`recent ${item.query} ${item.type ?? ""}`}
                    onSelect={() => applyRecent(item)}
                    className="flex cursor-pointer items-center justify-between gap-2 px-2 py-2 text-sm text-ink aria-selected:bg-accent aria-selected:text-canvas"
                  >
                    <span className="truncate">{item.query}</span>
                    {item.type ? (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-70">
                        {typeLabel(item.type)}
                      </span>
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {!searchActive && savedSearches.length > 0 ? (
              <Command.Group
                heading={t("commandPalette.saved")}
                className="[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-ink-muted"
              >
                {savedSearches.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`saved ${item.name} ${item.query} ${item.type ?? ""}`}
                    onSelect={() => applySaved(item)}
                    className="group flex cursor-pointer items-center justify-between gap-2 px-2 py-2 text-sm text-ink aria-selected:bg-accent aria-selected:text-canvas"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {item.type ? (
                        <span className="text-[10px] uppercase tracking-wide opacity-70">
                          {typeLabel(item.type)}
                        </span>
                      ) : null}
                      {item.isOwner ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteSavedSearch(item.id);
                          }}
                          aria-label={t("commandPalette.deleteSaved", {
                            name: item.name,
                          })}
                          className="hidden rounded-[2px] p-0.5 text-ink-muted hover:text-ink group-hover:inline-flex group-aria-selected:text-canvas/70 group-aria-selected:hover:text-canvas"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {searchActive ? (
              <Command.Group
                heading={t("commandPalette.results")}
                className="[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-ink-muted"
              >
                {apiStatus === "loading" ? (
                  <div className="px-3 py-4 text-sm text-ink-muted">
                    {t("commandPalette.searching")}
                  </div>
                ) : null}
                {apiStatus === "error" ? (
                  <div className="px-3 py-4 text-sm text-ink-muted">
                    {apiError ?? t("commandPalette.searchFailed")}
                  </div>
                ) : null}
                {apiStatus === "ready" && apiResults.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-ink-muted">
                    {t("commandPalette.noDataMatches", { query: qTrim })}
                  </div>
                ) : null}
                {apiResults.map((item) => (
                  <Command.Item
                    key={`${item.type}:${item.id}`}
                    value={`${item.title} ${item.preview} ${item.type} ${qTrim}`}
                    onSelect={() => rememberAndGo(item)}
                    className="group flex cursor-pointer items-start gap-2 rounded-[4px] px-2 py-2 text-sm text-ink aria-selected:bg-accent aria-selected:text-canvas"
                  >
                    <span className="mt-0.5 shrink-0 rounded-[2px] border border-rule px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted group-aria-selected:border-canvas/40 group-aria-selected:text-canvas">
                      {typeLabel(item.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.title}</span>
                      {item.preview ? (
                        <span className="mt-0.5 block truncate font-data text-[11px] text-ink-muted group-aria-selected:text-canvas/80">
                          {item.preview}
                        </span>
                      ) : null}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            <Command.Empty className="px-3 py-6 text-center text-sm text-ink-muted">
              {searchActive
                ? t("commandPalette.noNavigationMatches")
                : t("commandPalette.noMatches")}
            </Command.Empty>

            {groups.map((group) => {
              const groupLabel = t(group.labelKey);
              return (
                <Command.Group
                  key={group.id}
                  heading={groupLabel}
                  className="[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-ink-muted"
                >
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const label = t(item.labelKey);
                    return (
                      <Command.Item
                        key={item.href}
                        value={`${label} ${groupLabel}`}
                        onSelect={() => go(item.href)}
                        className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-2 text-sm text-ink aria-selected:bg-accent aria-selected:text-canvas"
                      >
                        <Icon className="size-4 text-ink-muted" aria-hidden />
                        {label}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              );
            })}
          </Command.List>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule px-3 py-2 text-[11px] text-ink-muted">
            <span>
              <span className="font-data">{searchLabel}</span>{" "}
              {t("commandPalette.toggleHint")}
            </span>
            <span>
              <span className="font-data">{helpLabel}</span>{" "}
              {t("commandPalette.shortcutsHint")}
            </span>
            <span>
              <span className="font-data">Esc</span> {t("commandPalette.closeHint")}
            </span>
            {searchActive ? (
              <span>{t("commandPalette.hintSearch")}</span>
            ) : (
              <span>{t("commandPalette.hintRecent")}</span>
            )}
          </div>
        </Command>
      </div>
    </div>
  );
}
