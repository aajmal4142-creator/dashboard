import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { getDecarbonPlan } from "@/lib/analytics/decarbonPlan";
import { listOrgAbatementLevers } from "@/lib/analytics/maccService";
import { listOrgReductionProjects } from "@/lib/analytics/reductionService";
import {
  buildCascadeProgress,
  getOrgCascadedTarget,
} from "@/lib/analytics/targetCascadeService";
import config from "@/payload.config";

/**
 * GET /api/app/analytics/decarbon-plan?cascadeId=
 * Read-only decarbon plan: cascade progress + linked abatement levers (MACC) +
 * linked reduction projects. Missing measured data is surfaced as
 * quality "missing"/"partial" — never coerced to zero.
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cascadeId = new URL(req.url).searchParams.get("cascadeId");
    if (!cascadeId) {
      return NextResponse.json({ error: "cascadeId is required" }, { status: 400 });
    }

    const payload = await getPayload({ config });
    const cascade = await getOrgCascadedTarget(payload, ctx.activeOrg.id, cascadeId);
    if (!cascade) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [allLevers, allProjects] = await Promise.all([
      listOrgAbatementLevers(payload, ctx.activeOrg.id),
      listOrgReductionProjects(payload, ctx.activeOrg.id),
    ]);

    const leverIds = new Set(cascade.abatementLeverIds);
    const projectIds = new Set(cascade.reductionProjectIds);
    const linkedLevers = allLevers.filter((l) => leverIds.has(l.id));
    const linkedProjects = allProjects.filter((p) => projectIds.has(p.id));

    const progress = buildCascadeProgress(cascade);
    const plan = getDecarbonPlan({ cascade, progress, linkedLevers, linkedProjects });

    return NextResponse.json({ plan });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Decarbon plan error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
