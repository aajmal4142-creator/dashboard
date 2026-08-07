import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { FACILITIES_SLUG } from "@/collections/Facilities";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  assertCodeUnique,
  assertFacilityParentOk,
  buildFacilitiesIndex,
  docToFacility,
  isFacilityType,
} from "@/lib/facilities";
import { normaliseOpenSupplyHubId } from "@/lib/openSupplyHub";
import config from "@/payload.config";

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

/**
 * GET /api/app/facilities — list facilities + meters + hierarchy
 * POST — create facility
 */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getPayload({ config });
    const index = await buildFacilitiesIndex(payload, ctx.activeOrg.id);

    return NextResponse.json({
      ...index,
      canWrite: canWrite(ctx.role),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Facilities list error:", error);
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

    const body = (await req.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const facilityType = body.facilityType;
    const parentFacilityId =
      body.parentFacilityId === undefined ||
      body.parentFacilityId === null ||
      body.parentFacilityId === ""
        ? null
        : typeof body.parentFacilityId === "string"
          ? body.parentFacilityId.trim()
          : null;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }
    if (!isFacilityType(facilityType)) {
      return NextResponse.json(
        { error: "facilityType must be office, plant, warehouse, or other" },
        { status: 400 },
      );
    }

    let country: string | null | undefined;
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

    const payload = await getPayload({ config });

    const codeOk = await assertCodeUnique(payload, ctx.activeOrg.id, code);
    if (!codeOk.ok) {
      return NextResponse.json({ error: codeOk.error }, { status: 400 });
    }

    const parentOk = await assertFacilityParentOk(
      payload,
      ctx.activeOrg.id,
      null,
      parentFacilityId,
    );
    if (!parentOk.ok) {
      return NextResponse.json({ error: parentOk.error }, { status: 400 });
    }

    const created = await payload.create({
      collection: FACILITIES_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        name,
        code,
        facilityType,
        country: country === undefined ? undefined : country,
        region:
          typeof body.region === "string" && body.region.trim()
            ? body.region.trim()
            : undefined,
        address:
          typeof body.address === "string" && body.address.trim()
            ? body.address.trim()
            : undefined,
        active: body.active === false ? false : true,
        parentFacility: parentFacilityId ?? undefined,
        notes:
          typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : undefined,
        openSupplyHubId:
          typeof body.openSupplyHubId === "string"
            ? (normaliseOpenSupplyHubId(body.openSupplyHubId) ?? undefined)
            : undefined,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ facility: docToFacility(created) }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Facilities create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
