import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import {
  generateOptimizedPathway,
  generateMilestonePathway,
} from "@/lib/analytics/pathwayPlanner";

/**
 * GET /api/app/analytics/pathways
 * List decarbonization pathways for organization
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getPayload({ config });

    const pathways = await payload.find({
      collection: "decarbonization-pathways",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      sort: "-createdAt",
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

/**
 * POST /api/app/analytics/pathways
 * Create new decarbonization pathway
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const payload = await getPayload({ config });

    // Generate optimized pathway
    const pathway = generateOptimizedPathway(
      body.baselineEmissions,
      body.targetEmissions,
      body.baselineYear,
      body.targetYear,
      body.availableLevers || [],
    );

    // Generate milestone pathway if requested
    let milestonePathway = null;
    if (body.includeMilestones) {
      milestonePathway = generateMilestonePathway(
        body.baselineEmissions,
        body.targetEmissions,
        body.baselineYear,
        body.targetYear,
      );
    }

    // Save to database
    const created = await payload.create({
      collection: "decarbonization-pathways",
      data: {
        organisation: ctx.activeOrg.id,
        name: pathway.name,
        description: body.description,
        baselineYear: pathway.baselineYear,
        targetYear: pathway.targetYear,
        baselineEmissions: pathway.baselineEmissions,
        targetEmissions: pathway.targetEmissions,
        targetReduction: pathway.targetReduction,
        stages: pathway.stages,
        scienceBasedTargetAlignment: pathway.scienceBasedTargetAlignment,
        status: "draft",
      },
    });

    return NextResponse.json(
      {
        pathway: created,
        details: pathway,
        milestones: milestonePathway,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Pathway creation error:", error);
    return NextResponse.json({ error: "Failed to create pathway" }, { status: 500 });
  }
}
