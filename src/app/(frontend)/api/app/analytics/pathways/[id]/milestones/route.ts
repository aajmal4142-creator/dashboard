import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { buildTimeline } from "@/lib/analytics/pathwayPlanner";
import {
  docMilestonesToPure,
  normalizeMilestoneUpdates,
} from "@/lib/analytics/pathwayService";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function orgIdOf(organisation: unknown): string | null {
  if (typeof organisation === "string") return organisation;
  if (organisation && typeof organisation === "object" && "id" in organisation) {
    const id = (organisation as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/**
 * PUT /api/app/analytics/pathways/[id]/milestones
 * Replace pathway milestones (recomputes cumulative + timeline).
 */
export async function PUT(req: Request, context: RouteContext) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Pathway id required" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as { milestones?: unknown };
    const payload = await getPayload({ config });

    const doc = await payload.findByID({
      collection: "decarbonization-pathways",
      id,
    });

    const orgId = orgIdOf(doc.organisation);
    if (!orgId || orgId !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const normalized = normalizeMilestoneUpdates(body.milestones, doc.baselineEmissions);
    if (normalized.error) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const pure = docMilestonesToPure(normalized.milestones);
    const timeline = buildTimeline({
      baselineEmissions: doc.baselineEmissions,
      baselineYear: doc.baselineYear,
      targetYear: doc.targetYear,
      milestones: pure,
    });
    const costEstimate = pure.reduce((sum, m) => sum + m.cost, 0);

    const updated = await payload.update({
      collection: "decarbonization-pathways",
      id,
      data: {
        milestones: normalized.milestones,
        timeline: timeline.map((p) => ({
          year: p.year,
          baselineHold: p.baselineHold,
          pathwayEmissions: p.pathwayEmissions,
          isMilestone: p.isMilestone,
        })),
        costEstimate,
        stages: pure.map((m, index, arr) => ({
          year: m.year,
          targetEmissions: m.pathwayEmissions,
          leversApplied: [
            {
              leverId: `${m.scope}-${m.year}-${index}`,
              leverName: m.action,
              emissionReduction: m.emissionsSaved,
              capexRequired: m.cost,
            },
          ],
          cumulativeCapex: arr
            .slice(0, index + 1)
            .reduce((sum, row) => sum + row.cost, 0),
        })),
      },
    });

    return NextResponse.json({ pathway: updated });
  } catch (error) {
    console.error("Pathway milestones update error:", error);
    return NextResponse.json({ error: "Failed to update milestones" }, { status: 500 });
  }
}
