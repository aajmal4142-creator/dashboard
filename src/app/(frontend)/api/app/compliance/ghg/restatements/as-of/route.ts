import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { assertPeriodInOrg, getAppliedBaseYearInventory } from "@/lib/compliance/ghg";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/ghg/restatements/as-of?baseYearPeriodId=
 * Returns the base-year inventory as currently applied: the most recent
 * final restatement for the period if one exists, else the published
 * snapshot. Never silently substitutes zero for missing figures.
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const baseYearPeriodId = url.searchParams.get("baseYearPeriodId");
    if (!baseYearPeriodId) {
      return NextResponse.json(
        { error: "baseYearPeriodId is required" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const inOrg = await assertPeriodInOrg(payload, ctx.activeOrg.id, baseYearPeriodId);
    if (!inOrg) {
      return NextResponse.json(
        {
          error:
            "baseYearPeriodId must reference a reporting period in this organisation",
        },
        { status: 400 },
      );
    }

    const applied = await getAppliedBaseYearInventory(
      payload,
      ctx.activeOrg.id,
      baseYearPeriodId,
    );

    return NextResponse.json({ baseYearPeriodId, applied });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GHG restatements as-of error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
