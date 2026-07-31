import { NextResponse } from "next/server";

import {
  calculateFeasibility,
  calculatePathway,
  validatePathwayTargets,
} from "@/lib/analytics/pathwayPlanner";
import { parseInterventionsBody } from "@/lib/analytics/pathwayService";
import { getCurrentContext } from "@/lib/auth";

/**
 * GET /api/app/analytics/pathways/feasibility
 * Calculate feasibility (and optional draft plan) without persisting.
 *
 * Query: baselineEmissions, targetEmissions, baselineYear|startYear, targetYear,
 *        peerTypicalAnnualPercent?, distribution?
 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const baselineEmissions = Number(url.searchParams.get("baselineEmissions"));
  const targetEmissions = Number(url.searchParams.get("targetEmissions"));
  const baselineYear = Number(
    url.searchParams.get("baselineYear") ?? url.searchParams.get("startYear"),
  );
  const targetYear = Number(url.searchParams.get("targetYear"));
  const peerRaw = url.searchParams.get("peerTypicalAnnualPercent");
  const peerTypicalAnnualPercent =
    peerRaw !== null && peerRaw !== "" ? Number(peerRaw) : undefined;
  const distributionRaw = url.searchParams.get("distribution");
  const distribution =
    distributionRaw === "front_loaded" || distributionRaw === "back_loaded"
      ? distributionRaw
      : "even";

  const validation = validatePathwayTargets({
    baselineEmissions,
    targetEmissions,
    baselineYear,
    targetYear,
  });
  if (validation) {
    return NextResponse.json({ error: validation }, { status: 400 });
  }

  try {
    const interventions = parseInterventionsBody(
      url.searchParams.get("interventions")
        ? JSON.parse(url.searchParams.get("interventions")!)
        : undefined,
    );

    const feasibility = calculateFeasibility({
      baselineEmissions,
      targetEmissions,
      baselineYear,
      targetYear,
      peerTypicalAnnualPercent: Number.isFinite(peerTypicalAnnualPercent)
        ? peerTypicalAnnualPercent
        : undefined,
    });

    const plan = calculatePathway({
      baselineEmissions,
      targetEmissions,
      baselineYear,
      targetYear,
      distribution,
      interventions,
      peerTypicalAnnualPercent: Number.isFinite(peerTypicalAnnualPercent)
        ? peerTypicalAnnualPercent
        : undefined,
    });

    return NextResponse.json({
      feasibility,
      draft: {
        milestones: plan.milestones,
        timeline: plan.timeline,
        costEstimate: plan.costEstimate,
        targetReduction: plan.targetReduction,
        scienceBasedTargetAlignment: plan.scienceBasedTargetAlignment,
      },
      warning: feasibility.warning,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Feasibility calculation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
