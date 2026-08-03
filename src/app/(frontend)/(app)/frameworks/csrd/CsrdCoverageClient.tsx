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
  CsrdCoverageResult,
  CsrdDisclosureStatus,
  CsrdGapKind,
  CsrdLevelSummary,
} from "@/lib/frameworks/csrd";

function gapKindLabel(kind: CsrdGapKind | null): string {
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

function stateTone(state: CsrdDisclosureStatus["state"]): string {
  if (state === "covered") return "text-signal";
  if (state === "partial") return "text-amber";
  return "text-rust";
}

function CoverageBar({ summary }: { summary: CsrdLevelSummary }) {
  const coveredPct = summary.pctCovered;
  const partialPct =
    summary.total > 0 ? Math.round((100 * summary.partial) / summary.total) : 0;
  const gapPct = Math.max(0, 100 - coveredPct - partialPct);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {summary.level === "core" ? "Core (E1 climate beachhead)" : "Supporting"}
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
        </p>
      </div>
      <div
        className="flex h-2 overflow-hidden rounded-[2px] bg-surface-2"
        role="img"
        aria-label={`${summary.pctCovered}% covered`}
      >
        <div className="bg-signal" style={{ width: `${coveredPct}%` }} />
        <div className="bg-amber" style={{ width: `${partialPct}%` }} />
        <div className="bg-rust/40" style={{ width: `${gapPct}%` }} />
      </div>
    </div>
  );
}

export function CsrdCoverageClient() {
  const [coverage, setCoverage] = useState<CsrdCoverageResult | null>(null);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app/frameworks/csrd/coverage");
      const body = (await res.json()) as {
        error?: string;
        coverage?: CsrdCoverageResult;
        periodLabel?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Could not load CSRD coverage");
        setCoverage(null);
        return;
      }
      setCoverage(body.coverage ?? null);
      setPeriodLabel(body.periodLabel ?? null);
    } catch {
      setError("Could not reach the CSRD coverage API");
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

  const gaps =
    coverage?.disclosures.filter((d) => d.state === "gap" || d.state === "partial") ?? [];

  return (
    <PageFrame
      eyebrow="Frameworks"
      title="CSRD / ESRS coverage"
      help="ESRS Set 1 beachhead: score climate datapoints, follow gaps into Metrics, then publish. Unmapped topics stay gaps — never silent zeros. Labels are product aids, not legal determinations."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href="/reports"
            className="inline-flex h-8 items-center rounded-[4px] border border-rule px-3 text-[13px] text-ink hover:border-rule-strong"
          >
            Publish
          </Link>
          <Link
            href={METRICS_HREF}
            className="inline-flex h-8 items-center rounded-[4px] bg-accent px-3 text-[13px] text-canvas hover:bg-accent-hover"
          >
            Open Metrics
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? <StatusLine tone="error">{error}</StatusLine> : null}
        {loading ? <PageSkeleton /> : null}
        {!loading && !coverage ? (
          <EmptyState
            title="No coverage yet"
            body="Open a reporting period and enter Metrics to score ESRS disclosures."
          />
        ) : null}

        {coverage ? (
          <>
            <p className="text-[13px] text-ink-muted">
              Period{" "}
              <span className="font-mono text-ink">
                {periodLabel ?? coverage.periodId}
              </span>
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <PageCard title="Core">
                <CoverageBar summary={coverage.core} />
              </PageCard>
              <PageCard title="Supporting">
                <CoverageBar summary={coverage.supporting} />
              </PageCard>
            </div>

            {gaps.length > 0 ? (
              <PageCard title="Gaps → Metrics">
                <ul className="divide-y divide-rule">
                  {gaps.map((d) => (
                    <li
                      key={d.code}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <p className="font-mono text-[12px] text-ink-muted">{d.code}</p>
                        <p className="text-[14px] text-ink">{d.label}</p>
                        <p className={cn("text-[12px]", stateTone(d.state))}>
                          {d.state}
                          {d.gapKind ? ` · ${gapKindLabel(d.gapKind)}` : ""}
                        </p>
                      </div>
                      <Link
                        href={d.metricsHref}
                        className="text-[13px] text-accent underline-offset-2 hover:underline"
                      >
                        Fill in Metrics
                      </Link>
                    </li>
                  ))}
                </ul>
              </PageCard>
            ) : (
              <PageCard title="Gaps">
                <p className="text-[13px] text-ink-muted">
                  No open gaps on mapped disclosures. Review supporting unmapped topics
                  before publish.
                </p>
              </PageCard>
            )}

            {coverage.sections.map((sec) => (
              <PageCard key={sec.section.id} title={sec.section.shortTitle}>
                <p className="mb-3 text-[12px] text-ink-muted">
                  {sec.section.description}
                </p>
                <ul className="divide-y divide-rule">
                  {sec.disclosures.map((d) => (
                    <li
                      key={d.code}
                      className="flex justify-between gap-2 py-2 text-[13px]"
                    >
                      <span>
                        <span className="font-mono text-ink-muted">{d.code}</span>{" "}
                        {d.label}
                      </span>
                      <span className={cn("font-mono", stateTone(d.state))}>
                        {d.state}
                      </span>
                    </li>
                  ))}
                </ul>
              </PageCard>
            ))}
          </>
        ) : null}
      </div>
    </PageFrame>
  );
}
