"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import {
  MARKETPLACE_INDUSTRIES,
  MARKETPLACE_INDUSTRY_LABELS,
  MARKETPLACE_KIND_LABELS,
  MARKETPLACE_KINDS,
  type AppliedMarketplaceEntry,
  type MarketplaceIndustry,
  type MarketplaceKind,
  type MarketplaceListItem,
} from "@/lib/templates/marketplace";
import { cn } from "@/lib/utils";

type Labels = {
  eyebrow: string;
  title: string;
  help: string;
  search: string;
  industry: string;
  kind: string;
  all: string;
  apply: string;
  applying: string;
  applied: string;
  viewOnly: string;
  emptyTitle: string;
  emptyHelp: string;
  errorLoad: string;
  applyOk: string;
  applyFailed: string;
  refresh: string;
  retry: string;
  questions: string;
  metrics: string;
  sections: string;
  free: string;
  appliedHistory: string;
  noHistory: string;
  openLibrary: string;
};

function Mono({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-mono)] tabular-nums slashed-zero",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function MarketplaceClient({
  canApply,
  labels,
}: {
  canApply: boolean;
  labels: Labels;
}) {
  const [templates, setTemplates] = useState<MarketplaceListItem[]>([]);
  const [applied, setApplied] = useState<AppliedMarketplaceEntry[]>([]);
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState<MarketplaceIndustry | "all">("all");
  const [kind, setKind] = useState<MarketplaceKind | "all">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (industry !== "all") params.set("industry", industry);
        if (kind !== "all") params.set("kind", kind);
        const qs = params.toString();
        const res = await fetch(`/api/app/templates/marketplace${qs ? `?${qs}` : ""}`);
        const data = (await res.json()) as {
          templates?: MarketplaceListItem[];
          applied?: AppliedMarketplaceEntry[];
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? labels.errorLoad);
          setTemplates([]);
          setApplied([]);
          setLoaded(true);
          return;
        }
        setTemplates(data.templates ?? []);
        setApplied(data.applied ?? []);
        setTone("neutral");
        setMessage(null);
        setLoaded(true);
      } catch {
        setTone("error");
        setMessage(labels.errorLoad);
        setTemplates([]);
        setApplied([]);
        setLoaded(true);
      }
    });
  }, [q, industry, kind, labels.errorLoad]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  function clearFilters() {
    setQ("");
    setIndustry("all");
    setKind("all");
  }

  async function applyTemplate(templateKey: string) {
    if (!canApply) return;
    setBusyKey(templateKey);
    setTone("neutral");
    setMessage(null);
    try {
      const res = await fetch("/api/app/templates/marketplace/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey }),
      });
      const data = (await res.json()) as {
        error?: string;
        applied?: AppliedMarketplaceEntry[];
        href?: string;
      };
      if (!res.ok) {
        setTone("error");
        setMessage(data.error ?? labels.applyFailed);
        return;
      }
      if (data.applied) setApplied(data.applied);
      setTone("ok");
      setMessage(labels.applyOk);
      load();
    } catch {
      setTone("error");
      setMessage(labels.applyFailed);
    } finally {
      setBusyKey(null);
    }
  }

  const appliedKeys = new Set(applied.map((a) => a.templateKey));

  return (
    <PageFrame
      eyebrow={labels.eyebrow}
      title={labels.title}
      help={labels.help}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/compliance-templates">{labels.openLibrary}</Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => load()}
            disabled={pending}
          >
            {labels.refresh}
          </Button>
        </div>
      }
      rail={
        <div className="space-y-4 text-[13px] text-ink-muted">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              {labels.free}
            </p>
            <p className="mt-2">
              Free industry starters only. No paid store and no generated content. Apply
              copies the pack into your organisation.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              {labels.appliedHistory}
            </p>
            {applied.length === 0 ? (
              <p className="mt-2">{labels.noHistory}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {applied
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((row) => (
                    <li
                      key={`${row.reportTemplateId}-${row.appliedAt}`}
                      className="border-t border-rule pt-2"
                    >
                      <p className="text-ink">{row.templateName}</p>
                      <p className="text-[11px]">
                        {MARKETPLACE_INDUSTRY_LABELS[row.industry]} ·{" "}
                        {MARKETPLACE_KIND_LABELS[row.kind]}
                      </p>
                      <p className="text-[11px]">
                        <Mono>{new Date(row.appliedAt).toLocaleDateString()}</Mono>
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!canApply ? <StatusLine tone="neutral">{labels.viewOnly}</StatusLine> : null}
        {message ? <StatusLine tone={tone}>{message}</StatusLine> : null}

        <PageCard>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[12rem] flex-1 text-[12px] text-ink-muted">
              {labels.search}
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
                placeholder="Retail, freight, financed…"
              />
            </label>
            <label className="text-[12px] text-ink-muted">
              {labels.industry}
              <select
                value={industry}
                onChange={(e) =>
                  setIndustry(
                    e.target.value === "all"
                      ? "all"
                      : (e.target.value as MarketplaceIndustry),
                  )
                }
                className="mt-1 block border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink"
              >
                <option value="all">{labels.all}</option>
                {MARKETPLACE_INDUSTRIES.map((id) => (
                  <option key={id} value={id}>
                    {MARKETPLACE_INDUSTRY_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-ink-muted">
              {labels.kind}
              <select
                value={kind}
                onChange={(e) =>
                  setKind(
                    e.target.value === "all"
                      ? "all"
                      : (e.target.value as MarketplaceKind),
                  )
                }
                className="mt-1 block border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink"
              >
                <option value="all">{labels.all}</option>
                {MARKETPLACE_KINDS.map((id) => (
                  <option key={id} value={id}>
                    {MARKETPLACE_KIND_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </PageCard>

        {!loaded || pending ? (
          <PageSkeleton rows={4} />
        ) : templates.length === 0 ? (
          <EmptyState
            title={labels.emptyTitle}
            body={labels.emptyHelp}
            action={
              <Button type="button" variant="secondary" size="sm" onClick={() => load()}>
                {labels.retry}
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {templates.map((item) => {
              const already = appliedKeys.has(item.key);
              const busy = busyKey === item.key;
              return (
                <li
                  key={item.key}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-semibold text-ink">{item.name}</h2>
                      <span className="rounded-[2px] border border-rule px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                        {labels.free}
                      </span>
                      {already ? (
                        <span className="rounded-[2px] border border-accent/40 bg-accent-quiet px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-accent">
                          {labels.applied}
                        </span>
                      ) : null}
                    </div>
                    <p className="max-w-[62ch] text-[13px] text-ink-muted">
                      {item.description}
                    </p>
                    <p className="text-[12px] text-ink-muted">
                      {MARKETPLACE_INDUSTRY_LABELS[item.industry]} ·{" "}
                      {MARKETPLACE_KIND_LABELS[item.kind]} ·{" "}
                      {item.framework.toUpperCase()}
                    </p>
                    <p className="text-[12px] text-ink-muted">
                      <Mono>{item.questionCount}</Mono> {labels.questions}
                      {" · "}
                      <Mono>{item.metricCount}</Mono> {labels.metrics}
                      {" · "}
                      <Mono>{item.sectionCount}</Mono> {labels.sections}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canApply || busy}
                      onClick={() => void applyTemplate(item.key)}
                    >
                      {busy ? labels.applying : labels.apply}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageFrame>
  );
}
