"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";

type Breakdown = {
  tier1Direct: number;
  tier2: number;
  tier3: number;
  total: number;
  byTier: Array<{
    tier: 1 | 2 | 3;
    emissions: number;
    actualShare: number;
    estimatedShare: number;
    nodeCount: number;
  }>;
  nodes: Array<{
    id: string;
    name: string;
    tier: 1 | 2 | 3;
    attributableEmissions: number;
    confidence: "high" | "medium" | "low";
    estimated: boolean;
    estimationMethod: string;
  }>;
  confidenceSummary: { high: number; medium: number; low: number };
};

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function Category1BreakdownClient() {
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/app/scope3/category-1-breakdown");
      const data = (await res.json().catch(() => ({}))) as {
        breakdown?: Breakdown;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load Category 1 breakdown.");
        setBreakdown(null);
        return;
      }
      setBreakdown(data.breakdown ?? null);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = breakdown?.total ?? 0;

  return (
    <PageFrame
      eyebrow="Scope 3"
      title="Category 1 — Purchased goods"
      help="Category 1 = Tier 1 direct + Tier 2 + Tier 3. Each supplier counted once. Confidence marks actual vs industry estimate."
      actions={
        <div className="flex items-center gap-3">
          <Link
            href="/suppliers"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Suppliers
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => load()}
            disabled={pending}
          >
            Refresh
          </Button>
        </div>
      }
    >
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      {!breakdown && !error ? (
        <EmptyState title="Loading" body="Aggregating Tier 1–3 Category 1 emissions…" />
      ) : null}

      {breakdown ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <PageCard>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Total Cat 1
              </p>
              <div className="mt-2">
                <Metric value={breakdown.total} unit="tCO₂e" size="xl" decimals={1} />
              </div>
            </PageCard>
            <PageCard>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Tier 1 direct
              </p>
              <div className="mt-2">
                <Metric
                  value={breakdown.tier1Direct}
                  unit="tCO₂e"
                  size="lg"
                  decimals={1}
                />
              </div>
            </PageCard>
            <PageCard>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Tier 2
              </p>
              <div className="mt-2">
                <Metric value={breakdown.tier2} unit="tCO₂e" size="lg" decimals={1} />
              </div>
            </PageCard>
            <PageCard>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Tier 3
              </p>
              <div className="mt-2">
                <Metric value={breakdown.tier3} unit="tCO₂e" size="lg" decimals={1} />
              </div>
            </PageCard>
          </div>

          <PageCard>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              By tier
            </h2>
            <div className="mt-4 space-y-4">
              {breakdown.byTier.map((row) => {
                const pct = total > 0 ? (row.emissions / total) * 100 : 0;
                return (
                  <div key={row.tier}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-ink">
                        Tier {row.tier}{" "}
                        <span className="text-ink-muted">({row.nodeCount} nodes)</span>
                      </span>
                      <span className="font-data text-ink">
                        {formatNum(row.emissions)} tCO₂e
                      </span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-[2px] bg-surface-2">
                      <div
                        className="h-full bg-signal"
                        style={{
                          width: `${total > 0 ? (row.actualShare / total) * 100 : 0}%`,
                        }}
                        title="Actual"
                      />
                      <div
                        className="h-full bg-amber"
                        style={{
                          width: `${total > 0 ? (row.estimatedShare / total) * 100 : 0}%`,
                        }}
                        title="Estimated"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-ink-muted">
                      {formatNum(pct)}% of Cat 1 · actual {formatNum(row.actualShare)} ·
                      estimated {formatNum(row.estimatedShare)}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 border-t border-rule pt-3 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-[2px] bg-signal" />
                Actual (high confidence)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-[2px] bg-amber" />
                Estimated (industry / top-down)
              </span>
              <span>
                Confidence nodes: high {breakdown.confidenceSummary.high} · medium{" "}
                {breakdown.confidenceSummary.medium} · low{" "}
                {breakdown.confidenceSummary.low}
              </span>
            </div>
          </PageCard>

          <PageCard>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Suppliers
            </h2>
            {breakdown.nodes.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-muted">
                No Category 1 nodes yet. Add Tier 1 suppliers with NACE and run estimates.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-rule">
                {breakdown.nodes
                  .slice()
                  .sort((a, b) => b.attributableEmissions - a.attributableEmissions)
                  .map((n) => (
                    <li
                      key={n.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm"
                    >
                      <div>
                        {n.id.startsWith("edge:") || n.id.startsWith("synth-") ? (
                          <span className="text-ink">{n.name}</span>
                        ) : (
                          <Link
                            href={`/suppliers/${n.id}/tier-emissions`}
                            className="text-accent underline-offset-2 hover:underline"
                          >
                            {n.name}
                          </Link>
                        )}
                        <span className="ml-2 text-[11px] text-ink-muted">
                          Tier {n.tier} · {n.estimated ? "estimated" : "actual"} ·{" "}
                          {n.confidence} confidence
                        </span>
                      </div>
                      <span className="font-data text-ink">
                        {formatNum(n.attributableEmissions)} tCO₂e
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </PageCard>
        </div>
      ) : null}
    </PageFrame>
  );
}
