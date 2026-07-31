import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { calculatePathway, validatePathwayTargets } from "@/lib/analytics/pathwayPlanner";
import {
  parseInterventionsBody,
  planToPayloadData,
} from "@/lib/analytics/pathwayService";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * GET /api/app/analytics/pathways
 * List decarbonization pathways for the active organisation.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await getPayload({ config });

    const pathways = await payload.find({
      collection: "decarbonization-pathways",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      sort: "-createdAt",
      limit: 100,
    });

    return NextResponse.json({
      pathways: pathways.docs,
      total: pathways.totalDocs,
    });
  } catch (error) {
    console.error("Pathways list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

type CreateBody = {
  name?: string;
  description?: string | null;
  baselineEmissions?: number;
  targetEmissions?: number;
  baselineYear?: number;
  targetYear?: number;
  startYear?: number;
  distribution?: "even" | "front_loaded" | "back_loaded";
  interventions?: unknown;
  interventionTemplates?: unknown;
  peerTypicalAnnualPercent?: number;
  includeMilestones?: boolean;
};

/**
 * POST /api/app/analytics/pathways
 * Create a pathway via the wizard (target year + interventions).
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateBody;
    const baselineYear = Number(body.baselineYear ?? body.startYear);
    const targetYear = Number(body.targetYear);
    const baselineEmissions = Number(body.baselineEmissions);
    const targetEmissions = Number(body.targetEmissions);

    const validation = validatePathwayTargets({
      baselineEmissions,
      targetEmissions,
      baselineYear,
      targetYear,
    });
    if (validation) {
      return NextResponse.json({ error: validation }, { status: 400 });
    }

    const interventions = parseInterventionsBody(body.interventions);
    const interventionTemplates = parseInterventionsBody(body.interventionTemplates);

    const plan = calculatePathway({
      name: body.name,
      baselineEmissions,
      targetEmissions,
      baselineYear,
      targetYear,
      distribution: body.distribution,
      interventions,
      interventionTemplates,
      peerTypicalAnnualPercent:
        body.peerTypicalAnnualPercent !== undefined
          ? Number(body.peerTypicalAnnualPercent)
          : undefined,
    });

    const payload = await getPayload({ config });
    const created = await payload.create({
      collection: "decarbonization-pathways",
      data: {
        organisation: ctx.activeOrg.id,
        ...planToPayloadData(plan, {
          description: body.description ?? null,
          status: "draft",
        }),
      },
    });

    return NextResponse.json(
      {
        pathway: created,
        plan: {
          milestones: plan.milestones,
          feasibility: plan.feasibility,
          timeline: plan.timeline,
          costEstimate: plan.costEstimate,
          scienceBasedTargetAlignment: plan.scienceBasedTargetAlignment,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Pathway creation error:", error);
    const message = error instanceof Error ? error.message : "Failed to create pathway";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
