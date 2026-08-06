import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { PROCUREMENT_TRADEOFFS_SLUG } from "@/collections/ProcurementTradeoffs";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildRfpPack,
  computeScenarioTradeoff,
  getOrgTradeoffScenario,
} from "@/lib/procurement";
import config from "@/payload.config";

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/app/procurement/tradeoffs/[id]?pack=1
 * DELETE — remove a saved scenario (write roles)
 * Pass pack=1 to include a plain-text + CSV RFP/vendor comparison pack.
 */
export async function GET(req: Request, { params }: RouteParams) {
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

    const comparison = computeScenarioTradeoff(scenario);
    const params_ = new URL(req.url).searchParams;
    const includePack =
      params_.get("pack") === "1" ||
      params_.get("pack") === "true" ||
      params_.get("pack") === "yes";
    const pack = includePack
      ? buildRfpPack({
          title: scenario.name,
          notes: scenario.notes,
          weights: scenario.weights,
          comparison,
        })
      : null;

    return NextResponse.json({
      scenario,
      comparison,
      canWrite: canWrite(ctx.role),
      pack: pack ?? undefined,
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
