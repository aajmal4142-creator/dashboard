import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { FACILITIES_SLUG } from "@/collections/Facilities";
import { METERS_SLUG } from "@/collections/Meters";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  assertCodeUnique,
  assertFacilityParentOk,
  docToFacility,
  getOrgFacility,
  isFacilityType,
  listOrgMeters,
} from "@/lib/facilities";
import { normaliseOpenSupplyHubId } from "@/lib/openSupplyHub";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

function canDelete(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * GET /api/app/facilities/[id]
 * PUT — update
 * DELETE — remove (admin+); also deletes child meters
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
    return NextResponse.json({
      facility: { ...facility, meterCount: meters.length },
      meters,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Facilities get error:", error);
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
    const existing = await getOrgFacility(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;
    const code =
      typeof body.code === "string" && body.code.trim()
        ? body.code.trim()
        : existing.code;
    const facilityType =
      body.facilityType !== undefined ? body.facilityType : existing.facilityType;

    if (!isFacilityType(facilityType)) {
      return NextResponse.json(
        { error: "facilityType must be office, plant, warehouse, or other" },
        { status: 400 },
      );
    }

    let country = existing.country;
    if (body.country !== undefined) {
      if (body.country === null || body.country === "") {
        country = null;
      } else if (typeof body.country === "string") {
        const c = body.country.trim().toUpperCase();
        if (c && !/^[A-Z]{2}$/.test(c)) {
          return NextResponse.json(
            { error: "country must be ISO 3166-1 alpha-2 when provided" },
            { status: 400 },
          );
        }
        country = c || null;
      } else {
        return NextResponse.json(
          { error: "country must be a string or null" },
          { status: 400 },
        );
      }
    }

    let openSupplyHubId = existing.openSupplyHubId;
    if (body.openSupplyHubId !== undefined) {
      if (body.openSupplyHubId === null || body.openSupplyHubId === "") {
        openSupplyHubId = null;
      } else if (typeof body.openSupplyHubId === "string") {
        openSupplyHubId = normaliseOpenSupplyHubId(body.openSupplyHubId);
      } else {
        return NextResponse.json(
          { error: "openSupplyHubId must be a string or null" },
          { status: 400 },
        );
      }
    }

    let parentFacilityId = existing.parentId;
    if (body.parentFacilityId !== undefined) {
      if (body.parentFacilityId === null || body.parentFacilityId === "") {
        parentFacilityId = null;
      } else if (typeof body.parentFacilityId === "string") {
        parentFacilityId = body.parentFacilityId.trim();
      } else {
        return NextResponse.json(
          { error: "parentFacilityId must be a string or null" },
          { status: 400 },
        );
      }
    }

    if (code !== existing.code) {
      const codeOk = await assertCodeUnique(payload, ctx.activeOrg.id, code, id);
      if (!codeOk.ok) {
        return NextResponse.json({ error: codeOk.error }, { status: 400 });
      }
    }

    const parentOk = await assertFacilityParentOk(
      payload,
      ctx.activeOrg.id,
      id,
      parentFacilityId,
    );
    if (!parentOk.ok) {
      return NextResponse.json({ error: parentOk.error }, { status: 400 });
    }

    const updated = await payload.update({
      collection: FACILITIES_SLUG,
      id,
      data: {
        name,
        code,
        facilityType,
        country,
        region:
          body.region !== undefined
            ? typeof body.region === "string" && body.region.trim()
              ? body.region.trim()
              : null
            : existing.region,
        address:
          body.address !== undefined
            ? typeof body.address === "string" && body.address.trim()
              ? body.address.trim()
              : null
            : existing.address,
        active: body.active !== undefined ? body.active !== false : existing.active,
        parentFacility: parentFacilityId,
        openSupplyHubId,
        notes:
          body.notes !== undefined
            ? typeof body.notes === "string" && body.notes.trim()
              ? body.notes.trim()
              : null
            : existing.notes,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ facility: docToFacility(updated) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Facilities update error:", error);
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
    const existing = await getOrgFacility(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const children = await payload.find({
      collection: FACILITIES_SLUG,
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { parentFacility: { equals: id } },
        ],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    });
    if (children.docs.length > 0) {
      return NextResponse.json(
        {
          error: "Reassign or delete child facilities before deleting this site.",
        },
        { status: 400 },
      );
    }

    const meters = await payload.find({
      collection: METERS_SLUG,
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { facility: { equals: id } },
        ],
      },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    });
    for (const m of meters.docs) {
      await payload.delete({
        collection: METERS_SLUG,
        id: String(m.id),
        overrideAccess: true,
      });
    }

    await payload.delete({
      collection: FACILITIES_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true, deletedMeters: meters.docs.length });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Facilities delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
