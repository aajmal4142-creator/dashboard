import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { PROCUREMENT_TRADEOFFS_SLUG } from "@/collections/ProcurementTradeoffs";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { computeScenarioTradeoff, getOrgTradeoffScenario } from "@/lib/procurement";
import config from "@/payload.config";

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/app/procurement/tradeoffs/[id]
 * DELETE — remove a saved scenario (write roles)
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const payload = await getPayload({ config });
    const scenario = await getOrgTradeoffScenario(payload, ctx.activeOrg.id, id);
    if (!scenario) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      scenario,
      comparison: computeScenarioTradeoff(scenario),
      canWrite: canWrite(ctx.role),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Procurement tradeoff get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const payload = await getPayload({ config });
    const scenario = await getOrgTradeoffScenario(payload, ctx.activeOrg.id, id);
    if (!scenario) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await payload.delete({
      collection: PROCUREMENT_TRADEOFFS_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Procurement tradeoff delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
