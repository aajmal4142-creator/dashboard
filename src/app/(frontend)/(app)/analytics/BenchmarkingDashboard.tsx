"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { EmptyState, PageCard, StatusLine } from "@/components/shell/PageFrame";
import type { GapCallout } from "@/lib/benchmarks";
import { sectorLabel } from "@/lib/ui/displayLabels";

type BenchmarkResponse = {
  available: boolean;
  message?: string;
  reason?: string;
  cohortGate?: string;
  benchmark?: {
    metricKey: string;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    mean?: number;
    best?: number;
    median?: number;
    cohortSize: number;
    yourValue?: number;
    percentileRank?: number;
  };
  peerGroup?: {
    sector: string;
    sizeBand: string;
    geography: string;
    period: string;
    cohortSize: number;
    matchTier: string;
  };
  comparison?: {
    you: number | null;
    median: number;
    best: number;
    mean: number;
  };
  gaps?: GapCallout[];
  trend?: {
    currentRank: number | null;
    previousRank: number | null;
    delta: number | null;
    direction: string;
  };
  status?: string;
  insights?: string[];
};

function statusLabel(status?: string): string {
  if (status === "best_in_class") return "Best in class";
  if (status === "above_median") return "Above median";
  if (status === "below_median") return "Below median";
  return "At median";
}

export default function BenchmarkingDashboard() {
  const [benchmark, setBenchmark] = useState<BenchmarkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBenchmarks = async () => {
      try {
        const response = await fetch(
          "/api/app/analytics/benchmarks?metricKey=electricity_kwh",
        );
        if (!response.ok) throw new Error("Failed to fetch benchmarks");
        const data: BenchmarkResponse = await response.json();
        setBenchmark(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load benchmarking data");
      } finally {
        setLoading(false);
      }
    };

    void fetchBenchmarks();
  }, []);

  if (loading) {
    return (
      <PageCard title="Peer benchmarking">
        <p className="text-[13px] text-ink-muted">Loading cohort…</p>
      </PageCard>
    );
  }

  if (error) {
    return <StatusLine tone="error">{error}</StatusLine>;
  }

  if (!benchmark?.available || !benchmark.benchmark) {
    return (
      <EmptyState
        title="Benchmarking not available"
        body={
          benchmark?.message ||
          "Not enough peers to generate benchmarks. Check back later."
        }
      />
    );
  }

  const b = benchmark.benchmark;
  const comparison = benchmark.comparison ?? {
    you: b.yourValue ?? null,
    median: b.median ?? b.p50,
    best: b.best ?? b.p10,
    mean: b.mean ?? b.p50,
  };

  return (
    <div className="space-y-4">
      <PageCard
        title={`You vs Median vs Best · ${sectorLabel(benchmark.peerGroup?.sector ?? "")}`}
      >
        <p className="mb-4 text-[12px] text-ink-muted">
          {statusLabel(benchmark.status)}
          {b.percentileRank !== undefined ? ` · ~${b.percentileRank}th percentile` : ""}
          {` · ${b.cohortSize} organisations`}
          {" · peer names never shown"}
        </p>
        <div className="grid grid-cols-3 gap-3 border-b border-rule pb-4">
          {(
            [
              ["You", comparison.you],
              ["Median", comparison.median],
              ["Best", comparison.best],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {label}
              </p>
              <p className="mt-1 font-data text-[18px] text-ink">
                {value === null || value === undefined ? "—" : value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">p25</p>
            <p className="font-data text-[13px] text-ink">{b.p25.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">Mean</p>
            <p className="font-data text-[13px] text-ink">
              {(b.mean ?? comparison.mean).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">p75</p>
            <p className="font-data text-[13px] text-ink">{b.p75.toLocaleString()}</p>
          </div>
        </div>
        <p className="mt-4 text-[13px]">
          <Link href="/benchmarks" className="text-accent hover:text-accent-hover">
            Open detailed comparison
          </Link>
        </p>
      </PageCard>

      {benchmark.gaps && benchmark.gaps.length > 0 ? (
        <PageCard title="Gap callouts">
          <ul className="space-y-2">
            {benchmark.gaps.map((g) => (
              <li key={g.metricKey} className="text-[13px] text-ink">
                {g.message}
              </li>
            ))}
          </ul>
        </PageCard>
      ) : null}

      {benchmark.insights && benchmark.insights.length > 0 ? (
        <PageCard title="Insights">
          <ul className="space-y-2">
            {benchmark.insights.map((insight) => (
              <li
                key={insight}
                className="border-b border-rule py-2 text-[13px] text-ink last:border-b-0"
              >
                {insight}
              </li>
            ))}
          </ul>
        </PageCard>
      ) : null}

      {benchmark.cohortGate ? (
        <p className="text-[11px] text-ink-muted">{benchmark.cohortGate}</p>
      ) : null}
    </div>
  );
}
