import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { deactivateOrgCustomFactor, mapFactorAdminRow } from "@/lib/factors";
import config from "@/payload.config";

type RouteParams = { params: Promise<{ id: string }> };

function canWriteFactors(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * POST /api/app/factors/[id]/deactivate — deactivate an org custom factor.
 * Global seed rows cannot be deactivated.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWriteFactors(ctx.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can deactivate custom emission factors." },
        { status: 403 },
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Factor id is required." }, { status: 400 });
    }

    const payload = await getPayload({ config });
    const result = await deactivateOrgCustomFactor(payload, ctx.activeOrg.id, id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      factor: mapFactorAdminRow(result.factor, ctx.activeOrg.id),
      notice:
        "Factor deactivated. It will not be injected into calc. Missing keys still throw — no default is invented.",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deactivating factor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
