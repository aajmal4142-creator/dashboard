import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  activityQuantitySum,
  asActivityDataRecord,
  asActivityFields,
  asEmissionsFactor,
  isScope3Category,
  relId,
} from "@/lib/scope3/activityHelpers";
import { EmissionsFactorService } from "@/lib/scope3/emissionsFactorService";
import { Scope3Validator } from "@/lib/scope3/validation";
import type { Scope3Activity, Scope3Source } from "@/payload-types";
import config from "@/payload.config";

type RouteCtx = { params: Promise<{ id: string }> };

const ACTIVITY_STATUSES = ["draft", "validated", "approved"] as const;

function isActivityStatus(value: string): value is (typeof ACTIVITY_STATUSES)[number] {
  return (ACTIVITY_STATUSES as readonly string[]).includes(value);
}

function serializeActivity(doc: Scope3Activity) {
  const source =
    typeof doc.source === "object" && doc.source !== null
      ? (doc.source as Scope3Source)
      : null;
  const period =
    typeof doc.period === "object" && doc.period !== null ? doc.period : null;
  const category = source && isScope3Category(source.type) ? source.type : null;

  return {
    id: doc.id,
    sourceId: relId(doc.source) ?? "",
    sourceName: source?.name ?? "Unknown source",
    category,
    periodId: relId(doc.period) ?? "",
    periodLabel:
      period && "label" in period && typeof period.label === "string" ? period.label : "",
    activityData: asActivityDataRecord(doc.activityData),
    activityDataFields: source ? asActivityFields(source.activityDataFields) : [],
    emissionsFactor: source ? asEmissionsFactor(source.emissionsFactor) : null,
    calculatedEmissions: doc.calculatedEmissions,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * PATCH /api/app/scope3/activities/[id]
 * Update activity quantities and/or source (factor reference); recalculates tCO2e.
 */
export async function PATCH(req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "datapoint",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await routeCtx.params;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const body = (await req.json()) as {
      activityData?: Record<string, string | number>;
      sourceId?: string;
      status?: string;
    };

    const payload = await getPayload({ config });
    const existing = await payload.findByID({
      collection: "scope3-activities",
      id,
      depth: 0,
      overrideAccess: true,
    });

    const orgId = relId(existing.organisation);
    if (orgId !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const nextSourceId =
      typeof body.sourceId === "string" && body.sourceId.trim()
        ? body.sourceId.trim()
        : (relId(existing.source) ?? "");

    if (!nextSourceId) {
      return NextResponse.json({ error: "sourceId required" }, { status: 400 });
    }

    const source = await payload.findByID({
      collection: "scope3-sources",
      id: nextSourceId,
      overrideAccess: true,
    });
    const sourceOrg = relId(source.organisation);
    if (sourceOrg !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const activityDataFields = asActivityFields(source.activityDataFields);
    const emissionsFactor = asEmissionsFactor(source.emissionsFactor);
    if (!emissionsFactor) {
      return NextResponse.json(
        { error: "Source emissions factor is invalid" },
        { status: 400 },
      );
    }

    let nextActivityData = asActivityDataRecord(existing.activityData);
    if (body.activityData !== undefined) {
      if (
        typeof body.activityData !== "object" ||
        body.activityData === null ||
        Array.isArray(body.activityData)
      ) {
        return NextResponse.json(
          { error: "activityData must be an object" },
          { status: 400 },
        );
      }
      const validator = new Scope3Validator();
      const validation = await validator.validateActivity(
        body.activityData,
        activityDataFields,
      );
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: validation.errors.map((e) => `${e.field}: ${e.message}`).join("; "),
          },
          { status: 400 },
        );
      }
      nextActivityData = validation.normalizedData ?? {};
    }

    let nextStatus = existing.status;
    if (body.status !== undefined) {
      if (!isActivityStatus(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      nextStatus = body.status;
    }

    const factorService = new EmissionsFactorService({
      factors: [],
      standard: "GHGProtocol2004",
    });
    const quantity = activityQuantitySum(nextActivityData);
    const calculatedEmissions = factorService.calculateEmissions(
      quantity,
      emissionsFactor,
    );

    const updated = await payload.update({
      collection: "scope3-activities",
      id,
      data: {
        source: nextSourceId,
        activityData: nextActivityData,
        calculatedEmissions,
        status: nextStatus,
      },
      depth: 1,
      overrideAccess: true,
    });

    return NextResponse.json({
      ok: true,
      activity: serializeActivity(updated as Scope3Activity),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/app/scope3/activities/[id]
 * Contributors may remove records (edit permission) to correct bad imports.
 */
export async function DELETE(_req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "datapoint",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await routeCtx.params;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const payload = await getPayload({ config });
    const existing = await payload.findByID({
      collection: "scope3-activities",
      id,
      depth: 0,
      overrideAccess: true,
    });

    const orgId = relId(existing.organisation);
    if (orgId !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await payload.delete({
      collection: "scope3-activities",
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
