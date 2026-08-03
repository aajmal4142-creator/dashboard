"use client";

import { useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import type { MembershipRole } from "@/lib/access/membership";
import type { GapCallout } from "@/lib/benchmarks";
import { sectorLabel } from "@/lib/ui/displayLabels";

type Trend = {
  currentRank: number | null;
  previousRank: number | null;
  delta: number | null;
  direction: "improved" | "worsened" | "flat" | "unknown";
};

type BenchmarkPayload =
  | {
      available: false;
      reason?: string;
      message?: string;
      minCohortSize: number;
      cohortGate?: string;
      benchmarkOptOut?: boolean;
    }
  | {
      available: true;
      sector: string;
      sizeBand?: string;
      geography?: string;
      metricKey: string;
      period?: string;
      matchTier?: string;
      p10?: number;
      p25: number;
      p50: number;
      p75: number;
      p90?: number;
      mean?: number;
      best?: number;
      median?: number;
      cohortSize: number;
      computedAt?: string | null;
      userValue: number | null;
      percentileRank: number | null;
      comparison?: {
        you: number | null;
        median: number;
        best: number;
        mean: number;
      };
      gaps?: GapCallout[];
      trend?: Trend;
      cohortGate?: string;
      improve: Array<{ label: string; href: string }>;
      benchmarkOptOut?: boolean;
    };

function emptyBenchmarkBody(
  data: Extract<BenchmarkPayload, { available: false }>,
): string {
  if (data.reason === "cohorts_not_published") {
    return (
      data.message ??
      "Sector cohorts are not published yet. Mechanism is ready; live publication awaits consent sign-off."
    );
  }
  if (data.reason === "Forbidden") {
    return "This cohort is not available for your organisation yet.";
  }
  return (
    data.message ??
    `Not enough peers yet. We need at least ${data.minCohortSize} organisations before percentiles appear.`
  );
}

function exportComparisonCsv(data: Extract<BenchmarkPayload, { available: true }>) {
  const you = data.comparison?.you ?? data.userValue;
  const median = data.comparison?.median ?? data.p50;
  const best = data.comparison?.best ?? data.best ?? data.p10 ?? "";
  const mean = data.comparison?.mean ?? data.mean ?? "";
  const rows = [
    ["field", "value"],
    ["metricKey", data.metricKey],
    ["sector", data.sector],
    ["sizeBand", data.sizeBand ?? ""],
    ["geography", data.geography ?? ""],
    ["period", data.period ?? ""],
    ["cohortSize", String(data.cohortSize)],
    ["you", you === null || you === undefined ? "" : String(you)],
    ["median", String(median)],
    ["mean", String(mean)],
    ["best", String(best)],
    ["p10", String(data.p10 ?? "")],
    ["p25", String(data.p25)],
    ["p50", String(data.p50)],
    ["p75", String(data.p75)],
    ["p90", String(data.p90 ?? "")],
    ["percentileRank", data.percentileRank === null ? "" : String(data.percentileRank)],
    ["trendDirection", data.trend?.direction ?? ""],
    [
      "trendDelta",
      data.trend?.delta === null || data.trend?.delta === undefined
        ? ""
        : String(data.trend.delta),
    ],
  ];
  for (const g of data.gaps ?? []) {
    rows.push([`gap_${g.metricKey}_vs_median`, String(g.gapVsMedian)]);
    rows.push([`gap_${g.metricKey}_severity`, g.severity]);
  }
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `benchmark-comparison-${data.metricKey}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function severityClass(severity: GapCallout["severity"]): string {
  if (severity === "ahead") return "text-signal";
  if (severity === "behind") return "text-rust";
  return "text-ink-muted";
}

export function BenchmarksClient({
  initial,
  role = null,
}: {
  initial: BenchmarkPayload;
  role?: MembershipRole | null;
}) {
  const [data, setData] = useState(initial);
  const [metricKey, setMetricKey] = useState(
    initial.available ? initial.metricKey : "electricity_kwh",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const canRecompute = role === "owner" || role === "admin";
  const showRecompute = canRecompute || role === null;

  const BENCHMARK_METRICS = [
    { key: "electricity_kwh", label: "Electricity (kWh)" },
    { key: "scope1_tco2e", label: "Scope 1 (tCO₂e)" },
    { key: "scope2_tco2e", label: "Scope 2 (tCO₂e)" },
    { key: "total_tco2e", label: "Total (tCO₂e)" },
  ] as const;

  const [optOut, setOptOut] = useState(
    "benchmarkOptOut" in initial ? Boolean(initial.benchmarkOptOut) : false,
  );

  async function loadMetric(nextKey: string) {
    setStatusTone("neutral");
    setStatus("Loading comparison…");
    const get = await fetch(
      `/api/app/benchmarks?metricKey=${encodeURIComponent(nextKey)}`,
    );
    const next = (await get.json()) as BenchmarkPayload;
    setMetricKey(nextKey);
    setData(next);
    setStatusTone(next.available ? "ok" : "neutral");
    setStatus(next.available ? `Showing ${nextKey}` : null);
  }

  async function toggleOptOut() {
    const next = !optOut;
    setStatusTone("neutral");
    setStatus(next ? "Opting out…" : "Opting in…");
    const res = await fetch("/api/app/benchmarks/opt-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optOut: next }),
    });
    if (!res.ok) {
      setStatusTone("error");
      setStatus("Could not update benchmark preference");
      return;
    }
    setOptOut(next);
    setStatusTone("ok");
    setStatus(
      next ? "Opted out of cohort contribution" : "Opted in to cohort contribution",
    );
  }

  async function recompute() {
    setStatusTone("neutral");
    setStatus("Updating sector comparison…");
    const res = await fetch("/api/app/benchmarks/recompute", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      written?: number;
    };
    if (!res.ok) {
      const raw = body.error ?? "Could not update cohorts";
      setStatusTone("error");
      setStatus(
        raw === "Forbidden"
          ? "Updating cohorts requires an admin or owner. Ask a teammate with that role."
          : raw,
      );
      return;
    }
    const get = await fetch(
      `/api/app/benchmarks?metricKey=${encodeURIComponent(metricKey)}`,
    );
    const next = (await get.json()) as BenchmarkPayload;
    setData(next);
    setStatusTone("ok");
    setStatus(
      body.written && body.written > 0
        ? `Updated ${body.written} cohort(s)`
        : "No new cohorts yet — more organisations need published data",
    );
  }

  return (
    <PageFrame
      eyebrow="Benchmarking"
      title="Sector position"
      help="Comparisons stay private until at least eight organisations share a sector cohort. Peer names are never shown."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {data.available ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => exportComparisonCsv(data)}
            >
              Export comparison
            </Button>
          ) : null}
          {showRecompute ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void recompute()}
            >
              {!data.available ? "Check for new peers" : "Refresh cohorts"}
            </Button>
          ) : role !== null ? (
            <p className="text-[13px] text-ink-muted">Cohort refresh is admin-only</p>
          ) : null}
        </div>
      }
      rail={
        <div className="space-y-3 text-[13px] text-ink-muted">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
            Privacy
          </p>
          <p>
            Opted-out organisations neither contribute nor appear. Small cohorts never
            surface percentiles. No peer names or min/max values are shown. Best is a p10
            proxy, not a named leader.
          </p>
          {"cohortGate" in data && data.cohortGate ? (
            <p className="text-[11px] leading-relaxed">{data.cohortGate}</p>
          ) : null}
          {canRecompute ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void toggleOptOut()}
            >
              {optOut ? "Opt back in" : "Opt out of contribution"}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[12px] text-ink-muted">
            Metric
            <select
              className="ml-2 rounded-[4px] border border-rule bg-surface-1 px-2 py-1.5 font-mono text-[13px] text-ink"
              value={metricKey}
              onChange={(e) => void loadMetric(e.target.value)}
            >
              {BENCHMARK_METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!data.available ? (
          <EmptyState title="No cohort available" body={emptyBenchmarkBody(data)} />
        ) : (
          <>
            <PageCard
              title={`${data.metricKey} · ${sectorLabel(data.sector)} · ${data.cohortSize} organisations`}
            >
              {data.computedAt ? (
                <p className="mb-4 text-[11px] text-ink-muted">
                  As of {new Date(data.computedAt).toISOString().slice(0, 10)}
                  {data.period ? ` · ${data.period}` : ""}
                  {data.sizeBand ? ` · size ${data.sizeBand}` : ""}
                  {data.geography && data.geography !== "all"
                    ? ` · ${data.geography}`
                    : ""}
                </p>
              ) : null}

              <div className="mb-6 grid grid-cols-3 gap-3 border-b border-rule pb-4">
                {(
                  [
                    ["You", data.comparison?.you ?? data.userValue],
                    ["Median", data.comparison?.median ?? data.p50],
                    ["Best", data.comparison?.best ?? data.best ?? data.p10 ?? null],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      {label}
                    </p>
                    <p className="mt-1 font-data text-[18px] text-ink">
                      {value === null || value === undefined
                        ? "—"
                        : value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-end gap-2">
                {(
                  [
                    ["p25", data.p25],
                    ["p50", data.p50],
                    ["p75", data.p75],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex-1">
                    <div
                      className="w-full rounded-[2px] bg-surface-2"
                      style={{
                        height: `${Math.max(8, (value / (data.p75 * 1.4)) * 120)}px`,
                      }}
                    />
                    <p className="mt-2 font-data text-[13px] text-ink">
                      {value.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {data.mean !== undefined ? (
                <p className="mt-4 font-data text-[12px] text-ink-muted">
                  Mean {data.mean.toLocaleString()}
                  {data.p10 !== undefined ? ` · p10 ${data.p10.toLocaleString()}` : ""}
                  {data.p90 !== undefined ? ` · p90 ${data.p90.toLocaleString()}` : ""}
                </p>
              ) : null}

              {data.userValue !== null ? (
                <p className="mt-4 font-data text-[13px] text-ink">
                  You: {data.userValue.toLocaleString()}
                  {data.percentileRank !== null
                    ? ` · ~${data.percentileRank}th percentile`
                    : ""}
                </p>
              ) : (
                <p className="mt-4 text-[13px] text-ink-muted">
                  Enter {data.metricKey} to mark your position.
                </p>
              )}
            </PageCard>

            {data.gaps && data.gaps.length > 0 ? (
              <PageCard title="Gap callouts">
                <ul className="space-y-3">
                  {data.gaps.map((g) => (
                    <li
                      key={g.metricKey}
                      className="border-b border-rule pb-3 last:border-b-0 last:pb-0"
                    >
                      <p className={`text-[13px] ${severityClass(g.severity)}`}>
                        {g.message}
                      </p>
                      <p className="mt-1 font-data text-[11px] text-ink-muted">
                        You {g.yourValue.toLocaleString()} · Median{" "}
                        {g.median.toLocaleString()} · Best {g.best.toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              </PageCard>
            ) : null}

            {data.trend ? (
              <PageCard title="Trend vs peers">
                {data.trend.direction === "unknown" ? (
                  <p className="text-[13px] text-ink-muted">
                    Prior-period cohort not available yet. Rank will trend once two fiscal
                    years of cohorts exist.
                  </p>
                ) : (
                  <p className="text-[13px] text-ink">
                    Percentile{" "}
                    <span className="font-data">
                      {data.trend.previousRank ?? "—"} → {data.trend.currentRank ?? "—"}
                    </span>
                    {data.trend.delta !== null
                      ? ` (${data.trend.delta > 0 ? "+" : ""}${data.trend.delta})`
                      : ""}
                    {" · "}
                    {data.trend.direction === "improved"
                      ? "Improved vs prior cohort"
                      : data.trend.direction === "worsened"
                        ? "Worsened vs prior cohort"
                        : "Flat vs prior cohort"}
                  </p>
                )}
              </PageCard>
            ) : null}

            <PageCard title="How to improve">
              <ul>
                {data.improve.map((a) => (
                  <li key={a.href}>
                    <a
                      href={a.href}
                      className="block border-b border-rule py-2.5 text-[13px] text-ink transition-colors last:border-b-0 hover:bg-surface-2 hover:text-accent"
                    >
                      {a.label}
                    </a>
                  </li>
                ))}
              </ul>
            </PageCard>
          </>
        )}
      </div>
    </PageFrame>
  );
}
