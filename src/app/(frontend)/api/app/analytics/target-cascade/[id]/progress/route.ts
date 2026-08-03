import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildCascadeProgress,
  getOrgCascadedTarget,
} from "@/lib/analytics/targetCascadeService";
import { listOrgFacilities } from "@/lib/facilities";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/app/analytics/target-cascade/[id]/progress
 * Progress roll-up for one cascade (missing child current ≠ silent zero).
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const cascade = await getOrgCascadedTarget(payload, ctx.activeOrg.id, id);
    if (!cascade) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const facilities = await listOrgFacilities(payload, ctx.activeOrg.id);
    const facilityNameById = new Map(facilities.map((f) => [f.id, f.name]));

    const progress = buildCascadeProgress(cascade);
    const children = progress.children.map((c) => ({
      ...c,
      facilityName: facilityNameById.get(c.facilityId) ?? c.facilityId,
    }));

    return NextResponse.json({
      cascadeId: cascade.id,
      name: cascade.name,
      baselineYear: cascade.baselineYear,
      targetYear: cascade.targetYear,
      progress: { ...progress, children },
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Target cascade progress error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
