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
  CaliforniaCoverageResult,
  CaliforniaDisclosureStatus,
  CaliforniaGapKind,
  CaliforniaLaw,
  CaliforniaLawSummary,
} from "@/lib/frameworks/california";

function gapKindLabel(kind: CaliforniaGapKind | null): string {
  switch (kind) {
    case "missing_data":
      return "Missing metric";
    case "missing_evidence":
      return "Missing evidence";
    case "missing_org_field":
      return "Missing organisation field";
    case "missing_tcfd":
      return "Missing TCFD answer";
    case "unmapped":
      return "Not tracked in ClearESG";
    case "weak_quality":
      return "Estimated / weak quality";
    case "phase_pending":
      return "Deferred (Scope 3 phase)";
    default:
      return "";
  }
}

function stateTone(state: CaliforniaDisclosureStatus["state"]): string {
  if (state === "covered") return "text-signal";
  if (state === "partial") return "text-amber";
  if (state === "deferred") return "text-ink-muted";
  return "text-rust";
}

function actionLabel(gap: CaliforniaDisclosureStatus): string {
  if (gap.gapKind === "missing_tcfd") return "Open TCFD";
  if (gap.gapKind === "missing_org_field") return "Open settings";
  if (gap.gapKind === "unmapped") {
    if (gap.actionHref.startsWith("/assurance")) return "Assurance";
    if (gap.actionHref.startsWith("/tcfd")) return "Open TCFD";
    if (gap.actionHref.startsWith("/reports")) return "Reports";
    if (gap.actionHref.startsWith("/compliance")) return "Reg calendar";
    return "Details";
  }
  return "Open in Metrics";
}

function CoverageBar({
  summary,
  title,
}: {
  summary: CaliforniaLawSummary;
  title: string;
}) {
  const coveredPct = summary.pctCovered;
  const active = Math.max(0, summary.total - summary.deferred);
  const partialPct = active > 0 ? Math.round((100 * summary.partial) / active) : 0;
  const gapPct = Math.max(0, 100 - coveredPct - partialPct);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {title}
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
          {summary.deferred > 0 ? (
            <>
              {" · "}
              <span className="font-mono tabular-nums text-ink-muted">
                {summary.deferred}
              </span>{" "}
              deferred
            </>
          ) : null}
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

function GapRow({ gap }: { gap: CaliforniaDisclosureStatus }) {
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

export function CaliforniaCoverageClient() {
  const [law, setLaw] = useState<CaliforniaLaw>("253");
  const [coverage, setCoverage] = useState<CaliforniaCoverageResult | null>(null);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>("scope1");

  const load = useCallback(async (nextLaw: CaliforniaLaw) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/frameworks/california/coverage?law=${nextLaw}`);
      const body = (await res.json()) as {
        error?: string;
        periodLabel?: string;
        coverage?: CaliforniaCoverageResult;
      };
      if (!res.ok || !body.coverage) {
        setError(body.error ?? "Could not load California coverage.");
        setCoverage(null);
        return;
      }
      setCoverage(body.coverage);
      setPeriodLabel(body.periodLabel ?? null);
      setExpanded(nextLaw === "253" ? "scope1" : "governance");
    } catch {
      setError("Network error loading California coverage. Retry.");
      setCoverage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load(law);
    }, 0);
    return () => window.clearTimeout(id);
  }, [law, load]);

  const title =
    law === "253" ? "SB 253 GHG disclosure" : "SB 261 climate risk disclosure";

  return (
    <PageFrame
      eyebrow="Compliance"
      title="California climate packs"
      help="Checklist coverage for California SB 253 (GHG reporting) and SB 261 (climate-related financial risk). Deterministic mapping to ClearESG metrics and TCFD answers — no generated narrative. Not a filing and not an assurance opinion."
      context={periodLabel ? { period: periodLabel } : undefined}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href="/tcfd"
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            TCFD
          </Link>
          <Link
            href={METRICS_HREF}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Fill gaps in Metrics
          </Link>
          <Link
            href="/compliance/calendar"
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Reg calendar
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
              SB 253 scores Scope 1–2 activity data and reporting-entity fields. Scope 3
              rows defer until the phase year. SB 261 maps to your TCFD pack where
              possible.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Not assurance
            </p>
            <p className="mt-2">
              This view tracks data readiness against a product checklist. Confirm
              applicability and filing mechanics with counsel.
            </p>
          </div>
        </div>
      }
    >
      <div
        className="mb-6 flex flex-wrap gap-2 border-b border-rule pb-3"
        role="tablist"
        aria-label="California climate law"
      >
        {(["253", "261"] as const).map((id) => {
          const selected = law === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "rounded-[4px] px-3 py-1.5 text-[12px]",
                selected ? "bg-accent-quiet text-ink" : "text-ink-muted hover:text-ink",
              )}
              onClick={() => setLaw(id)}
            >
              {id === "253" ? "SB 253 — GHG" : "SB 261 — Climate risk"}
            </button>
          );
        })}
      </div>

      {loading ? <PageSkeleton rows={6} /> : null}

      {!loading && error ? (
        <StatusLine tone="error">
          {error}{" "}
          <button
            type="button"
            className="text-accent underline-offset-2 hover:underline"
            onClick={() => void load(law)}
          >
            Retry
          </button>
        </StatusLine>
      ) : null}

      {!loading && !error && coverage ? (
        <div className="space-y-6">
          <PageCard>
            <CoverageBar summary={coverage.summary} title={title} />
            {law === "253" ? (
              <p className="mt-3 text-[12px] text-ink-muted">
                Scope 3 phase:{" "}
                <span className="font-mono tabular-nums text-ink">
                  {coverage.scope3Required ? "active" : "deferred"}
                </span>
              </p>
            ) : null}
          </PageCard>

          <PageCard title="Checklist sections">
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
                        {row.deferred > 0 ? (
                          <p className="font-mono tabular-nums">
                            {row.deferred} deferred
                          </p>
                        ) : null}
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
                            {d.state !== "covered" && d.state !== "deferred" ? (
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
                            {d.state === "deferred" ? (
                              <p className="mt-0.5 text-[11px] text-ink-muted">
                                {gapKindLabel(d.gapKind)}
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
                body="All active checklist items with platform sources are covered for this period."
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
