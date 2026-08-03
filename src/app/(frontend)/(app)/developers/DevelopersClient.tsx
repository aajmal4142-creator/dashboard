"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { EmptyState, PageFrame, PageSkeleton } from "@/components/shell/PageFrame";
import {
  API_DOC_GROUPS,
  API_ENDPOINT_CATALOG,
  API_KEYS_HREF,
  API_SANDBOX_HREF,
  filterApiEndpointCatalog,
  type ApiDocGroup,
  type ApiEndpointDoc,
  type HttpMethod,
} from "@/lib/developers";
import { cn } from "@/lib/utils";

type GroupFilter = ApiDocGroup | "all";

function methodTone(method: HttpMethod): string {
  switch (method) {
    case "GET":
      return "text-cobalt border-cobalt/40 bg-cobalt/10";
    case "POST":
      return "text-accent border-accent/40 bg-accent-quiet";
    case "PUT":
    case "PATCH":
      return "text-amber border-amber/40 bg-amber/10";
    case "DELETE":
      return "text-rust border-rust/40 bg-rust/10";
  }
}

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[4.5rem] justify-center rounded-[2px] border px-1.5 py-0.5 font-data text-[10px] font-semibold uppercase tracking-[0.06em]",
        methodTone(method),
      )}
    >
      {method}
    </span>
  );
}

function EndpointDetail({
  entry,
  groupLabel,
}: {
  entry: ApiEndpointDoc;
  groupLabel: string;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MethodBadge method={entry.method} />
        <code className="font-data text-[13px] text-ink break-all">{entry.path}</code>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {groupLabel}
        </p>
        <h2 className="mt-1 font-display text-[22px] text-ink">{entry.summary}</h2>
        <p className="mt-2 text-[13px] text-ink-muted">{entry.description}</p>
      </div>
      <div className="border-t border-rule pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {t("developers.authLabel")}
        </p>
        <p className="mt-1 text-[13px] text-ink">{entry.auth}</p>
      </div>
      {entry.query && entry.query.length > 0 ? (
        <div className="border-t border-rule pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t("developers.queryLabel")}
          </p>
          <ul className="mt-2 space-y-2">
            {entry.query.map((param) => (
              <li key={param.name} className="text-[13px]">
                <code className="font-data text-ink">{param.name}</code>
                {param.required ? (
                  <span className="ml-2 text-[10px] uppercase tracking-[0.06em] text-rust">
                    {t("developers.required")}
                  </span>
                ) : null}
                <span className="mt-0.5 block text-ink-muted">{param.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {entry.notes && entry.notes.length > 0 ? (
        <div className="border-t border-rule pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t("developers.notesLabel")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-muted">
            {entry.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function DevelopersClient({
  eyebrow,
  title,
  help,
}: {
  eyebrow: string;
  title: string;
  help: string;
}) {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    API_ENDPOINT_CATALOG[0]?.id ?? null,
  );

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const filtered = useMemo(
    () => filterApiEndpointCatalog({ query, group }),
    [query, group],
  );

  const selected = useMemo(() => {
    if (filtered.length === 0) return null;
    const match = filtered.find((e) => e.id === selectedId);
    return match ?? filtered[0] ?? null;
  }, [filtered, selectedId]);

  const groupLabel = (id: ApiDocGroup) => {
    const key = `developers.groups.${id}` as const;
    const translated = t(key);
    return translated === key
      ? (API_DOC_GROUPS.find((g) => g.id === id)?.label ?? id)
      : translated;
  };

  return (
    <PageFrame
      eyebrow={eyebrow}
      title={title}
      help={help}
      actions={
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <Link href={API_KEYS_HREF} className="editorial-link text-accent">
            {t("developers.apiKeysLink")}
          </Link>
          <span className="text-rule-strong" aria-hidden>
            ·
          </span>
          <Link href={API_SANDBOX_HREF} className="editorial-link text-accent">
            {t("developers.sandboxLink")}
          </Link>
        </div>
      }
    >
      {!ready ? (
        <PageSkeleton rows={6} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 border-b border-rule pb-4 md:flex-row md:items-end md:justify-between">
            <label className="block min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t("developers.searchLabel")}
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("developers.searchPlaceholder")}
                className="mt-1.5 w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-muted focus:border-rule-strong"
              />
            </label>
            <label className="block shrink-0 md:w-48">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t("developers.filterLabel")}
              </span>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value as GroupFilter)}
                className="mt-1.5 w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
              >
                <option value="all">{t("developers.filterAll")}</option>
                {API_DOC_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {groupLabel(g.id)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="font-data text-[12px] text-ink-muted">
            {t("developers.resultCount", { count: String(filtered.length) })}
          </p>

          {filtered.length === 0 ? (
            <EmptyState
              title={t("developers.emptyTitle")}
              body={t("developers.emptyBody")}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <ul
                  className="divide-y divide-rule rounded-[6px] border border-rule bg-surface-1"
                  role="listbox"
                  aria-label={t("developers.listLabel")}
                >
                  {filtered.map((entry) => {
                    const active = selected?.id === entry.id;
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => setSelectedId(entry.id)}
                          className={cn(
                            "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors",
                            active ? "bg-surface-2" : "hover:bg-surface-2/60",
                          )}
                        >
                          <MethodBadge method={entry.method} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-data text-[12px] text-ink">
                              {entry.path}
                            </span>
                            <span className="mt-0.5 block text-[12px] text-ink-muted">
                              {entry.summary}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5 lg:col-span-7">
                {selected ? (
                  <EndpointDetail
                    entry={selected}
                    groupLabel={groupLabel(selected.group)}
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </PageFrame>
  );
}
