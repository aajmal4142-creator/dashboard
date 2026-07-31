"use client";

import { useCallback, useEffect, useState } from "react";

type Confidence = "high" | "medium" | "low";
type ScenarioKey = "conservative" | "baseline" | "aggressive";

type ForecastPointDto = {
  year: number;
  emissions: number;
  confidence_interval: { lower: number; upper: number };
  reasoning: string;
};

type ScenarioDto = {
  scenario: ScenarioKey;
  growthRate: number;
  confidence: Confidence;
  slopePerYear: number;
  latestHistoricalEmissions: number;
  latestHistoricalYear: number;
  points: ForecastPointDto[];
};

type CalculateResponse = {
  baseline: ScenarioDto;
  conservative: ScenarioDto;
  aggressive: ScenarioDto;
  historical: Array<{ year: number; emissions: number }>;
  warnings: string[];
  confidence: Confidence;
  slopePerYear: number;
  assumptionsUsed: {
    growthRates: { conservative: number; baseline: number; aggressive: number };
    efficiencyImprovement: number;
    interventions: Array<{ year: number; reductionTco2e: number; label?: string }>;
    horizonYears: number;
  };
  orgExpectedRevenueGrowth: number | null;
  error?: string;
};

type InterventionDraft = {
  year: string;
  reductionTco2e: string;
  label: string;
};

const SCENARIO_META: Record<
  ScenarioKey,
  { label: string; stroke: string; fill: string }
> = {
  conservative: {
    label: "Conservative",
    stroke: "var(--cobalt)",
    fill: "color-mix(in srgb, var(--cobalt) 18%, transparent)",
  },
  baseline: {
    label: "Baseline",
    stroke: "var(--accent)",
    fill: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  aggressive: {
    label: "Aggressive",
    stroke: "var(--rust)",
    fill: "color-mix(in srgb, var(--rust) 18%, transparent)",
  },
};

function fmtNum(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function pctInputToFraction(raw: string): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return n / 100;
}

function confidenceBadgeClass(c: Confidence): string {
  if (c === "high") return "border-signal text-signal";
  if (c === "medium") return "border-amber text-amber";
  return "border-rust text-rust";
}

function confidenceLabel(c: Confidence, years: number): string {
  const y = years === 1 ? "1 year" : `${years} years`;
  if (c === "high") return `High confidence (${y} data)`;
  if (c === "medium") return `Medium confidence (${y} data)`;
  return `Low confidence (${y} data)`;
}

function ForecastChart({
  historical,
  scenarios,
  visible,
}: {
  historical: Array<{ year: number; emissions: number }>;
  scenarios: Record<ScenarioKey, ScenarioDto>;
  visible: Record<ScenarioKey, boolean>;
}) {
  const projected = (Object.keys(visible) as ScenarioKey[])
    .filter((k) => visible[k])
    .flatMap((k) => scenarios[k].points);

  const allEmissions = [
    ...historical.map((h) => h.emissions),
    ...projected.map((p) => p.emissions),
    ...projected.map((p) => p.confidence_interval.upper),
    ...projected.map((p) => p.confidence_interval.lower),
  ];
  const years = Array.from(
    new Set([...historical.map((h) => h.year), ...projected.map((p) => p.year)]),
  ).sort((a, b) => a - b);

  if (years.length === 0) return null;

  const maxE = Math.max(...allEmissions, 1);
  const minE = 0;
  const w = 560;
  const h = 220;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 32;

  function x(year: number): number {
    if (years.length <= 1) return padL;
    const i = years.indexOf(year);
    return padL + (i / (years.length - 1)) * (w - padL - padR);
  }
  function y(emissions: number): number {
    const span = maxE - minE || 1;
    return padT + (1 - (emissions - minE) / span) * (h - padT - padB);
  }

  const histPath = historical
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.year)} ${y(p.emissions)}`)
    .join(" ");

  const lastHist = historical.length
    ? historical.slice().sort((a, b) => a.year - b.year)[historical.length - 1]
    : null;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label="Historical and projected emissions"
    >
      <line
        x1={padL}
        y1={h - padB}
        x2={w - padR}
        y2={h - padB}
        stroke="var(--rule-strong)"
        strokeWidth={1}
      />
      <line
        x1={padL}
        y1={padT}
        x2={padL}
        y2={h - padB}
        stroke="var(--rule-strong)"
        strokeWidth={1}
      />
      <text
        x={4}
        y={padT + 4}
        className="fill-[var(--ink-muted)]"
        style={{ fontSize: 9, fontFamily: "var(--font-mono), monospace" }}
      >
        {fmtNum(maxE)}
      </text>

      {(Object.keys(visible) as ScenarioKey[]).map((key) => {
        if (!visible[key]) return null;
        const pts = scenarios[key].points.slice().sort((a, b) => a.year - b.year);
        if (pts.length === 0) return null;

        const bandPts = lastHist
          ? [
              {
                year: lastHist.year,
                lower: lastHist.emissions,
                upper: lastHist.emissions,
              },
              ...pts.map((p) => ({
                year: p.year,
                lower: p.confidence_interval.lower,
                upper: p.confidence_interval.upper,
              })),
            ]
          : pts.map((p) => ({
              year: p.year,
              lower: p.confidence_interval.lower,
              upper: p.confidence_interval.upper,
            }));

        const upperPath = bandPts
          .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.year)} ${y(p.upper)}`)
          .join(" ");
        const lowerPath = bandPts
          .slice()
          .reverse()
          .map((p) => `L ${x(p.year)} ${y(p.lower)}`)
          .join(" ");

        const linePts = lastHist
          ? [{ year: lastHist.year, emissions: lastHist.emissions }, ...pts]
          : pts;
        const linePath = linePts
          .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.year)} ${y(p.emissions)}`)
          .join(" ");

        return (
          <g key={key}>
            <path
              d={`${upperPath} ${lowerPath} Z`}
              fill={SCENARIO_META[key].fill}
              stroke="none"
            />
            <path
              d={linePath}
              fill="none"
              stroke={SCENARIO_META[key].stroke}
              strokeWidth={2}
              strokeDasharray="5 4"
            />
          </g>
        );
      })}

      {histPath ? (
        <path d={histPath} fill="none" stroke="var(--ink)" strokeWidth={2.5} />
      ) : null}

      {historical.map((p) => (
        <circle
          key={`h-${p.year}`}
          cx={x(p.year)}
          cy={y(p.emissions)}
          r={3.5}
          fill="var(--ink)"
        />
      ))}

      {years.map((year) => (
        <text
          key={year}
          x={x(year)}
          y={h - 10}
          textAnchor="middle"
          className="fill-[var(--ink-muted)]"
          style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace" }}
        >
          {year}
        </text>
      ))}
    </svg>
  );
}

export default function TrendForecasting() {
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CalculateResponse | null>(null);

  const [baselineGrowthPct, setBaselineGrowthPct] = useState("3");
  const [aggressiveGrowthPct, setAggressiveGrowthPct] = useState("10");
  const [conservativeGrowthPct, setConservativeGrowthPct] = useState("0");
  const [efficiencyPct, setEfficiencyPct] = useState("0");
  const [horizonYears, setHorizonYears] = useState("3");
  const [interventions, setInterventions] = useState<InterventionDraft[]>([]);

  const [visible, setVisible] = useState<Record<ScenarioKey, boolean>>({
    conservative: true,
    baseline: true,
    aggressive: true,
  });

  const runCalculate = useCallback(
    async (opts?: { seedFromOrg?: boolean; persist?: boolean }) => {
      setCalculating(true);
      setError(null);
      try {
        const userAssumptions = opts?.seedFromOrg
          ? {
              efficiencyImprovement: pctInputToFraction(efficiencyPct) ?? 0,
              interventions: interventions
                .filter((iv) => iv.year && iv.reductionTco2e)
                .map((iv) => ({
                  year: Number(iv.year),
                  reductionTco2e: Number(iv.reductionTco2e),
                  label: iv.label || undefined,
                })),
            }
          : {
              baselineGrowthRate: pctInputToFraction(baselineGrowthPct),
              aggressiveGrowthRate: pctInputToFraction(aggressiveGrowthPct),
              conservativeGrowthRate: pctInputToFraction(conservativeGrowthPct),
              efficiencyImprovement: pctInputToFraction(efficiencyPct) ?? 0,
              interventions: interventions
                .filter((iv) => iv.year && iv.reductionTco2e)
                .map((iv) => ({
                  year: Number(iv.year),
                  reductionTco2e: Number(iv.reductionTco2e),
                  label: iv.label || undefined,
                })),
            };

        const body = {
          horizonYears: Math.max(1, Math.min(10, Number(horizonYears) || 3)),
          persist: opts?.persist ?? false,
          userAssumptions,
        };

        const res = await fetch("/api/app/analytics/forecasts/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as CalculateResponse;
        if (!res.ok) {
          throw new Error(json.error ?? "Failed to calculate forecast");
        }

        setData(json);
        if (opts?.seedFromOrg && json.assumptionsUsed?.growthRates) {
          setBaselineGrowthPct(String(json.assumptionsUsed.growthRates.baseline * 100));
          setAggressiveGrowthPct(
            String(json.assumptionsUsed.growthRates.aggressive * 100),
          );
          setConservativeGrowthPct(
            String(json.assumptionsUsed.growthRates.conservative * 100),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to calculate forecast");
        setData(null);
      } finally {
        setCalculating(false);
        setLoading(false);
      }
    },
    [
      aggressiveGrowthPct,
      baselineGrowthPct,
      conservativeGrowthPct,
      efficiencyPct,
      horizonYears,
      interventions,
    ],
  );

  const [assumptionsReady, setAssumptionsReady] = useState(false);

  useEffect(() => {
    void (async () => {
      await runCalculate({ seedFromOrg: true, persist: true });
      setAssumptionsReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once with org defaults
  }, []);

  useEffect(() => {
    if (!assumptionsReady) return;
    const handle = window.setTimeout(() => {
      void runCalculate({ persist: false });
    }, 450);
    return () => window.clearTimeout(handle);
  }, [
    aggressiveGrowthPct,
    baselineGrowthPct,
    conservativeGrowthPct,
    efficiencyPct,
    horizonYears,
    interventions,
    assumptionsReady,
    runCalculate,
  ]);

  const histYears = data?.historical.length ?? 0;
  const focusScenario = data?.baseline;
  const focusPoint = focusScenario?.points[focusScenario.points.length - 1];
  const half =
    focusPoint != null
      ? Math.max(
          focusPoint.emissions - focusPoint.confidence_interval.lower,
          focusPoint.confidence_interval.upper - focusPoint.emissions,
        )
      : null;

  const horizonWarn = Number(horizonYears) > 5;

  if (loading) {
    return (
      <div className="h-64 animate-pulse rounded-[6px] border border-rule bg-surface-1" />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule pb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Predictive forecast
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-ink">
              Emissions trajectory
            </h2>
          </div>
          {data ? (
            <span
              className={`rounded-[2px] border px-2 py-1 text-[11px] font-medium ${confidenceBadgeClass(data.confidence)}`}
            >
              {confidenceLabel(data.confidence, histYears)}
            </span>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-[13px] text-rust">{error}</p> : null}

        {data && focusPoint && half != null ? (
          <p className="mt-4 text-[14px] text-ink">
            Based on {histYears}-year trend, you will emit{" "}
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              {fmtNum(focusPoint.emissions)}
            </span>{" "}
            tCO2e in {focusPoint.year} (vs.{" "}
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              {fmtNum(focusScenario.latestHistoricalEmissions)}
            </span>{" "}
            now). Interval ±
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              {fmtNum(half)}
            </span>
            .
          </p>
        ) : null}

        {data?.warnings?.length ? (
          <ul className="mt-3 space-y-1 text-[12px] text-amber">
            {data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}

        {horizonWarn ? (
          <p className="mt-2 text-[12px] text-amber">
            Extrapolating more than 5 years reduces reliability; intervals widen.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(SCENARIO_META) as ScenarioKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setVisible((v) => ({ ...v, [key]: !v[key] }))}
              className={`rounded-[4px] border px-3 py-1.5 text-[12px] transition-colors ${
                visible[key]
                  ? "border-rule-strong bg-surface-2 text-ink"
                  : "border-rule text-ink-muted"
              }`}
              aria-pressed={visible[key]}
            >
              <span
                className="mr-2 inline-block h-2 w-2 rounded-[2px]"
                style={{ background: SCENARIO_META[key].stroke }}
              />
              {SCENARIO_META[key].label}
              {data ? (
                <span className="ml-1 font-[family-name:var(--font-mono)] tabular-nums text-ink-muted">
                  {(data[key].growthRate * 100).toFixed(0)}%
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {data ? (
          <div className="mt-4 border-t border-rule pt-4">
            <ForecastChart
              historical={data.historical}
              scenarios={{
                conservative: data.conservative,
                baseline: data.baseline,
                aggressive: data.aggressive,
              }}
              visible={visible}
            />
            <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-ink-muted">
              <span>
                <span className="mr-1 inline-block h-0.5 w-4 bg-ink align-middle" />
                Historical
              </span>
              <span>Dashed = projected · Shaded = confidence band</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Assumptions
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          Growth rates and efficiency are configurable. Bounds: growth −50% to 100%,
          efficiency 0–50%, horizon 1–10 years.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-[12px] text-ink-muted">
            Conservative growth (%)
            <input
              type="number"
              step="0.1"
              value={conservativeGrowthPct}
              onChange={(e) => setConservativeGrowthPct(e.target.value)}
              className="mt-1 w-full rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-ink"
            />
          </label>
          <label className="block text-[12px] text-ink-muted">
            Baseline growth (%)
            <input
              type="number"
              step="0.1"
              value={baselineGrowthPct}
              onChange={(e) => setBaselineGrowthPct(e.target.value)}
              className="mt-1 w-full rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-ink"
            />
          </label>
          <label className="block text-[12px] text-ink-muted">
            Aggressive growth (%)
            <input
              type="number"
              step="0.1"
              value={aggressiveGrowthPct}
              onChange={(e) => setAggressiveGrowthPct(e.target.value)}
              className="mt-1 w-full rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-ink"
            />
          </label>
          <label className="block text-[12px] text-ink-muted">
            Efficiency improvement (%/yr)
            <input
              type="number"
              step="0.1"
              min={0}
              max={50}
              value={efficiencyPct}
              onChange={(e) => setEfficiencyPct(e.target.value)}
              className="mt-1 w-full rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-ink"
            />
          </label>
          <label className="block text-[12px] text-ink-muted">
            Horizon (years)
            <input
              type="number"
              step="1"
              min={1}
              max={10}
              value={horizonYears}
              onChange={(e) => setHorizonYears(e.target.value)}
              className="mt-1 w-full rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-ink"
            />
          </label>
        </div>

        <div className="mt-4 border-t border-rule pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-ink">Interventions</p>
            <button
              type="button"
              className="rounded-[4px] border border-rule px-2 py-1 text-[12px] text-ink"
              onClick={() =>
                setInterventions((rows) => [
                  ...rows,
                  { year: "", reductionTco2e: "", label: "" },
                ])
              }
            >
              Add intervention
            </button>
          </div>
          {interventions.length === 0 ? (
            <p className="mt-2 text-[12px] text-ink-muted">
              Optional absolute reductions (e.g. renewable switch −300 tCO2e in 2026).
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {interventions.map((iv, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-4">
                  <input
                    type="number"
                    placeholder="Year"
                    value={iv.year}
                    onChange={(e) =>
                      setInterventions((rows) =>
                        rows.map((r, i) =>
                          i === idx ? { ...r, year: e.target.value } : r,
                        ),
                      )
                    }
                    className="rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-ink"
                  />
                  <input
                    type="number"
                    placeholder="tCO2e reduction"
                    value={iv.reductionTco2e}
                    onChange={(e) =>
                      setInterventions((rows) =>
                        rows.map((r, i) =>
                          i === idx ? { ...r, reductionTco2e: e.target.value } : r,
                        ),
                      )
                    }
                    className="rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-ink"
                  />
                  <input
                    type="text"
                    placeholder="Label"
                    value={iv.label}
                    onChange={(e) =>
                      setInterventions((rows) =>
                        rows.map((r, i) =>
                          i === idx ? { ...r, label: e.target.value } : r,
                        ),
                      )
                    }
                    className="rounded-[4px] border border-rule bg-canvas px-2 py-1.5 text-[13px] text-ink sm:col-span-1"
                  />
                  <button
                    type="button"
                    className="rounded-[4px] border border-rule px-2 py-1 text-[12px] text-ink-muted"
                    onClick={() =>
                      setInterventions((rows) => rows.filter((_, i) => i !== idx))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={calculating}
            onClick={() => void runCalculate({ persist: true })}
            className="rounded-[4px] bg-accent px-4 py-2 text-[13px] text-[var(--canvas)] disabled:opacity-60"
          >
            {calculating ? "Calculating…" : "Save forecast"}
          </button>
        </div>
      </div>

      {data ? (
        <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Scenario detail
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {(Object.keys(SCENARIO_META) as ScenarioKey[]).map((key) => {
              const s = data[key];
              const last = s.points[s.points.length - 1];
              if (!last) return null;
              const band = Math.max(
                last.emissions - last.confidence_interval.lower,
                last.confidence_interval.upper - last.emissions,
              );
              return (
                <div key={key} className="border border-rule p-3">
                  <p className="text-[12px] font-medium text-ink">
                    {SCENARIO_META[key].label}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-lg tabular-nums text-ink">
                    {fmtNum(last.emissions)}{" "}
                    <span className="text-[12px] text-ink-muted">tCO2e</span>
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-[12px] tabular-nums text-ink-muted">
                    {last.year} · ±{fmtNum(band)}
                  </p>
                  <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                    {last.reasoning}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 font-[family-name:var(--font-mono)] text-[12px] tabular-nums text-ink-muted">
            Trend slope {fmtNum(data.slopePerYear, 1)} tCO2e/yr
          </p>
        </div>
      ) : null}
    </div>
  );
}
