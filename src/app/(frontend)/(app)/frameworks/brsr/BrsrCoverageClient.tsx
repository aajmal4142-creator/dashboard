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
  BrsrCoverageResult,
  BrsrDisclosureStatus,
  BrsrGapKind,
  BrsrLevelSummary,
} from "@/lib/frameworks/brsr";
import { buildBrsrPack } from "@/lib/frameworks/brsr";

function gapKindLabel(kind: BrsrGapKind | null): string {
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

function stateTone(state: BrsrDisclosureStatus["state"]): string {
  if (state === "covered") return "text-signal";
  if (state === "partial") return "text-amber";
  return "text-rust";
}

function CoverageBar({ summary }: { summary: BrsrLevelSummary }) {
  const coveredPct = summary.pctCovered;
  const partialPct =
    summary.total > 0 ? Math.round((100 * summary.partial) / summary.total) : 0;
  const gapPct = Math.max(0, 100 - coveredPct - partialPct);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {summary.level === "core" ? "Core (Essential)" : "Comprehensive (Leadership)"}
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

function GapRow({ gap }: { gap: BrsrDisclosureStatus }) {
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
            {gap.principleId} · {gap.level === "core" ? "Core" : "Comprehensive"}
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

export function BrsrCoverageClient() {
  const [coverage, setCoverage] = useState<BrsrCoverageResult | null>(null);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>("P6");
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app/frameworks/brsr/coverage");
      const body = (await res.json()) as {
        error?: string;
        periodLabel?: string;
        coverage?: BrsrCoverageResult;
      };
      if (!res.ok || !body.coverage) {
        setError(body.error ?? "Could not load BRSR coverage.");
        setCoverage(null);
        return;
      }
      setCoverage(body.coverage);
      setPeriodLabel(body.periodLabel ?? null);
    } catch {
      setError("Network error loading BRSR coverage. Retry.");
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

  function downloadPack() {
    if (!coverage) return;
    setExportMsg(null);
    const pack = buildBrsrPack({ coverage, periodLabel });
    const blob = new Blob([pack.plainText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brsr-pack-${coverage.periodId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg("BRSR pack downloaded.");
  }

  return (
    <PageFrame
      eyebrow="Frameworks"
      title="BRSR Core / Comprehensive"
      help="Principle-level coverage against SEBI BRSR Essential (Core) and Leadership (Comprehensive) indicators. Deterministic mapping only — no generated narrative. Publish BRSR-readiness from Reports when ready."
      context={periodLabel ? { period: periodLabel } : undefined}
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadPack}
            disabled={!coverage}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong disabled:opacity-50"
          >
            Download pack
          </button>
          <Link
            href="/reports"
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Reports / publish
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
              Unmapped items need a future metric — they stay gaps until then.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Not assurance
            </p>
            <p className="mt-2">
              This view tracks data readiness. It is not a SEBI filing and not an
              assurance opinion.
            </p>
          </div>
        </div>
      }
    >
      {loading ? <PageSkeleton rows={6} /> : null}

      {exportMsg ? <StatusLine tone="ok">{exportMsg}</StatusLine> : null}

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
          <div className="grid gap-4 md:grid-cols-2">
            <PageCard>
              <CoverageBar summary={coverage.core} />
            </PageCard>
            <PageCard>
              <CoverageBar summary={coverage.comprehensive} />
            </PageCard>
          </div>

          <PageCard title="Principles">
            <ul className="divide-y divide-rule">
              {coverage.principles.map((row) => {
                const open = expanded === row.principle.id;
                return (
                  <li key={row.principle.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 py-3 text-left"
                      onClick={() => setExpanded(open ? null : row.principle.id)}
                      aria-expanded={open}
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink">
                          <span className="font-mono text-ink-muted">
                            {row.principle.id}
                          </span>{" "}
                          {row.principle.shortTitle}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-muted line-clamp-2">
                          {row.principle.title}
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
                          Comp{" "}
                          <span className="font-mono tabular-nums text-ink">
                            {row.comprehensive.pctCovered}%
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
                body="All catalogued Core and Comprehensive disclosures with platform metrics are covered for this period."
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
