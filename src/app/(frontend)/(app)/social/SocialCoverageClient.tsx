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
  SocialCoverageResult,
  SocialGapKind,
  SocialIndicatorStatus,
  SocialSummary,
} from "@/lib/social";

function gapKindLabel(kind: SocialGapKind | null): string {
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

function stateTone(state: SocialIndicatorStatus["state"]): string {
  if (state === "covered") return "text-signal";
  if (state === "partial") return "text-amber";
  return "text-rust";
}

function actionLabel(gap: SocialIndicatorStatus): string {
  if (gap.gapKind === "unmapped") return "Metrics";
  return "Open in Metrics";
}

function CoverageBar({ summary }: { summary: SocialSummary }) {
  const coveredPct = summary.pctCovered;
  const partialPct =
    summary.total > 0 ? Math.round((100 * summary.partial) / summary.total) : 0;
  const gapPct = Math.max(0, 100 - coveredPct - partialPct);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Social indicator coverage
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

function GapRow({ gap }: { gap: SocialIndicatorStatus }) {
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
            {gap.sectionId}
            {gap.gapKind ? ` · ${gapKindLabel(gap.gapKind)}` : ""}
          </p>
          {gap.note ? (
            <p className="mt-1 text-[11px] text-ink-muted">{gap.note}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={gap.actionHref}
            className="text-[12px] text-accent underline-offset-2 hover:underline"
          >
            {actionLabel(gap)}
          </Link>
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

type SocialValueRow = {
  id: string;
  metricKey: string;
  value: unknown;
  quality: string;
  unit: string | null;
};

export function SocialCoverageClient() {
  const [coverage, setCoverage] = useState<SocialCoverageResult | null>(null);
  const [values, setValues] = useState<SocialValueRow[]>([]);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>("workforce");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app/social/coverage");
      const body = (await res.json()) as {
        error?: string;
        periodLabel?: string;
        coverage?: SocialCoverageResult;
        values?: SocialValueRow[];
      };
      if (!res.ok || !body.coverage) {
        setError(body.error ?? "Could not load social coverage.");
        setCoverage(null);
        setValues([]);
        return;
      }
      setCoverage(body.coverage);
      setValues(Array.isArray(body.values) ? body.values : []);
      setPeriodLabel(body.periodLabel ?? null);
    } catch {
      setError("Network error loading social coverage. Retry.");
      setCoverage(null);
      setValues([]);
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

  return (
    <PageFrame
      eyebrow="Work"
      title="Social metrics"
      help="Workforce, health & safety, training, fair pay, and labour-practice indicators mapped to ClearESG metrics where they exist. Deterministic coverage only — no carbon formulas and no generated narrative."
      context={periodLabel ? { period: periodLabel } : undefined}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={METRICS_HREF}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Fill gaps in Metrics
          </Link>
          <Link
            href="/frameworks/brsr"
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            BRSR (related)
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
              Covered requires measured or calculated data. Estimates are partial. Missing
              evidence on required rows is partial. Unmapped items (living wage, pay gap,
              turnover) stay gaps until metrics ship.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Values
            </p>
            <p className="mt-2">
              Enter social datapoints in Metrics. This page shows coverage and period
              values for mapped keys only.
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
          <PageCard>
            <CoverageBar summary={coverage.summary} />
          </PageCard>

          <PageCard title="Period values (mapped)">
            {values.length === 0 ? (
              <EmptyState
                title="No social datapoints yet"
                body="Enter headcount, injuries, training hours, or related metrics for this period. Unmapped indicators stay gaps until ClearESG adds them."
              />
            ) : (
              <ul className="divide-y divide-rule">
                {values.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                  >
                    <Link
                      href={`${METRICS_HREF}?metric=${encodeURIComponent(row.metricKey)}`}
                      className="text-[13px] text-accent underline-offset-2 hover:underline"
                    >
                      <span className="font-mono text-[11px] text-ink-muted">
                        {row.metricKey}
                      </span>
                    </Link>
                    <p className="text-[12px] text-ink-muted">
                      <span className="font-mono tabular-nums text-ink">
                        {row.value === null || row.value === undefined
                          ? "—"
                          : String(row.value)}
                      </span>
                      {row.unit ? ` ${row.unit}` : ""}
                      {" · "}
                      {row.quality}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </PageCard>

          <PageCard title="Indicator sections">
            <ul className="divide-y divide-rule">
              {coverage.sections.map((row) => {
                const open = expanded === row.sectionId;
                return (
                  <li key={row.sectionId}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 py-3 text-left"
                      onClick={() => setExpanded(open ? null : row.sectionId)}
                      aria-expanded={open}
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink">
                          {row.shortTitle}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-muted line-clamp-2">
                          {row.title}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-ink-muted">
                        <span className="font-mono tabular-nums text-ink">
                          {row.pctCovered}%
                        </span>
                        <p className="font-mono tabular-nums">
                          {row.covered}/{row.total}
                        </p>
                      </div>
                    </button>
                    {open ? (
                      <ul className="mb-3 space-y-2 border-l border-rule pl-3">
                        {row.indicators.map((d) => (
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
                            {d.state !== "covered" ? (
                              <p className="mt-0.5 text-[11px] text-ink-muted">
                                {gapKindLabel(d.gapKind)}
                                {" · "}
                                <Link
                                  href={d.actionHref}
                                  className="text-accent underline-offset-2 hover:underline"
                                >
                                  {actionLabel(d)}
                                </Link>
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
                body="All checklist items with platform sources are covered for this period."
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
