"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Metric } from "@/components/ui/metric";
import { METRICS_HREF } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type {
  SecrCoverageResult,
  SecrDisclosureStatus,
  SecrGapKind,
  SecrLevelSummary,
} from "@/lib/frameworks/secr";
import { buildSecrDraftSummary, secrDraftToPlainText } from "@/lib/frameworks/secr";

function gapKindLabel(kind: SecrGapKind | null): string {
  switch (kind) {
    case "missing_data":
      return "Missing metric";
    case "missing_evidence":
      return "Missing evidence";
    case "unmapped":
      return "Not tracked in ClearESG";
    case "weak_quality":
      return "Estimated / weak quality";
    default:
      return "";
  }
}

function stateTone(state: SecrDisclosureStatus["state"]): string {
  if (state === "covered") return "text-signal";
  if (state === "partial") return "text-amber";
  return "text-rust";
}

function CoverageBar({ summary }: { summary: SecrLevelSummary }) {
  const coveredPct = summary.pctCovered;
  const partialPct =
    summary.total > 0 ? Math.round((100 * summary.partial) / summary.total) : 0;
  const gapPct = Math.max(0, 100 - coveredPct - partialPct);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {summary.level === "core" ? "Core (required)" : "Supporting"}
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-ink">
            <Metric value={summary.pctCovered} unit="%" size="lg" animate={false} />
          </p>
        </div>
        <p className="text-[12px] text-ink-muted">
          <span className="font-mono tabular-nums text-signal">{summary.covered}</span>{" "}
          covered
          {" · "}
          <span className="font-mono tabular-nums text-amber">
            {summary.partial}
          </span>{" "}
          partial
          {" · "}
          <span className="font-mono tabular-nums text-rust">{summary.gap}</span> gap
          {" · "}
          <span className="font-mono tabular-nums">{summary.total}</span> total
        </p>
      </div>
      <div
        className="flex h-2 overflow-hidden rounded-[2px] bg-surface-2"
        role="img"
        aria-label={`${summary.pctCovered}% covered, ${partialPct}% partial, ${gapPct}% gap`}
      >
        <div className="bg-signal" style={{ width: `${coveredPct}%` }} />
        <div className="bg-amber" style={{ width: `${partialPct}%` }} />
        <div className="bg-rust/40" style={{ width: `${gapPct}%` }} />
      </div>
    </div>
  );
}

function GapRow({ gap }: { gap: SecrDisclosureStatus }) {
  return (
    <li className="border-b border-rule py-3 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink">
            <span className="font-mono text-[11px] text-ink-muted">{gap.code}</span>
            {" · "}
            {gap.label}
          </p>
          <p className="mt-1 text-[12px] text-ink-muted">
            {gap.sectionId} · {gap.level === "core" ? "Core" : "Supporting"}
            {gap.gapKind ? ` · ${gapKindLabel(gap.gapKind)}` : ""}
          </p>
          {gap.note ? (
            <p className="mt-1 text-[11px] text-ink-muted">{gap.note}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {gap.gapKind !== "unmapped" ? (
            <Link
              href={gap.metricsHref}
              className="text-[12px] text-accent underline-offset-2 hover:underline"
            >
              Open in Metrics
            </Link>
          ) : (
            <Link
              href={METRICS_HREF}
              className="text-[12px] text-ink-muted underline-offset-2 hover:underline"
            >
              Metrics
            </Link>
          )}
          {gap.evidenceIds.length > 0 ? (
            <span className="font-mono text-[11px] tabular-nums text-signal">
              {gap.evidenceIds.length} evidence
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function SecrCoverageClient() {
  const [coverage, setCoverage] = useState<SecrCoverageResult | null>(null);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>("energy");
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app/frameworks/secr/coverage");
      const body = (await res.json()) as {
        error?: string;
        periodLabel?: string;
        coverage?: SecrCoverageResult;
      };
      if (!res.ok || !body.coverage) {
        setError(body.error ?? "Could not load SECR coverage.");
        setCoverage(null);
        return;
      }
      setCoverage(body.coverage);
      setPeriodLabel(body.periodLabel ?? null);
    } catch {
      setError("Network error loading SECR coverage. Retry.");
      setCoverage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function copyDraft() {
    if (!coverage) return;
    setExportMsg(null);
    const draft = buildSecrDraftSummary({
      coverage,
      periodLabel,
    });
    const text = secrDraftToPlainText(draft);
    try {
      await navigator.clipboard.writeText(text);
      setExportMsg("Draft summary copied to clipboard.");
    } catch {
      setExportMsg("Could not copy. Download the draft file instead.");
    }
  }

  function downloadDraft() {
    if (!coverage) return;
    setExportMsg(null);
    const draft = buildSecrDraftSummary({
      coverage,
      periodLabel,
    });
    const text = secrDraftToPlainText(draft);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `secr-draft-${coverage.periodId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg("Draft summary downloaded.");
  }

  return (
    <PageFrame
      eyebrow="Frameworks"
      title="UK SECR disclosure pack"
      help="Coverage against Streamlined Energy and Carbon Reporting requirements: energy use, Scope 1/2 GHG, intensity, methodology, and directors' report statements. Deterministic mapping only — no generated narrative."
      context={periodLabel ? { period: periodLabel } : undefined}
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!coverage}
            onClick={() => void copyDraft()}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong disabled:opacity-50"
          >
            Copy draft
          </button>
          <button
            type="button"
            disabled={!coverage}
            onClick={downloadDraft}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong disabled:opacity-50"
          >
            Download draft
          </button>
          <Link
            href="/compliance/calendar"
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Reg calendar
          </Link>
          <Link
            href={METRICS_HREF}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Fill gaps in Metrics
          </Link>
        </div>
      }
      rail={
        <div className="space-y-4 text-[13px] text-ink-muted">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              How to read
            </p>
            <p className="mt-2">
              Covered requires measured or calculated data
              {". "}
              Estimates are partial. Missing evidence on required disclosures is partial.
              Unmapped items need a narrative or future metric — they stay gaps until
              then.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Not a filing
            </p>
            <p className="mt-2">
              This view tracks data readiness for the directors&apos; report SECR section.
              It is not a Companies House filing and not an assurance opinion.
            </p>
          </div>
        </div>
      }
    >
      {loading ? <PageSkeleton rows={6} /> : null}

      {!loading && error ? (
        <StatusLine tone="error">
          {error}{" "}
          <button
            type="button"
            className="text-accent underline-offset-2 hover:underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </StatusLine>
      ) : null}

      {!loading && !error && coverage ? (
        <div className="space-y-6">
          {exportMsg ? <StatusLine tone="ok">{exportMsg}</StatusLine> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <PageCard>
              <CoverageBar summary={coverage.core} />
            </PageCard>
            <PageCard>
              <CoverageBar summary={coverage.supporting} />
            </PageCard>
          </div>

          <PageCard title="SECR sections">
            <ul className="divide-y divide-rule">
              {coverage.sections.map((row) => {
                const open = expanded === row.section.id;
                return (
                  <li key={row.section.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 py-3 text-left"
                      onClick={() => setExpanded(open ? null : row.section.id)}
                      aria-expanded={open}
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink">
                          {row.section.shortTitle}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-muted line-clamp-2">
                          {row.section.description}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-ink-muted">
                        <p>
                          Core{" "}
                          <span className="font-mono tabular-nums text-ink">
                            {row.core.pctCovered}%
                          </span>
                        </p>
                        <p>
                          Support{" "}
                          <span className="font-mono tabular-nums text-ink">
                            {row.supporting.pctCovered}%
                          </span>
                        </p>
                      </div>
                    </button>
                    {open ? (
                      <ul className="mb-3 space-y-2 border-l border-rule pl-3">
                        {row.disclosures.map((d) => (
                          <li key={d.code} className="text-[12px]">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-ink">
                                <span className="font-mono text-[10px] text-ink-muted">
                                  {d.code}
                                </span>{" "}
                                {d.label}
                              </p>
                              <span
                                className={cn(
                                  "font-mono text-[11px] uppercase",
                                  stateTone(d.state),
                                )}
                              >
                                {d.state}
                              </span>
                            </div>
                            {d.gapKind || d.state !== "covered" ? (
                              <p className="mt-0.5 text-[11px] text-ink-muted">
                                {gapKindLabel(d.gapKind)}
                                {d.state !== "covered" ? (
                                  <>
                                    {" · "}
                                    <Link
                                      href={d.metricsHref}
                                      className="text-accent underline-offset-2 hover:underline"
                                    >
                                      Fix in Metrics
                                    </Link>
                                  </>
                                ) : null}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </PageCard>

          <PageCard title="Gaps and partials">
            {coverage.gaps.length === 0 ? (
              <EmptyState
                title="No open gaps"
                body="All catalogued Core and Supporting disclosures with platform metrics are covered for this period."
              />
            ) : (
              <ul>
                {coverage.gaps.map((gap) => (
                  <GapRow key={gap.code} gap={gap} />
                ))}
              </ul>
            )}
          </PageCard>
        </div>
      ) : null}
    </PageFrame>
  );
}
