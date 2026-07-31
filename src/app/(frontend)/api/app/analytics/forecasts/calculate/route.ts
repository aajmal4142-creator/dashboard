import { getPayload } from "payload";
import { NextResponse } from "next/server";

import {
  calculateEmissionsForecast,
  type ForecastIntervention,
  type ForecastResultSet,
  type ForecastScenarioType,
  type ScenarioForecast,
} from "@/lib/analytics/forecast";
import { loadEmissionsByPeriod } from "@/lib/analytics/loadEmissionsByPeriod";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type CalculateBody = {
  organisationId?: string;
  scenarioType?: ForecastScenarioType;
  horizonYears?: number;
  userAssumptions?: {
    growthRate?: number;
    baselineGrowthRate?: number;
    aggressiveGrowthRate?: number;
    conservativeGrowthRate?: number;
    efficiencyImprovement?: number;
    interventions?: Array<{
      year: number;
      reductionTco2e: number;
      label?: string;
    }>;
  };
  /** Optional override for tests / demos — skips DB history load. */
  emissionsByPeriod?: Array<{ year: number; emissions: number }>;
  persist?: boolean;
};

function serializeScenario(s: ScenarioForecast) {
  return {
    scenario: s.scenario,
    growthRate: s.growthRate,
    confidence: s.confidence,
    slopePerYear: s.slopePerYear,
    latestHistoricalEmissions: s.latestHistoricalEmissions,
    latestHistoricalYear: s.latestHistoricalYear,
    points: s.points.map((p) => ({
      year: p.year,
      emissions: p.emissions,
      confidence_interval: p.confidenceInterval,
      reasoning: p.reasoning,
    })),
  };
}

async function persistScenarios(
  payload: Awaited<ReturnType<typeof getPayload>>,
  organisationId: string,
  result: ForecastResultSet,
) {
  const now = new Date().toISOString();
  const lastYear = result.historical[result.historical.length - 1]?.year;
  const horizonEnd = lastYear
    ? lastYear + result.assumptionsUsed.horizonYears
    : undefined;
  const periodLabel =
    lastYear && horizonEnd ? `${lastYear + 1}–${horizonEnd}` : String(horizonEnd ?? "");

  const createdIds: string[] = [];

  for (const scenario of [result.conservative, result.baseline, result.aggressive]) {
    const finalPoint = scenario.points[scenario.points.length - 1];
    const doc = await payload.create({
      collection: "trend-forecasts",
      data: {
        organisation: organisationId,
        period: periodLabel,
        forecastedEmissions: finalPoint?.emissions ?? 0,
        confidence: scenario.confidence,
        scenario: scenario.scenario,
        methodology: "linear_regression_trend_adjusted",
        lastCalculatedAt: now,
        assumptionsUsed: {
          growthRates: result.assumptionsUsed.growthRates,
          efficiencyImprovement: result.assumptionsUsed.efficiencyImprovement,
          interventions: result.assumptionsUsed.interventions,
          horizonYears: result.assumptionsUsed.horizonYears,
          scenarioGrowthRate: scenario.growthRate,
        },
        projectionPoints: scenario.points.map((p) => ({
          year: p.year,
          emissions: p.emissions,
          lower: p.confidenceInterval.lower,
          upper: p.confidenceInterval.upper,
          reasoning: p.reasoning,
        })),
        historicalYears: result.historical.map((h) => ({
          year: h.year,
          emissions: h.emissions,
        })),
        slopePerYear: result.slopePerYear,
        warnings: result.warnings.map((message) => ({ message })),
        model: "linear_regression",
        baselineDate: now,
        metricKey: "total_emissions_tco2e",
        forecastPeriodMonths: result.assumptionsUsed.horizonYears * 12,
        trendDirection:
          result.slopePerYear > 1
            ? "increasing"
            : result.slopePerYear < -1
              ? "decreasing"
              : "stable",
      },
    });
    createdIds.push(String(doc.id));
  }

  return createdIds;
}

/**
 * POST /api/app/analytics/forecasts/calculate
 * Input: { scenarioType?, userAssumptions?, horizonYears?, persist? }
 * Uses activeOrg from Membership — client organisationId is ignored.
 * Output: { baseline, conservative, aggressive, historical, warnings, confidence }
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as CalculateBody;
    const payload = await getPayload({ config });

    const org = await payload.findByID({
      collection: "organisations",
      id: ctx.activeOrg.id,
      depth: 0,
    });

    const assumptions = body.userAssumptions ?? {};
    const interventions: ForecastIntervention[] = (assumptions.interventions ?? []).map(
      (iv) => ({
        year: iv.year,
        reductionTco2e: iv.reductionTco2e,
        label: iv.label,
      }),
    );

    let emissionsByPeriod = body.emissionsByPeriod;
    let historyMessages: string[] = [];

    if (!emissionsByPeriod || emissionsByPeriod.length === 0) {
      const loaded = await loadEmissionsByPeriod(payload, ctx.activeOrg.id, {
        lookbackYears: 5,
      });
      emissionsByPeriod = loaded.periods;
      historyMessages = loaded.messages;
    }

    if (emissionsByPeriod.length === 0) {
      return NextResponse.json(
        {
          error:
            "Not enough historical emissions to forecast. Add reporting-period datapoints for at least one year.",
          details: historyMessages,
        },
        { status: 400 },
      );
    }

    const orgGrowth =
      typeof assumptions.growthRate === "number"
        ? assumptions.growthRate
        : typeof org.expectedRevenueGrowth === "number"
          ? org.expectedRevenueGrowth
          : null;

    let result: ForecastResultSet;
    try {
      result = calculateEmissionsForecast({
        emissionsByPeriod,
        orgGrowthRate: orgGrowth,
        efficiencyImprovement: assumptions.efficiencyImprovement ?? 0,
        interventions,
        horizonYears: body.horizonYears ?? 3,
        scenarioGrowthRates: {
          conservative: assumptions.conservativeGrowthRate,
          baseline: assumptions.baselineGrowthRate ?? assumptions.growthRate,
          aggressive: assumptions.aggressiveGrowthRate,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid forecast assumptions";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const persist = body.persist !== false;
    let savedIds: string[] = [];
    if (persist) {
      savedIds = await persistScenarios(payload, ctx.activeOrg.id, result);
    }

    return NextResponse.json({
      baseline: serializeScenario(result.baseline),
      conservative: serializeScenario(result.conservative),
      aggressive: serializeScenario(result.aggressive),
      historical: result.historical,
      warnings: result.warnings,
      confidence: result.confidence,
      slopePerYear: result.slopePerYear,
      assumptionsUsed: result.assumptionsUsed,
      orgExpectedRevenueGrowth: org.expectedRevenueGrowth ?? null,
      historyMessages,
      savedIds,
    });
  } catch (error) {
    console.error("Forecast calculate error:", error);
    return NextResponse.json({ error: "Failed to calculate forecast" }, { status: 500 });
  }
}
