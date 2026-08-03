import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { METERS_SLUG } from "@/collections/Meters";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  docToMeter,
  getOrgFacility,
  isMeterUtility,
  listOrgMeters,
} from "@/lib/facilities";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

/**
 * GET /api/app/facilities/[id]/meters — list meters for a facility
 * POST — create meter on facility
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const facility = await getOrgFacility(payload, ctx.activeOrg.id, id);
    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const meters = await listOrgMeters(payload, ctx.activeOrg.id, id);
    return NextResponse.json({ meters, total: meters.length });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Facility meters list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: facilityId } = await context.params;
    const payload = await getPayload({ config });
    const facility = await getOrgFacility(payload, ctx.activeOrg.id, facilityId);
    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const utility = body.utility;
    const unit = typeof body.unit === "string" ? body.unit.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!isMeterUtility(utility)) {
      return NextResponse.json(
        { error: "utility must be electricity, gas, water, or heat" },
        { status: 400 },
      );
    }
    if (!unit) {
      return NextResponse.json({ error: "unit is required" }, { status: 400 });
    }

    const created = await payload.create({
      collection: METERS_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        facility: facilityId,
        name,
        utility,
        unit,
        externalId:
          typeof body.externalId === "string" && body.externalId.trim()
            ? body.externalId.trim()
            : undefined,
        active: body.active === false ? false : true,
        notes:
          typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : undefined,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ meter: docToMeter(created) }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Facility meters create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
