import { NextResponse } from "next/server";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  calculateSKUFootprintById,
  updateSKUFootprint,
} from "@/lib/emissions/skuFootprintService";
import { incrementApiUsage } from "@/lib/billing/freeTierGates";

/**
 * POST /api/app/emissions/calculate-sku
 * Calculate product-level carbon footprint for a SKU
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as { skuId?: string; recalculate?: boolean };
    const { skuId, recalculate } = body;

    if (!skuId) {
      return NextResponse.json({ error: "skuId is required" }, { status: 400 });
    }

    const result = recalculate
      ? await updateSKUFootprint(skuId)
      : await calculateSKUFootprintById(skuId);

    await incrementApiUsage(ctx.activeOrg.id);

    return NextResponse.json(result);
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error calculating SKU footprint:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/app/emissions/calculate-sku?skuId=...
 * Get calculated footprint for a SKU
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const skuId = url.searchParams.get("skuId");

    if (!skuId) {
      return NextResponse.json({ error: "skuId is required" }, { status: 400 });
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

    const result = await calculateSKUFootprintById(skuId);

    await incrementApiUsage(ctx.activeOrg.id);

    return NextResponse.json(result);
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching SKU footprint:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
