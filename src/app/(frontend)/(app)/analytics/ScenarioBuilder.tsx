"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TrajectoryPoint = { year: number; emissions: number };

type ScenarioImpact = {
  baseline: { scope1: number; scope2: number; scope3: number; total: number };
  scenario: { scope1: number; scope2: number; scope3: number; total: number };
  delta: number;
  reductionPercentApplied: number;
  trajectory: TrajectoryPoint[];
  netZeroYear: number | null;
  year1Emissions: number;
  year5Emissions: number;
  targetYearEmissions: number;
  totalCapex: number;
  annualOperatingCost: number | null;
  annualSavings: number | null;
  roi: number | null;
  paybackPeriod: number | null;
};

type SensitivityRow = {
  leverId: string;
  leverName: string;
  impactOnTargetEmissions: number;
  swingTco2e: number;
  tornadoRank: number;
};

type ScenarioDoc = {
  id: string;
  name: string;
  type?: string | null;
  baselineYear: number;
  targetYear: number;
  reductionPercent?: number | null;
  scopes?: string[] | null;
  category?: string | null;
  timelineYears?: number | null;
  capex?: number | null;
  costPerTco2e?: number | null;
  status?: string | null;
  results?: {
    impact?: ScenarioImpact;
    sensitivity?: SensitivityRow[];
    paybackSchedule?: { year: number; cumulative: number }[] | null;
  } | null;
};

type CompareResponse = {
  comparison: {
    rows: Array<{ year: number; baseline: number; scenarios: Record<string, number> }>;
    names: Record<string, string>;
  };
  scenarios: Array<{ id: string; name: string; impact: ScenarioImpact | null }>;
};

function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function TrajectoryChart({
  series,
}: {
  series: Array<{ id: string; name: string; color: string; points: TrajectoryPoint[] }>;
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;

  const years = Array.from(new Set(all.map((p) => p.year))).sort((a, b) => a - b);
  const maxE = Math.max(...all.map((p) => p.emissions), 1);
  const w = 480;
  const h = 160;
  const pad = 28;

  function x(year: number): number {
    if (years.length <= 1) return pad;
    const i = years.indexOf(year);
    return pad + (i / (years.length - 1)) * (w - pad * 2);
  }
  function y(emissions: number): number {
    return h - pad - (emissions / maxE) * (h - pad * 2);
  }

  const palette = ["var(--accent)", "var(--cobalt)", "var(--signal)"];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full max-w-xl"
      role="img"
      aria-label="Emissions trajectory"
    >
      <line
        x1={pad}
        y1={h - pad}
        x2={w - pad}
        y2={h - pad}
        stroke="var(--rule-strong)"
        strokeWidth={1}
      />
      <line
        x1={pad}
        y1={pad}
        x2={pad}
        y2={h - pad}
        stroke="var(--rule-strong)"
        strokeWidth={1}
      />
      {series.map((s, idx) => {
        const d = s.points
          .slice()
          .sort((a, b) => a.year - b.year)
          .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.year)} ${y(p.emissions)}`)
          .join(" ");
        return (
          <path
            key={s.id}
            d={d}
            fill="none"
            stroke={s.color || palette[idx % palette.length]}
            strokeWidth={2}
          />
        );
      })}
      {years.map((year) => (
        <text
          key={year}
          x={x(year)}
          y={h - 8}
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

export default function ScenarioBuilder() {
  const [scenarios, setScenarios] = useState<ScenarioDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [calculatingId, setCalculatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scopes, setScopes] = useState<string[]>(["1", "2", "3"]);

  const loadScenarios = async () => {
    const response = await fetch("/api/app/analytics/scenarios");
    if (!response.ok) throw new Error("Failed to fetch scenarios");
    const data: { scenarios?: ScenarioDoc[] } = await response.json();
    setScenarios(data.scenarios || []);
  };

  useEffect(() => {
    const run = async () => {
      try {
        await loadScenarios();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load scenarios");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const toggleScope = (s: string) => {
    setScopes((prev) => {
      if (prev.includes(s)) {
        const next = prev.filter((x) => x !== s);
        return next.length > 0 ? next : prev;
      }
      return [...prev, s].sort();
    });
  };

  const handleCreateScenario = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);
    setActionError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const baselineYear = parseInt(String(formData.get("baselineYear")), 10);
      const timelineYears = parseInt(String(formData.get("timelineYears")), 10) || 5;
      const costRaw = formData.get("costPerTco2e");
      const costPerTco2e =
        costRaw && String(costRaw).trim() !== ""
          ? parseFloat(String(costRaw))
          : undefined;

      const response = await fetch("/api/app/analytics/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          type: formData.get("type") || "custom",
          baselineYear,
          targetYear: baselineYear + timelineYears,
          timelineYears,
          reductionPercent: parseFloat(String(formData.get("reductionPercent"))) || 0,
          scopes,
          category: formData.get("category") || "other",
          capex: parseFloat(String(formData.get("capex"))) || 0,
          costPerTco2e,
          variables: [],
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string" ? body.error : "Failed to create scenario",
        );
      }
      await loadScenarios();
      e.currentTarget.reset();
      setScopes(["1", "2", "3"]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create scenario");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCalculate = async (id: string) => {
    setCalculatingId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/app/analytics/scenarios/${id}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : "Failed to calculate scenario",
        );
      }
      await loadScenarios();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to calculate");
    } finally {
      setCalculatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/app/analytics/scenarios/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete scenario");
      setSelected((prev) => prev.filter((x) => x !== id));
      setCompare(null);
      await loadScenarios();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleCompare = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
    setCompare(null);
    setCompareError(null);
  };

  const handleCompare = async () => {
    if (selected.length === 0) return;
    setCompareError(null);
    try {
      const response = await fetch(
        `/api/app/analytics/scenarios/compare?ids=${selected.join(",")}`,
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Compare failed");
      }
      setCompare(body as CompareResponse);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Compare failed");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Unable to load scenarios</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-rule bg-surface-1">
        <CardHeader>
          <CardTitle className="font-display text-ink">Create scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateScenario} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Net zero pathway A" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  className="w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-ink"
                  defaultValue="custom"
                >
                  <option value="baseline">Baseline</option>
                  <option value="optimistic">Optimistic</option>
                  <option value="pessimistic">Pessimistic</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reductionPercent">Reduction %</Label>
                <Input
                  id="reductionPercent"
                  name="reductionPercent"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={30}
                  className="font-data tabular-nums"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  className="w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-ink"
                  defaultValue="renewable"
                >
                  <option value="renewable">Renewable energy</option>
                  <option value="efficiency">Efficiency</option>
                  <option value="behavior">Behavior</option>
                  <option value="fuel_switching">Fuel switching</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="baselineYear">Baseline year</Label>
                <Input
                  id="baselineYear"
                  name="baselineYear"
                  type="number"
                  defaultValue={new Date().getFullYear()}
                  className="font-data tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timelineYears">Timeline (years)</Label>
                <Input
                  id="timelineYears"
                  name="timelineYears"
                  type="number"
                  min={1}
                  defaultValue={5}
                  className="font-data tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capex">Capex (optional)</Label>
                <Input
                  id="capex"
                  name="capex"
                  type="number"
                  min={0}
                  defaultValue={0}
                  className="font-data tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPerTco2e">Cost per tCO2e (optional)</Label>
                <Input
                  id="costPerTco2e"
                  name="costPerTco2e"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Enables cost-benefit"
                  className="font-data tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="flex flex-wrap gap-3">
                {(["1", "2", "3"] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={scopes.includes(s)}
                      onChange={() => toggleScope(s)}
                      className="accent-[var(--accent)]"
                    />
                    Scope {s}
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating…" : "Create scenario"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {scenarios.length > 0 && (
        <Card className="border-rule bg-surface-1">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="font-display text-ink">Scenarios</CardTitle>
            <Button
              type="button"
              variant="outline"
              disabled={selected.length === 0}
              onClick={() => void handleCompare()}
            >
              Compare ({selected.length}/3)
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scenarios.map((scenario) => {
                const impact = scenario.results?.impact;
                const sensitivity = scenario.results?.sensitivity;
                return (
                  <div key={scenario.id} className="rounded-[6px] border border-rule p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selected.includes(scenario.id)}
                            onChange={() => toggleCompare(scenario.id)}
                            disabled={
                              !selected.includes(scenario.id) && selected.length >= 3
                            }
                            className="accent-[var(--accent)]"
                            aria-label={`Select ${scenario.name} for compare`}
                          />
                          <h3 className="font-semibold text-ink">{scenario.name}</h3>
                          <span className="rounded-[2px] border border-rule px-2 py-0.5 text-xs text-ink-muted">
                            {scenario.status || "draft"}
                          </span>
                        </div>
                        <p className="text-sm text-ink-muted">
                          <span className="font-data tabular-nums">
                            {scenario.baselineYear}
                          </span>
                          {" → "}
                          <span className="font-data tabular-nums">
                            {scenario.targetYear}
                          </span>
                          {" · "}
                          <span className="font-data tabular-nums">
                            {fmt(scenario.reductionPercent, 0)}%
                          </span>
                          {" · scopes "}
                          {(scenario.scopes || []).join(", ") || "—"}
                          {" · "}
                          {scenario.category || "other"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleCalculate(scenario.id)}
                          disabled={calculatingId === scenario.id}
                        >
                          {calculatingId === scenario.id ? "Calculating…" : "Calculate"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleDelete(scenario.id)}
                          disabled={deletingId === scenario.id}
                        >
                          {deletingId === scenario.id ? "Deleting…" : "Delete"}
                        </Button>
                      </div>
                    </div>

                    {impact && (
                      <div className="mt-4 space-y-4 border-t border-rule pt-4">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div>
                            <p className="text-xs text-ink-muted">Baseline</p>
                            <p className="font-data text-lg tabular-nums text-ink">
                              {fmt(impact.baseline.total)} tCO2e
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-ink-muted">After</p>
                            <p className="font-data text-lg tabular-nums text-ink">
                              {fmt(impact.scenario.total)} tCO2e
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-ink-muted">Delta / savings</p>
                            <p className="font-data text-lg tabular-nums text-signal">
                              −{fmt(impact.delta)} tCO2e
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-ink-muted">Net-zero estimate</p>
                            <p className="font-data text-lg tabular-nums text-ink">
                              {impact.netZeroYear ?? "—"}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">
                            Trajectory
                          </p>
                          <TrajectoryChart
                            series={[
                              {
                                id: scenario.id,
                                name: scenario.name,
                                color: "var(--accent)",
                                points: impact.trajectory,
                              },
                            ]}
                          />
                        </div>

                        {impact.annualSavings !== null && (
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div>
                              <p className="text-xs text-ink-muted">Annual savings</p>
                              <p className="font-data tabular-nums text-ink">
                                {fmt(impact.annualSavings, 0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-ink-muted">Capex</p>
                              <p className="font-data tabular-nums text-ink">
                                {fmt(impact.totalCapex, 0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-ink-muted">ROI %</p>
                              <p className="font-data tabular-nums text-ink">
                                {fmt(impact.roi, 1)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-ink-muted">Payback (years)</p>
                              <p className="font-data tabular-nums text-ink">
                                {fmt(impact.paybackPeriod, 1)}
                              </p>
                            </div>
                          </div>
                        )}

                        {sensitivity && sensitivity.length > 0 && (
                          <div>
                            <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">
                              Sensitivity ±10%
                            </p>
                            <ul className="space-y-1 text-sm">
                              {sensitivity.map((row) => (
                                <li
                                  key={row.leverId}
                                  className="flex justify-between border-b border-rule py-1"
                                >
                                  <span className="text-ink">
                                    #{row.tornadoRank} {row.leverName}
                                  </span>
                                  <span className="font-data tabular-nums text-ink-muted">
                                    {fmt(row.impactOnTargetEmissions, 2)}% · swing{" "}
                                    {fmt(row.swingTco2e)} tCO2e
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {compareError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Compare failed</AlertTitle>
          <AlertDescription>{compareError}</AlertDescription>
        </Alert>
      )}

      {compare && (
        <Card className="border-rule bg-surface-1">
          <CardHeader>
            <CardTitle className="font-display text-ink">Compare (≤3)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrajectoryChart
              series={Object.entries(compare.comparison.names).map(([id, name], idx) => {
                const colors = ["var(--accent)", "var(--cobalt)", "var(--signal)"];
                const points = compare.comparison.rows.map((row) => ({
                  year: row.year,
                  emissions: row.scenarios[id] ?? row.baseline,
                }));
                return { id, name, color: colors[idx] || "var(--accent)", points };
              })}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-ink-muted">
                    <th className="py-2 pr-4">Year</th>
                    <th className="py-2 pr-4">Baseline</th>
                    {Object.entries(compare.comparison.names).map(([id, name]) => (
                      <th key={id} className="py-2 pr-4">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compare.comparison.rows.map((row) => (
                    <tr key={row.year} className="border-b border-rule">
                      <td className="py-2 pr-4 font-data tabular-nums text-ink">
                        {row.year}
                      </td>
                      <td className="py-2 pr-4 font-data tabular-nums text-ink">
                        {fmt(row.baseline)}
                      </td>
                      {Object.keys(compare.comparison.names).map((id) => (
                        <td
                          key={id}
                          className="py-2 pr-4 font-data tabular-nums text-ink"
                        >
                          {fmt(row.scenarios[id])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {scenarios.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Create a scenario with reduction %, scopes, category, and timeline. Calculate
            uses the organisation baseline from datapoints and registry factors.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
