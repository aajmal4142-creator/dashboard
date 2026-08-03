import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { METERS_SLUG } from "@/collections/Meters";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  docToMeter,
  getOrgFacility,
  getOrgMeter,
  isMeterUtility,
} from "@/lib/facilities";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

function canDelete(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * GET /api/app/facilities/meters/[id]
 * PUT — update meter
 * DELETE — remove meter (admin+)
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const meter = await getOrgMeter(payload, ctx.activeOrg.id, id);
    if (!meter) {
      return NextResponse.json({ error: "Meter not found" }, { status: 404 });
    }

    return NextResponse.json({ meter });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Meter get error:", error);
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
    const existing = await getOrgMeter(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Meter not found" }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;
    const utility = body.utility !== undefined ? body.utility : existing.utility;
    const unit =
      typeof body.unit === "string" && body.unit.trim()
        ? body.unit.trim()
        : existing.unit;

    if (!isMeterUtility(utility)) {
      return NextResponse.json(
        { error: "utility must be electricity, gas, water, or heat" },
        { status: 400 },
      );
    }

    let facilityId = existing.facilityId;
    if (body.facilityId !== undefined) {
      if (typeof body.facilityId !== "string" || !body.facilityId.trim()) {
        return NextResponse.json({ error: "facilityId is required" }, { status: 400 });
      }
      facilityId = body.facilityId.trim();
      const facility = await getOrgFacility(payload, ctx.activeOrg.id, facilityId);
      if (!facility) {
        return NextResponse.json(
          { error: "facilityId must reference a facility in this organisation" },
          { status: 400 },
        );
      }
    }

    const updated = await payload.update({
      collection: METERS_SLUG,
      id,
      data: {
        facility: facilityId,
        name,
        utility,
        unit,
        externalId:
          body.externalId !== undefined
            ? typeof body.externalId === "string" && body.externalId.trim()
              ? body.externalId.trim()
              : null
            : existing.externalId,
        active: body.active !== undefined ? body.active !== false : existing.active,
        notes:
          body.notes !== undefined
            ? typeof body.notes === "string" && body.notes.trim()
              ? body.notes.trim()
              : null
            : existing.notes,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ meter: docToMeter(updated) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Meter update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    const existing = await getOrgMeter(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Meter not found" }, { status: 404 });
    }

    await payload.delete({
      collection: METERS_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Meter delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
