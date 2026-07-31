"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Download } from "lucide-react";

import {
  EmptyState,
  PageCard,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppSelectNative } from "@/components/ui/AppField";
import type {
  ComparePreset,
  CompareType,
  ComparisonResult,
} from "@/lib/analytics/compare";
import { cn } from "@/lib/utils";

type PeriodOption = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  year: number;
};

type RelatedLink = {
  id: string;
  label: string;
  href: string;
  note: string;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

const TYPE_OPTIONS: Array<{ value: CompareType; label: string }> = [
  { value: "yoy", label: "Year over year" },
  { value: "by_department", label: "By department" },
  { value: "by_supplier", label: "By supplier" },
  { value: "by_metric", label: "By metric" },
  { value: "multi_period", label: "Multi-period" },
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
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatNum(n)}%`;
}

function changeClass(direction: "up" | "down" | "flat"): string {
  if (direction === "up") return "text-rust";
  if (direction === "down") return "text-signal";
  return "text-ink-muted";
}

function pickDefaultPeriods(periods: PeriodOption[]): {
  period1: string;
  period2: string;
} {
  if (periods.length >= 2) {
    return { period1: periods[1]!.id, period2: periods[0]!.id };
  }
  if (periods.length === 1) {
    return { period1: periods[0]!.id, period2: periods[0]!.id };
  }
  return { period1: "", period2: "" };
}

export function CompareClient() {
  const [boot, setBoot] = useState<LoadState>({ kind: "loading" });
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [presets, setPresets] = useState<ComparePreset[]>([]);
  const [related, setRelated] = useState<RelatedLink[]>([]);

  const [type, setType] = useState<CompareType>("yoy");
  const [period1, setPeriod1] = useState("");
  const [period2, setPeriod2] = useState("");
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [metricKey, setMetricKey] = useState("");
  const [presetId, setPresetId] = useState("");

  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootPage() {
      try {
        const [periodsRes, presetsRes] = await Promise.all([
          fetch("/api/app/analytics/compare"),
          fetch("/api/app/analytics/compare/presets"),
        ]);

        if (periodsRes.status === 403 || presetsRes.status === 403) {
          if (!cancelled) {
            setBoot({
              kind: "forbidden",
              message: "Sign in with an active organisation to run comparisons.",
            });
          }
          return;
        }

        if (!periodsRes.ok) {
          const body = (await periodsRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Failed to load periods");
        }
        if (!presetsRes.ok) {
          const body = (await presetsRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Failed to load presets");
        }

        const periodsJson = (await periodsRes.json()) as {
          periods: PeriodOption[];
        };
        const presetsJson = (await presetsRes.json()) as {
          presets: ComparePreset[];
          related: RelatedLink[];
        };

        if (cancelled) return;

        setPeriods(periodsJson.periods);
        setPresets(presetsJson.presets);
        setRelated(presetsJson.related ?? []);
        const defaults = pickDefaultPeriods(periodsJson.periods);
        setPeriod1(defaults.period1);
        setPeriod2(defaults.period2);
        setSelectedPeriods(
          periodsJson.periods
            .slice(0, 4)
            .map((p) => p.id)
            .reverse(),
        );
        setBoot({ kind: "ready" });
      } catch (err) {
        if (!cancelled) {
          setBoot({
            kind: "error",
            message:
              err instanceof Error ? err.message : "Failed to load comparison tools",
          });
        }
      }
    }

    void bootPage();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPreset = useCallback(
    (id: string) => {
      setPresetId(id);
      const preset = presets.find((p) => p.id === id);
      if (!preset) return;
      setType(preset.type);
      if (preset.type === "yoy" && periods.length > 0) {
        const now = new Date().getFullYear();
        const baselineYear = now + (preset.yearOffsetBaseline ?? -1);
        const currentYear = now + (preset.yearOffsetCurrent ?? 0);
        const b = periods.find((p) => p.year === baselineYear);
        const c = periods.find((p) => p.year === currentYear);
        if (b) setPeriod1(b.id);
        if (c) setPeriod2(c.id);
      }
    },
    [periods, presets],
  );

  const buildBody = useCallback(
    (exportCsv: boolean) => {
      const body: Record<string, unknown> = { type, exportCsv };
      if (metricKey.trim()) body.metricKey = metricKey.trim();
      if (presetId && type === "yoy") body.presetId = presetId;

      if (type === "multi_period") {
        body.periods =
          selectedPeriods.length >= 2
            ? selectedPeriods
            : periods
                .slice(0, 4)
                .map((p) => p.id)
                .reverse();
      } else {
        body.period1 = period1;
        body.period2 = period2;
      }
      return body;
    },
    [type, metricKey, presetId, selectedPeriods, periods, period1, period2],
  );

  const runCompare = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch("/api/app/analytics/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(false)),
      });
      const data = (await res.json()) as {
        comparison?: ComparisonResult;
        error?: string;
      };
      if (!res.ok) {
        setComparison(null);
        setRunError(data.error ?? "Comparison failed");
        return;
      }
      setComparison(data.comparison ?? null);
    } catch (err) {
      setComparison(null);
      setRunError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setRunning(false);
    }
  }, [buildBody]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    setRunError(null);
    try {
      const res = await fetch("/api/app/analytics/compare", {
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
      a.download = `compare-${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "CSV export failed");
    } finally {
      setExporting(false);
    }
  }, [buildBody, type]);

  const togglePeriod = (id: string) => {
    setSelectedPeriods((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

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
            <p className={labelClassName()}>Mode</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Compare emissions YoY or activity by dimension. Peer benchmarks, scenarios,
              and TCFD stay on their existing pages.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!hasPeriods || exporting || running}
              onClick={() => void exportCsv()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
            <Button
              type="button"
              disabled={!hasPeriods || running}
              onClick={() => void runCompare()}
            >
              <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
              {running ? "Comparing…" : "Run compare"}
            </Button>
          </div>
        </div>

        {!hasPeriods ? (
          <EmptyState
            title="No reporting periods"
            body="Create a reporting period before running comparisons."
          />
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClassName()} htmlFor="compare-type">
                Comparison type
              </label>
              <select
                id="compare-type"
                className={fieldClassName()}
                value={type}
                onChange={(e) => {
                  setType(e.target.value as CompareType);
                  setPresetId("");
                }}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClassName()} htmlFor="compare-preset">
                Preset
              </label>
              <select
                id="compare-preset"
                className={fieldClassName()}
                value={presetId}
                onChange={(e) => applyPreset(e.target.value)}
              >
                <option value="">Custom</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {type !== "multi_period" ? (
              <>
                <AppSelectNative
                  label="Baseline period"
                  value={period1}
                  onChange={(e) => setPeriod1(e.target.value)}
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </AppSelectNative>
                <AppSelectNative
                  label="Current period"
                  value={period2}
                  onChange={(e) => setPeriod2(e.target.value)}
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </AppSelectNative>
              </>
            ) : (
              <div className="md:col-span-2">
                <p className={labelClassName()}>Periods (select two or more)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {periods.map((p) => {
                    const on = selectedPeriods.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePeriod(p.id)}
                        className={cn(
                          "rounded-sm border px-2.5 py-1.5 text-[12px] transition-colors",
                          on
                            ? "border-accent bg-accent-quiet text-ink"
                            : "border-rule bg-surface-1 text-ink-muted hover:bg-surface-2",
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(type === "by_department" ||
              type === "by_supplier" ||
              type === "by_metric") && (
              <div className="md:col-span-2">
                <label className={labelClassName()} htmlFor="compare-metric">
                  Metric filter (optional)
                </label>
                <input
                  id="compare-metric"
                  className={`${fieldClassName()} font-data`}
                  value={metricKey}
                  onChange={(e) => setMetricKey(e.target.value)}
                  placeholder="e.g. electricity_kwh"
                />
              </div>
            )}
          </div>
        )}

        {runError ? (
          <div className="mt-4">
            <StatusLine tone="error">{runError}</StatusLine>
          </div>
        ) : null}
      </PageCard>

      {related.length > 0 ? (
        <PageCard>
          <p className={labelClassName()}>Related tools</p>
          <ul className="mt-3 divide-y divide-rule">
            {related.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 py-2.5">
                <Link
                  href={r.href}
                  className="text-[13px] font-medium text-accent underline-offset-2 hover:underline"
                >
                  {r.label}
                </Link>
                <span className="text-[12px] text-ink-muted">{r.note}</span>
              </li>
            ))}
          </ul>
        </PageCard>
      ) : null}

      {running && !comparison ? <PageSkeleton rows={4} /> : null}

      {!running && !comparison && !runError ? (
        <EmptyState
          title="No comparison yet"
          body="Choose a type and periods, then run compare."
        />
      ) : null}

      {comparison ? <ComparisonResults result={comparison} /> : null}
    </div>
  );
}

function ComparisonResults({ result }: { result: ComparisonResult }) {
  if (result.kind === "multi_period") {
    return (
      <PageCard>
        <p className={labelClassName()}>Multi-period results</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-rule-strong text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                <th className="py-2 pr-3 font-medium">Period</th>
                <th className="py-2 pr-3 font-medium">Total (tCO2e)</th>
                <th className="py-2 font-medium">vs prior</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-b border-rule last:border-b-0">
                  <td className="py-2.5 pr-3 text-ink">{row.label}</td>
                  <td className="py-2.5 pr-3 font-data text-ink">
                    {formatNum(row.total)}
                  </td>
                  <td
                    className={cn(
                      "py-2.5 font-data",
                      row.changeFromPrevious
                        ? changeClass(row.changeFromPrevious.direction)
                        : "text-ink-muted",
                    )}
                  >
                    {row.changeFromPrevious
                      ? `${formatNum(row.changeFromPrevious.absolute)} (${formatPct(row.changeFromPrevious.percent)})`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <BarStrip
          items={result.rows.map((r) => ({
            label: r.label,
            value: r.total,
          }))}
        />
      </PageCard>
    );
  }

  return (
    <PageCard>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
        <div>
          <p className={labelClassName()}>Summary</p>
          <p className="mt-1 text-[13px] text-ink">
            <span className="text-ink-muted">{result.baseline.label}</span>
            <span className="mx-2 text-ink-muted">→</span>
            <span className="text-ink-muted">{result.current.label}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-data text-[22px] text-ink">
            {formatNum(result.current.total)}
          </p>
          <p
            className={cn("font-data text-[13px]", changeClass(result.change.direction))}
          >
            {formatNum(result.change.absolute)} ({formatPct(result.change.percent)})
          </p>
          <p className="mt-0.5 font-data text-[11px] text-ink-muted">
            baseline {formatNum(result.baseline.total)}
          </p>
        </div>
      </div>

      {result.rows.length === 0 ? (
        <EmptyState
          title="No rows"
          body="No overlapping activity to compare for these periods."
        />
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-rule-strong text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  <th className="py-2 pr-3 font-medium">Series</th>
                  <th className="py-2 pr-3 font-medium">Baseline</th>
                  <th className="py-2 pr-3 font-medium">Current</th>
                  <th className="py-2 pr-3 font-medium">Change</th>
                  <th className="py-2 font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.key} className="border-b border-rule last:border-b-0">
                    <td className="py-2.5 pr-3 text-ink">{row.label}</td>
                    <td className="py-2.5 pr-3 font-data text-ink">
                      {formatNum(row.baseline)}
                    </td>
                    <td className="py-2.5 pr-3 font-data text-ink">
                      {formatNum(row.current)}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 pr-3 font-data",
                        changeClass(row.change.direction),
                      )}
                    >
                      {formatNum(row.change.absolute)} ({formatPct(row.change.percent)})
                    </td>
                    <td className="py-2.5 font-data text-ink-muted">
                      {row.shareOfCurrent != null
                        ? `${formatNum(row.shareOfCurrent)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BarStrip
            items={result.rows.slice(0, 8).map((r) => ({
              label: r.label,
              value: r.current,
            }))}
          />
        </>
      )}
    </PageCard>
  );
}

function BarStrip({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (items.length === 0 || max <= 0) return null;

  return (
    <div className="mt-6 border-t border-rule pt-4">
      <p className={labelClassName()}>Visual</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => {
          const width = Math.max(2, (item.value / max) * 100);
          return (
            <div
              key={item.label}
              className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3"
            >
              <span className="truncate text-[12px] text-ink-muted">{item.label}</span>
              <div className="h-2 rounded-[2px] bg-surface-2">
                <div
                  className="h-2 rounded-[2px] bg-accent"
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="font-data text-[11px] text-ink">
                {formatNum(item.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
