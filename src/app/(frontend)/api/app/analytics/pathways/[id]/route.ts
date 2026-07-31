import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { buildPathwayProgress } from "@/lib/analytics/pathwayService";
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
 * GET /api/app/analytics/pathways/[id]
 * Pathway detail + actual-vs-pathway progress.
 */
export async function GET(_req: Request, context: RouteContext) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Pathway id required" }, { status: 400 });
  }

  try {
    const payload = await getPayload({ config });
    const doc = await payload.findByID({
      collection: "decarbonization-pathways",
      id,
    });

    const orgId = orgIdOf(doc.organisation);
    if (!orgId || orgId !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const progress = await buildPathwayProgress({
      payload,
      organisationId: ctx.activeOrg.id,
      pathway: {
        baselineEmissions: doc.baselineEmissions,
        targetEmissions: doc.targetEmissions,
        baselineYear: doc.baselineYear,
        targetYear: doc.targetYear,
        milestones: doc.milestones,
        timeline: doc.timeline?.map((p) => ({
          year: p.year,
          baselineHold: p.baselineHold,
          pathwayEmissions: p.pathwayEmissions,
          isMilestone: Boolean(p.isMilestone),
        })),
        feasibility: doc.feasibility
          ? {
              level: doc.feasibility.level ?? "achievable",
              requiredAnnualReduction: doc.feasibility.requiredAnnualReduction ?? 0,
              requiredAnnualReductionPercent:
                doc.feasibility.requiredAnnualReductionPercent ?? 0,
              peerTypicalAnnualPercent: doc.feasibility.peerTypicalAnnualPercent ?? 5,
              warning: doc.feasibility.warning ?? null,
              message: doc.feasibility.message ?? "",
              baselineEmissions: doc.baselineEmissions,
              targetEmissions: doc.targetEmissions,
              years: doc.targetYear - doc.baselineYear,
            }
          : null,
      },
    });

    return NextResponse.json({
      pathway: doc,
      progress: {
        asOfYear: progress.asOfYear,
        comparison: progress.comparison,
        actualQuality: progress.actualQuality,
        actualMessage: progress.actualMessage,
        timeline: progress.timeline,
      },
    });
  } catch (error) {
    console.error("Pathway get error:", error);
    return NextResponse.json({ error: "Pathway not found" }, { status: 404 });
  }
}
