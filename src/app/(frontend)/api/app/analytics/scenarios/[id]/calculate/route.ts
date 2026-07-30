import { getPayload } from "payload";
import { NextResponse } from "next/server";

import {
  calculatePaybackSchedule,
  calculateScenarioImpact,
  calculateScopeReductionImpact,
  performSensitivityAnalysis,
  runMonteCarloSimulation,
  type ScenarioScope,
  type ScenarioVariable,
} from "@/lib/analytics/scenarioCalculator";
import { resolveOrgBaselineByScope } from "@/lib/analytics/resolveOrgBaseline";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

function toScenarioVariables(
  variables: ScenarioVariable[] | null | undefined,
): ScenarioVariable[] {
  if (!variables) return [];
  return variables.map((v) => ({
    leverId: v.leverId,
    leverName: v.leverName,
    currentValue: v.currentValue,
    targetValue: v.targetValue,
    capexRequired: v.capexRequired ?? 0,
    paybackYears: v.paybackYears ?? undefined,
    implementationTimeline: v.implementationTimeline ?? 1,
    effectiveness: typeof v.effectiveness === "number" ? v.effectiveness : undefined,
  }));
}

function toScopes(raw: unknown): ScenarioScope[] {
  if (!Array.isArray(raw) || raw.length === 0) return [1, 2, 3];
  const out: ScenarioScope[] = [];
  for (const s of raw) {
    const n = Number(s);
    if ((n === 1 || n === 2 || n === 3) && !out.includes(n)) out.push(n);
  }
  return out.length > 0 ? out : [1, 2, 3];
}

/**
 * POST /api/app/analytics/scenarios/[id]/calculate
 * Calculate scenario impact; persist results. Uses org baseline via calc + registry factors.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getPayload({ config });
    const body = (await req.json().catch(() => ({}))) as {
      baselineOverride?: { scope1: number; scope2: number; scope3: number };
    };

    const scenario = await payload.findByID({
      collection: "scenarios",
      id,
    });

    const orgId =
      typeof scenario.organisation === "string"
        ? scenario.organisation
        : scenario.organisation?.id;

    if (!scenario || orgId !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let baseline = body.baselineOverride;
    let baselineMeta: { quality: string; message?: string; periodId: string | null } = {
      quality: "override",
      periodId: null,
    };

    if (!baseline) {
      const resolved = await resolveOrgBaselineByScope(
        payload,
        ctx.activeOrg.id,
        scenario.baselineYear,
      );
      baseline = resolved.baseline;
      baselineMeta = {
        quality: resolved.quality,
        message: resolved.message,
        periodId: resolved.periodId,
      };

      if (
        resolved.quality === "missing" &&
        resolved.baseline.scope1 + resolved.baseline.scope2 + resolved.baseline.scope3 ===
          0
      ) {
        return NextResponse.json(
          {
            error: resolved.message || "Baseline emissions unavailable.",
            hint: "Ensure a reporting period exists for the baseline year with datapoints, and emission factors are seeded.",
          },
          { status: 400 },
        );
      }
    }

    const scopes = toScopes(scenario.scopes);
    const reductionPercent =
      typeof scenario.reductionPercent === "number" ? scenario.reductionPercent : 0;
    const timelineYears =
      typeof scenario.timelineYears === "number" && scenario.timelineYears >= 1
        ? scenario.timelineYears
        : Math.max(1, scenario.targetYear - scenario.baselineYear);
    const costPerTco2e =
      typeof scenario.costPerTco2e === "number" ? scenario.costPerTco2e : undefined;
    const capex =
      typeof scenario.capex === "number"
        ? scenario.capex
        : toScenarioVariables(scenario.variables as ScenarioVariable[] | null).reduce(
            (s, v) => s + v.capexRequired,
            0,
          );

    const variables = toScenarioVariables(
      scenario.variables as ScenarioVariable[] | null | undefined,
    );

    const totalBaseline = baseline.scope1 + baseline.scope2 + baseline.scope3;

    // Prefer reduction%/scope model when reductionPercent set or no levers
    const useReductionModel = reductionPercent > 0 || variables.length === 0;

    const impact = useReductionModel
      ? calculateScopeReductionImpact({
          baseline,
          reductionPercent: reductionPercent || 0,
          scopes,
          baselineYear: scenario.baselineYear,
          targetYear: scenario.targetYear,
          timelineYears,
          capex,
          costPerTco2e,
        })
      : calculateScenarioImpact(
          variables,
          totalBaseline,
          scenario.targetYear,
          scenario.baselineYear,
          { costPerTco2e, scopes, scopeBaseline: baseline },
        );

    const mcSimulation =
      variables.length > 0
        ? runMonteCarloSimulation(
            variables,
            totalBaseline,
            scenario.targetYear,
            scenario.baselineYear,
            1000,
            0.1,
            { costPerTco2e, scopes, scopeBaseline: baseline },
          )
        : null;

    const sensitivity =
      variables.length > 0
        ? performSensitivityAnalysis(
            variables,
            totalBaseline,
            scenario.targetYear,
            scenario.baselineYear,
            { costPerTco2e, scopes, scopeBaseline: baseline },
          )
        : // Sensitivity ±10% on reduction percent for reduction-only scenarios
          (() => {
            const base = impact.targetYearEmissions;
            const plus = calculateScopeReductionImpact({
              baseline,
              reductionPercent: Math.min(100, reductionPercent * 1.1),
              scopes,
              baselineYear: scenario.baselineYear,
              targetYear: scenario.targetYear,
              timelineYears,
              capex,
              costPerTco2e,
            });
            const minus = calculateScopeReductionImpact({
              baseline,
              reductionPercent: Math.max(0, reductionPercent * 0.9),
              scopes,
              baselineYear: scenario.baselineYear,
              targetYear: scenario.targetYear,
              timelineYears,
              capex,
              costPerTco2e,
            });
            const impactPct =
              base === 0 ? 0 : ((base - plus.targetYearEmissions) / base) * 100;
            return [
              {
                leverId: "reduction_percent",
                leverName: "Reduction %",
                impactOnTargetEmissions: impactPct,
                swingTco2e: Math.abs(
                  minus.targetYearEmissions - plus.targetYearEmissions,
                ),
                tornadoRank: 1,
              },
            ];
          })();

    const paybackSchedule =
      impact.annualSavings !== null && impact.annualSavings > 0
        ? calculatePaybackSchedule(impact.totalCapex, timelineYears, impact.annualSavings)
        : null;

    const resultsPayload = {
      impact,
      baseline,
      baselineMeta,
      monteCarlo: mcSimulation
        ? {
            mean: mcSimulation.mean,
            median: mcSimulation.median,
            stdDev: mcSimulation.stdDev,
            confidenceIntervals: mcSimulation.confidenceIntervals,
          }
        : null,
      sensitivity,
      paybackSchedule,
      calculatedAt: new Date().toISOString(),
    };

    const updated = await payload.update({
      collection: "scenarios",
      id,
      data: {
        results: resultsPayload,
        status: "calculated",
      },
    });

    return NextResponse.json({
      scenario: updated,
      impact,
      monteCarlo: mcSimulation,
      sensitivity,
      paybackSchedule,
      baseline,
      baselineMeta,
    });
  } catch (error) {
    console.error("Scenario calculation error:", error);
    return NextResponse.json({ error: "Failed to calculate scenario" }, { status: 500 });
  }
}
