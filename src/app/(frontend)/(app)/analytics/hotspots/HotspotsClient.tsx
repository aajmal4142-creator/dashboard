"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Flame } from "lucide-react";

import {
  EmptyState,
  PageCard,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import type {
  HotspotDimension,
  HotspotResult,
  HotspotSortMode,
} from "@/lib/analytics/hotspots";
import { cn } from "@/lib/utils";

type PeriodOption = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  year: number;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

const DIMENSION_OPTIONS: Array<{ value: HotspotDimension; label: string }> = [
  { value: "facility", label: "Facility" },
  { value: "supplier", label: "Supplier" },
  { value: "category", label: "Category" },
  { value: "metricKey", label: "Metric key" },
];

const SORT_OPTIONS: Array<{ value: HotspotSortMode; label: string }> = [
  { value: "share", label: "Share of total" },
  { value: "value", label: "Value" },
  { value: "change", label: "Change vs baseline" },
];

function fieldClassName(): string {
  return "mt-1 w-full appearance-none rounded-md border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink";
}

function labelClassName(): string {
  return "text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted";
}

function formatNum(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function formatPct(n: number | null): string {
  if (n == null) return "—";
  return `${formatNum(n)}%`;
}

function formatChangePct(n: number | null): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatNum(n)}%`;
}

function changeClass(direction: "up" | "down" | "flat" | undefined): string {
  if (direction === "up") return "text-rust";
  if (direction === "down") return "text-signal";
  return "text-ink-muted";
}

function pickDefaultPeriods(periods: PeriodOption[]): {
  periodId: string;
  baselinePeriodId: string;
} {
  if (periods.length >= 2) {
    return { periodId: periods[0]!.id, baselinePeriodId: periods[1]!.id };
  }
  if (periods.length === 1) {
    return { periodId: periods[0]!.id, baselinePeriodId: "" };
  }
  return { periodId: "", baselinePeriodId: "" };
}

export function HotspotsClient() {
  const [boot, setBoot] = useState<LoadState>({ kind: "loading" });
  const [periods, setPeriods] = useState<PeriodOption[]>([]);

  const [dimension, setDimension] = useState<HotspotDimension>("facility");
  const [periodId, setPeriodId] = useState("");
  const [baselinePeriodId, setBaselinePeriodId] = useState("");
  const [sortBy, setSortBy] = useState<HotspotSortMode>("share");
  const [compareBaseline, setCompareBaseline] = useState(false);

  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<HotspotResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootPage() {
      try {
        const res = await fetch("/api/app/analytics/hotspots");
        if (res.status === 403) {
          if (!cancelled) {
            setBoot({
              kind: "forbidden",
              message: "Sign in with an active organisation to analyse hotspots.",
            });
          }
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Failed to load periods");
        }
        const json = (await res.json()) as { periods: PeriodOption[] };
        if (cancelled) return;
        setPeriods(json.periods);
        const defaults = pickDefaultPeriods(json.periods);
        setPeriodId(defaults.periodId);
        setBaselinePeriodId(defaults.baselinePeriodId);
        setBoot({ kind: "ready" });
      } catch (err) {
        if (!cancelled) {
          setBoot({
            kind: "error",
            message: err instanceof Error ? err.message : "Failed to load hotspot tools",
          });
        }
      }
    }

    void bootPage();
    return () => {
      cancelled = true;
    };
  }, []);

  const buildBody = useCallback(
    (exportCsv: boolean) => {
      const effectiveSort: HotspotSortMode =
        compareBaseline && sortBy === "share" ? "change" : sortBy;
      const body: Record<string, unknown> = {
        dimension,
        periodId,
        sortBy: effectiveSort,
        exportCsv,
      };
      if (compareBaseline && baselinePeriodId) {
        body.baselinePeriodId = baselinePeriodId;
      }
      return body;
    },
    [dimension, periodId, baselinePeriodId, sortBy, compareBaseline],
  );

  const runAnalysis = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch("/api/app/analytics/hotspots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(false)),
      });
      const data = (await res.json()) as {
        hotspots?: HotspotResult;
        error?: string;
      };
      if (!res.ok) {
        setHotspots(null);
        setRunError(data.error ?? "Hotspot analysis failed");
        return;
      }
      setHotspots(data.hotspots ?? null);
    } catch (err) {
      setHotspots(null);
      setRunError(err instanceof Error ? err.message : "Hotspot analysis failed");
    } finally {
      setRunning(false);
    }
  }, [buildBody]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    setRunError(null);
    try {
      const res = await fetch("/api/app/analytics/hotspots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(true)),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setRunError(data?.error ?? "CSV export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hotspots-${dimension}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "CSV export failed");
    } finally {
      setExporting(false);
    }
  }, [buildBody, dimension]);

  if (boot.kind === "loading") {
    return <PageSkeleton rows={6} />;
  }

  if (boot.kind === "forbidden") {
    return <EmptyState title="Organisation required" body={boot.message} />;
  }

  if (boot.kind === "error") {
    return <EmptyState title="Could not load" body={boot.message} />;
  }

  const hasPeriods = periods.length > 0;

  return (
    <div className="space-y-6">
      <PageCard>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule pb-4">
          <div>
            <p className={labelClassName()}>Drill-down</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Rank facilities, suppliers, categories, or metric keys by share of period
              total or change versus a baseline. Missing datapoints are excluded, not
              filled with zeros.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={
                !hasPeriods ||
                exporting ||
                running ||
                !periodId ||
                (compareBaseline && !baselinePeriodId)
              }
              onClick={() => void exportCsv()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
            <Button
              type="button"
              disabled={
                !hasPeriods ||
                running ||
                !periodId ||
                (compareBaseline && !baselinePeriodId)
              }
              onClick={() => void runAnalysis()}
            >
              <Flame className="mr-1.5 h-3.5 w-3.5" />
              {running ? "Analysing…" : "Run hotspots"}
            </Button>
          </div>
        </div>

        {!hasPeriods ? (
          <EmptyState
            title="No reporting periods"
            body="Create a reporting period before analysing emissions hotspots."
          />
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClassName()} htmlFor="hotspot-dimension">
                Dimension
              </label>
              <select
                id="hotspot-dimension"
                className={fieldClassName()}
                value={dimension}
                onChange={(e) => setDimension(e.target.value as HotspotDimension)}
              >
                {DIMENSION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClassName()} htmlFor="hotspot-period">
                Period
              </label>
              <select
                id="hotspot-period"
                className={fieldClassName()}
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClassName()} htmlFor="hotspot-sort">
                Sort by
              </label>
              <select
                id="hotspot-sort"
                className={fieldClassName()}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as HotspotSortMode)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  className="rounded border-rule"
                  checked={compareBaseline}
                  onChange={(e) => {
                    setCompareBaseline(e.target.checked);
                    if (e.target.checked) setSortBy("change");
                    else setSortBy("share");
                  }}
                />
                Compare to baseline period
              </label>
              {compareBaseline ? (
                <div>
                  <label className={labelClassName()} htmlFor="hotspot-baseline">
                    Baseline period
                  </label>
                  <select
                    id="hotspot-baseline"
                    className={fieldClassName()}
                    value={baselinePeriodId}
                    onChange={(e) => setBaselinePeriodId(e.target.value)}
                  >
                    <option value="">Select baseline</option>
                    {periods
                      .filter((p) => p.id !== periodId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {runError ? (
          <div className="mt-4">
            <StatusLine tone="error">{runError}</StatusLine>
          </div>
        ) : null}
      </PageCard>

      {hotspots ? (
        <PageCard>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
            <div>
              <p className={labelClassName()}>Results</p>
              <p className="mt-1 text-[13px] text-ink">
                {hotspots.period.label}
                {hotspots.baseline ? ` vs ${hotspots.baseline.label}` : ""} ·{" "}
                {DIMENSION_OPTIONS.find((d) => d.value === hotspots.dimension)?.label}
              </p>
              <p className="mt-1 font-mono text-[12px] text-ink-muted">
                Period total {formatNum(hotspots.period.total)} · quality{" "}
                {hotspots.period.quality}
                {hotspots.excludedMissingCount > 0
                  ? ` · ${hotspots.excludedMissingCount} excluded (missing)`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[12px]">
              <Link
                href="/analytics/compare"
                className="text-accent hover:text-accent-hover"
              >
                Compare tools
              </Link>
              <Link href="/facilities" className="text-accent hover:text-accent-hover">
                Facilities
              </Link>
            </div>
          </div>

          {hotspots.message ? (
            <div className="mt-4">
              <EmptyState title="No hotspot rows" body={hotspots.message} />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-rule text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                    <th className="py-2 pr-3 font-semibold">Rank</th>
                    <th className="py-2 pr-3 font-semibold">Label</th>
                    <th className="py-2 pr-3 text-right font-semibold">Value</th>
                    {hotspots.baseline ? (
                      <th className="py-2 pr-3 text-right font-semibold">Baseline</th>
                    ) : null}
                    <th className="py-2 pr-3 text-right font-semibold">Share %</th>
                    {hotspots.baseline ? (
                      <th className="py-2 pr-3 text-right font-semibold">Change</th>
                    ) : null}
                    <th className="py-2 font-semibold">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.rows.map((row, index) => (
                    <tr key={row.key} className="border-b border-rule/60">
                      <td className="py-2.5 pr-3 font-mono text-ink-muted">
                        {index + 1}
                      </td>
                      <td className="py-2.5 pr-3 text-ink">
                        <span className="block">{row.label}</span>
                        <span className="font-mono text-[11px] text-ink-muted">
                          {row.key}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                        {formatNum(row.value)}
                      </td>
                      {hotspots.baseline ? (
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-ink-muted">
                          {row.baseline != null ? formatNum(row.baseline) : "—"}
                        </td>
                      ) : null}
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                        {formatPct(row.shareOfTotal)}
                      </td>
                      {hotspots.baseline ? (
                        <td
                          className={cn(
                            "py-2.5 pr-3 text-right font-mono tabular-nums",
                            changeClass(row.change?.direction),
                          )}
                        >
                          {row.change ? (
                            <>
                              {row.change.absolute > 0 ? "+" : ""}
                              {formatNum(row.change.absolute)}
                              <span className="ml-1 text-[11px]">
                                ({formatChangePct(row.change.percent)})
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                      <td className="py-2.5 text-[12px] text-ink-muted">{row.quality}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageCard>
      ) : null}
    </div>
  );
}
