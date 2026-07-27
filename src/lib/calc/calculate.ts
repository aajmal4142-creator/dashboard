/**
 * lib/calc/calculate.ts — BUILD_PLAN §5. Pure. Zero I/O. Zero framework imports.
 */
import {
  computeScope1,
  computeScope2,
  computeScope3,
  type ScopeComputation,
} from "./emissions";
import {
  bandOf,
  computeEScore,
  computeGScore,
  computeOverall,
  computeSScore,
} from "./scores";
import type {
  BreakdownItem,
  CalcInput,
  CalcResult,
  DatapointValue,
  FactorRecord,
  FactorUsage,
  Measured,
  Quality,
} from "./types";

const SCORE_METRIC_KEYS = {
  employeesTotal: "employees_total",
  employeesWomen: "employees_women",
  renewablePct: "electricity_renewable_pct",
  injuries: "injuries_recordable",
  hoursWorked: "hours_worked_total",
  trainingHours: "training_hours_total",
  boardSize: "board_size",
  boardIndependent: "board_independent",
  policyAntiCorruption: "policy_anti_corruption",
  policyWhistleblower: "policy_whistleblower",
  policyDataPrivacy: "policy_data_privacy",
} as const;

/** OSHA-style TRIR basis: recordable injuries per 200,000 hours worked (~100 FTE-years). */
const TRIR_HOURS_BASIS = 200_000;

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded; // normalise -0 so golden fixtures compare cleanly
}

function valueOf(metrics: Record<string, DatapointValue>, key: string): number | null {
  return metrics[key]?.value ?? null;
}

function isPresent(metrics: Record<string, DatapointValue>, key: string): boolean {
  const dp = metrics[key];
  return dp !== undefined && dp.value !== null && dp.quality !== "missing";
}

function scopeBreakdown(
  scope: ScopeComputation,
  scopeNumber: 1 | 2 | 3,
): BreakdownItem[] {
  const total = scope.components.reduce((sum, c) => sum + c.valueTco2e, 0);
  return scope.components.map((c) => {
    const pct = total > 0 ? (c.valueTco2e / total) * 100 : 0;
    return {
      component: `scope${scopeNumber}_${c.key}`,
      contribution: round2(c.valueTco2e),
      explanation: `${c.label} contributed ${round2(c.valueTco2e)} tCO2e (${round2(pct)}% of Scope ${scopeNumber}).`,
    };
  });
}

function collectFactorsUsed(scopes: ScopeComputation[]): FactorUsage[] {
  const seen = new Map<string, FactorUsage>();
  for (const scope of scopes) {
    for (const component of scope.components) {
      const { factor } = component;
      if (factor.id === "direct-supplier-reported") continue;
      if (!seen.has(factor.id)) {
        seen.set(factor.id, {
          factorId: factor.id,
          key: factor.key,
          value: factor.value,
          source: factor.source,
          year: factor.publicationYear,
        });
      }
    }
  }
  return Array.from(seen.values());
}

function totalOf(scope1: Measured, scope2: Measured, scope3: Measured): Measured {
  const allMissing =
    scope1.quality === "missing" &&
    scope2.quality === "missing" &&
    scope3.quality === "missing";
  const value = scope1.value + scope2.value + scope3.value;
  const quality: Quality = allMissing ? "missing" : "calculated";
  return { value, unit: "tCO2e", quality };
}

/** % of relevant metrics that carry real data (quality !== 'missing' and value present). */
function computeDataQualityPct(metrics: Record<string, DatapointValue>): number {
  const keys = Object.keys(metrics);
  if (keys.length === 0) return 0;
  const present = keys.filter((key) => isPresent(metrics, key)).length;
  return Math.round((present / keys.length) * 100);
}

export function calculate(input: CalcInput, factors: FactorRecord[]): CalcResult {
  const { metrics, context } = input;
  const { region, year } = context;

  const scope1 = computeScope1(metrics, factors, region, year);
  const scope2 = computeScope2(metrics, factors, region, year);
  const scope3 = computeScope3(metrics, factors, region, year);
  const total = totalOf(scope1.measured, scope2.measured, scope3.measured);

  const employees =
    valueOf(metrics, SCORE_METRIC_KEYS.employeesTotal) ?? context.employees ?? 0;
  const carbonPerEmployee = employees > 0 ? total.value / employees : 0;
  const renewablePct =
    valueOf(metrics, SCORE_METRIC_KEYS.renewablePct) ?? context.renewablePct ?? 0;
  const eResult = computeEScore({
    carbonPerEmployeeTco2e: carbonPerEmployee,
    renewablePct,
  });

  const women = valueOf(metrics, SCORE_METRIC_KEYS.employeesWomen) ?? 0;
  const diversityPct = employees > 0 ? (women / employees) * 100 : 0;
  const injuries = valueOf(metrics, SCORE_METRIC_KEYS.injuries) ?? 0;
  const hoursWorked = valueOf(metrics, SCORE_METRIC_KEYS.hoursWorked) ?? 0;
  const injuryRate = hoursWorked > 0 ? (injuries * TRIR_HOURS_BASIS) / hoursWorked : 0;
  const trainingHours = valueOf(metrics, SCORE_METRIC_KEYS.trainingHours) ?? 0;
  const trainingHoursPerEmployee = employees > 0 ? trainingHours / employees : 0;
  const sResult = computeSScore({ diversityPct, injuryRate, trainingHoursPerEmployee });

  const boardSize = valueOf(metrics, SCORE_METRIC_KEYS.boardSize) ?? 0;
  const boardIndependent = valueOf(metrics, SCORE_METRIC_KEYS.boardIndependent) ?? 0;
  const boardIndependencePct = boardSize > 0 ? (boardIndependent / boardSize) * 100 : 0;
  const policiesTrue = [
    SCORE_METRIC_KEYS.policyAntiCorruption,
    SCORE_METRIC_KEYS.policyWhistleblower,
    SCORE_METRIC_KEYS.policyDataPrivacy,
  ].filter((key) => valueOf(metrics, key) === 1).length;
  const gResult = computeGScore({ boardIndependencePct, policiesTrue });

  const overall = computeOverall(eResult.score, sResult.score, gResult.score);
  const band = bandOf(overall);

  const breakdown: BreakdownItem[] = [
    ...scopeBreakdown(scope1, 1),
    ...scopeBreakdown(scope2, 2),
    ...scopeBreakdown(scope3, 3),
    ...eResult.breakdown,
    ...sResult.breakdown,
    ...gResult.breakdown,
  ];

  return {
    scores: { overall, e: eResult.score, s: sResult.score, g: gResult.score },
    emissions: {
      scope1: scope1.measured,
      scope2: scope2.measured,
      scope3: scope3.measured,
      total,
    },
    dataQualityPct: computeDataQualityPct(metrics),
    factorsUsed: collectFactorsUsed([scope1, scope2, scope3]),
    breakdown,
    band,
  };
}
