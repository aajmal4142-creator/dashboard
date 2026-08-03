import { NextRequest, NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { resolveBomFactorFromRegistry } from "@/lib/emissions/skuFootprintService";

/** GET /api/app/analytics/product-footprints/suggest-factor?material= */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const material = new URL(req.url).searchParams.get("material")?.trim() ?? "";
    if (!material) {
      return NextResponse.json({ error: "material is required" }, { status: 400 });
    }

    const hit = await resolveBomFactorFromRegistry(ctx.activeOrg.id, material);
    if (!hit) {
      return NextResponse.json({
        found: false,
        message: "No registry factor matched this material. Enter a factor manually.",
      });
    }

    return NextResponse.json({
      found: true,
      factor: hit.factor,
      source: hit.source,
      factorKey: hit.factorKey,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("suggest-factor error:", error);
    return NextResponse.json({ error: "Could not suggest factor" }, { status: 500 });
  }
}
