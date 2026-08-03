import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { updateSKUFootprint } from "@/lib/emissions/skuFootprintService";
import { getOrgProductFootprint } from "@/lib/products";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

/**
 * POST /api/app/analytics/product-footprints/[id]/calculate
 * Recalculate cradle-to-grave footprint from activity lines + user-entered factors.
 */
export async function POST(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const existing = await getOrgProductFootprint(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const result = await updateSKUFootprint(id);
    const product = await getOrgProductFootprint(payload, ctx.activeOrg.id, id);

    return NextResponse.json({
      result: {
        sku: result.sku,
        productName: result.productName,
        totalCarbonFootprintKg: result.totalCarbonFootprint,
        totalTco2e: result.totalTco2e,
        breakdown: result.breakdown,
        quality: result.quality,
        confidence: result.confidence,
      },
      product,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Product footprint calculate error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
