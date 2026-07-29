import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import {
  calculateScenarioImpact,
  runMonteCarloSimulation,
  performSensitivityAnalysis,
  calculatePaybackSchedule,
  type ScenarioVariable,
} from "@/lib/analytics/scenarioCalculator";

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
  }));
}

/**
 * POST /api/app/analytics/scenarios/[id]/calculate
 * Calculate scenario impact and Monte Carlo
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getPayload({ config });

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

    // Get baseline emissions for the matching reporting year
    const periods = await payload.find({
      collection: "reporting-periods",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 50,
    });

    const baselinePeriod = periods.docs.find(
      (p) => new Date(p.startDate).getFullYear() === scenario.baselineYear,
    );

    if (!baselinePeriod) {
      return NextResponse.json({ error: "Baseline period not found" }, { status: 400 });
    }

    // Calculate emissions for this period
    const datapoints = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: baselinePeriod.id } },
        ],
      },
      limit: 10000,
    });

    // Sum datapoint values as baseline activity / emissions inputs
    const baselineEmissions = datapoints.docs.reduce(
      (sum, dp) => sum + (typeof dp.value === "number" ? dp.value : 0),
      0,
    );

    const variables = toScenarioVariables(
      scenario.variables as ScenarioVariable[] | null | undefined,
    );

    // Calculate scenario impact
    const impact = calculateScenarioImpact(
      variables,
      baselineEmissions,
      scenario.targetYear,
      scenario.baselineYear,
    );

    // Run Monte Carlo simulation
    const mcSimulation = runMonteCarloSimulation(
      variables,
      baselineEmissions,
      scenario.targetYear,
      scenario.baselineYear,
      1000,
    );

    // Perform sensitivity analysis
    const sensitivity = performSensitivityAnalysis(
      variables,
      baselineEmissions,
      scenario.targetYear,
      scenario.baselineYear,
    );

    // Calculate payback schedule
    const paybackSchedule = calculatePaybackSchedule(
      impact.totalCapex,
      scenario.targetYear - scenario.baselineYear,
      impact.annualSavings,
    );

    // Update scenario with results
    const updated = await payload.update({
      collection: "scenarios",
      id,
      data: {
        results: {
          impact,
          monteCarlo: {
            mean: mcSimulation.mean,
            median: mcSimulation.median,
            stdDev: mcSimulation.stdDev,
            confidenceIntervals: mcSimulation.confidenceIntervals,
          },
          sensitivity,
          paybackSchedule,
        },
        status: "calculated",
      },
    });

    return NextResponse.json({
      scenario: updated,
      impact,
      monteCarlo: mcSimulation,
      sensitivity,
      paybackSchedule,
    });
  } catch (error) {
    console.error("Scenario calculation error:", error);
    return NextResponse.json({ error: "Failed to calculate scenario" }, { status: 500 });
  }
}
