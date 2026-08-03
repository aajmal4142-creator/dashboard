import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { PRODUCT_LEVEL_FOOTPRINTING_SLUG } from "@/collections/ProductLevelFootprinting";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  assertPeriodInOrg,
  docToProductFootprint,
  dtoToWriteInput,
  getOrgProductFootprint,
  parseProductFootprintBody,
  toPayloadData,
} from "@/lib/products";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

function canDelete(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * GET /api/app/analytics/product-footprints/[id]
 * PUT — update
 * DELETE — remove (admin+)
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const product = await getOrgProductFootprint(payload, ctx.activeOrg.id, id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({
      product,
      canWrite: canWrite(ctx.role),
      canDelete: canDelete(ctx.role),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Product footprint get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
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

    const body = await req.json();
    const parsed = parseProductFootprintBody(body, { partial: true });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const merged = dtoToWriteInput(existing, parsed.value);
    if (merged.periodId) {
      const ok = await assertPeriodInOrg(payload, ctx.activeOrg.id, merged.periodId);
      if (!ok) {
        return NextResponse.json(
          { error: "periodId must belong to this organisation" },
          { status: 400 },
        );
      }
    }

    const updated = await payload.update({
      collection: PRODUCT_LEVEL_FOOTPRINTING_SLUG,
      id,
      data: {
        ...toPayloadData(merged, ctx.activeOrg.id),
        // Activity changed — clear stale result until recalculate
        quality: "missing" as const,
        totalCarbonFootprint: null,
        breakdownByStage: null,
        lastCalculatedAt: null,
      } as never,
      overrideAccess: true,
    });

    return NextResponse.json({ product: docToProductFootprint(updated) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Product footprint update error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (/unique|duplicate|sku/i.test(message)) {
      return NextResponse.json(
        { error: "A product with this SKU already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canDelete(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const existing = await getOrgProductFootprint(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await payload.delete({
      collection: PRODUCT_LEVEL_FOOTPRINTING_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Product footprint delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
