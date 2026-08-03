import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { PRODUCT_LEVEL_FOOTPRINTING_SLUG } from "@/collections/ProductLevelFootprinting";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  assertPeriodInOrg,
  docToProductFootprint,
  isProductFootprintStatus,
  listOrgPeriods,
  listOrgProductFootprints,
  parseProductFootprintBody,
  toPayloadData,
  type ProductFootprintWriteInput,
} from "@/lib/products";
import config from "@/payload.config";

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

/**
 * GET /api/app/analytics/product-footprints — list + periods
 * POST — create product footprint
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId") ?? undefined;
    const statusParam = url.searchParams.get("status");
    const status =
      statusParam && isProductFootprintStatus(statusParam) ? statusParam : undefined;
    if (statusParam && !status) {
      return NextResponse.json(
        {
          error: "status must be draft, published, verified, or superseded",
        },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const [products, periods] = await Promise.all([
      listOrgProductFootprints(payload, ctx.activeOrg.id, { periodId, status }),
      listOrgPeriods(payload, ctx.activeOrg.id),
    ]);

    return NextResponse.json({
      products,
      total: products.length,
      periods,
      canWrite: canWrite(ctx.role),
      canDelete: ctx.role === "owner" || ctx.role === "admin",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Product footprints list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseProductFootprintBody(body, { partial: false });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const input = parsed.value as ProductFootprintWriteInput;
    if (!input.productName || !input.sku || !input.category) {
      return NextResponse.json(
        { error: "productName, sku, and category are required" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

    if (input.periodId) {
      const ok = await assertPeriodInOrg(payload, ctx.activeOrg.id, input.periodId);
      if (!ok) {
        return NextResponse.json(
          { error: "periodId must belong to this organisation" },
          { status: 400 },
        );
      }
    }

    const write: ProductFootprintWriteInput = {
      productName: input.productName,
      sku: input.sku,
      category: input.category,
      description: input.description ?? null,
      unit: input.unit ?? "per_unit",
      periodId: input.periodId ?? null,
      status: input.status ?? "draft",
      billOfMaterials: input.billOfMaterials ?? [],
      emissionsSources: input.emissionsSources ?? [],
      primaryPackaging: input.primaryPackaging ?? null,
      primaryWeight: input.primaryWeight ?? null,
      secondaryPackaging: input.secondaryPackaging ?? null,
      secondaryWeight: input.secondaryWeight ?? null,
      totalPackagingEmissions: input.totalPackagingEmissions ?? null,
      transportOrigin: input.transportOrigin ?? null,
      transportDestination: input.transportDestination ?? null,
      transportDistance: input.transportDistance ?? null,
      transportMode: input.transportMode ?? null,
      transportEmissionsFactor: input.transportEmissionsFactor ?? null,
      transportUnitsShipped: input.transportUnitsShipped ?? null,
      emissionsFromDecomposition: input.emissionsFromDecomposition ?? null,
      recyclingBenefit: input.recyclingBenefit ?? null,
    };

    const data = {
      ...toPayloadData(write, ctx.activeOrg.id),
      quality: "missing" as const,
      totalCarbonFootprint: null,
    };

    const created = await payload.create({
      collection: PRODUCT_LEVEL_FOOTPRINTING_SLUG,
      // Payload create typing is strict on required/draft unions; shape matches collection.
      data: data as never,
      overrideAccess: true,
    });

    const product = docToProductFootprint(created);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Product footprint create error:", error);
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
