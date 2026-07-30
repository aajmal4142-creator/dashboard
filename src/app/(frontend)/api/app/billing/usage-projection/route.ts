import { NextResponse } from "next/server";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { getRealTimeOverageProjection } from "@/lib/billing/overageCalculator";
import { incrementApiUsage } from "@/lib/billing/freeTierGates";

/**
 * GET /api/app/billing/usage-projection
 * Get real-time overage cost projections for current billing period
 */
export async function GET(_request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "billing",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const projection = await getRealTimeOverageProjection(ctx.activeOrg.id);

    // Track API usage
    await incrementApiUsage(ctx.activeOrg.id);

    return NextResponse.json({
      period: "current_month",
      projection,
      lastUpdated: new Date(),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error calculating usage projection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
