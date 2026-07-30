import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { defaultGlPrefixMap } from "@/lib/calc/spendBasedEmissions";
import { listSpendFactors } from "@/lib/emissions/spendBasedService";
import { incrementApiUsage } from "@/lib/billing/freeTierGates";

/**
 * GET /api/app/emissions/spend-factors?category=&region=
 * List active spend emissions factors from the org registry.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(request.url);
    const category = url.searchParams.get("category") ?? undefined;
    const region = url.searchParams.get("region") ?? undefined;

    const factors = await listSpendFactors(ctx.activeOrg.id, {
      category,
      region,
    });

    await incrementApiUsage(ctx.activeOrg.id);

    return NextResponse.json({
      count: factors.length,
      factors,
      glPrefixMap: defaultGlPrefixMap(),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing spend factors:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
