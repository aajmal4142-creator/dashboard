import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { REDUCTION_PROJECTS_SLUG } from "@/collections/ReductionProjects";
import {
  assertFacilityInOrg,
  docToReductionProject,
  getOrgReductionProject,
  isReductionProjectStatus,
} from "@/lib/analytics/reduction";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

function canDelete(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

function parseOptionalDate(
  value: unknown,
  field: string,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a date string or null` };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return { ok: false, error: `${field} must be YYYY-MM-DD` };
  }
  return { ok: true, value: trimmed.slice(0, 10) };
}

function parseOptionalActual(
  value: unknown,
): { ok: true; value: number | null | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === "") return { ok: true, value: null };
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return {
      ok: false,
      error: "actualReductionTco2e must be a non-negative number or null",
    };
  }
  return { ok: true, value: n };
}

/**
 * GET /api/app/analytics/reduction-projects/[id]
 * PUT — update
 * DELETE — remove (admin+)
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const project = await getOrgReductionProject(payload, ctx.activeOrg.id, id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      project,
      canWrite: canWrite(ctx.role),
      canDelete: canDelete(ctx.role),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Reduction project get error:", error);
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
    const existing = await getOrgReductionProject(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : existing.title;
    const owner =
      typeof body.owner === "string" && body.owner.trim()
        ? body.owner.trim()
        : existing.owner;
    const status = body.status !== undefined ? body.status : existing.status;
    if (!isReductionProjectStatus(status)) {
      return NextResponse.json(
        {
          error: "status must be planned, in_progress, completed, or cancelled",
        },
        { status: 400 },
      );
    }

    let planned = existing.plannedReductionTco2e;
    if (body.plannedReductionTco2e !== undefined) {
      const n = Number(body.plannedReductionTco2e);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "plannedReductionTco2e must be a non-negative number" },
          { status: 400 },
        );
      }
      planned = n;
    }

    const actualParsed = parseOptionalActual(body.actualReductionTco2e);
    if (!actualParsed.ok) {
      return NextResponse.json({ error: actualParsed.error }, { status: 400 });
    }
    const startParsed = parseOptionalDate(body.startDate, "startDate");
    if (!startParsed.ok) {
      return NextResponse.json({ error: startParsed.error }, { status: 400 });
    }
    const endParsed = parseOptionalDate(body.endDate, "endDate");
    if (!endParsed.ok) {
      return NextResponse.json({ error: endParsed.error }, { status: 400 });
    }

    let facilityId = existing.facilityId;
    if (body.facilityId !== undefined) {
      if (body.facilityId === null || body.facilityId === "") {
        facilityId = null;
      } else if (typeof body.facilityId === "string") {
        facilityId = body.facilityId.trim() || null;
      } else {
        return NextResponse.json(
          { error: "facilityId must be a string or null" },
          { status: 400 },
        );
      }
    }
    if (facilityId) {
      const ok = await assertFacilityInOrg(payload, ctx.activeOrg.id, facilityId);
      if (!ok.ok) {
        return NextResponse.json({ error: ok.error }, { status: 400 });
      }
    }

    let metricKey = existing.metricKey;
    if (body.metricKey !== undefined) {
      if (body.metricKey === null || body.metricKey === "") {
        metricKey = null;
      } else if (typeof body.metricKey === "string") {
        metricKey = body.metricKey.trim() || null;
      } else {
        return NextResponse.json(
          { error: "metricKey must be a string or null" },
          { status: 400 },
        );
      }
    }

    let notes = existing.notes;
    if (body.notes !== undefined) {
      if (body.notes === null || body.notes === "") {
        notes = null;
      } else if (typeof body.notes === "string") {
        notes = body.notes.trim() || null;
      } else {
        return NextResponse.json(
          { error: "notes must be a string or null" },
          { status: 400 },
        );
      }
    }

    const updated = await payload.update({
      collection: REDUCTION_PROJECTS_SLUG,
      id,
      data: {
        title,
        status,
        plannedReductionTco2e: planned,
        actualReductionTco2e:
          actualParsed.value === undefined
            ? existing.actualReductionTco2e
            : actualParsed.value,
        owner,
        startDate:
          startParsed.value === undefined ? existing.startDate : startParsed.value,
        endDate: endParsed.value === undefined ? existing.endDate : endParsed.value,
        facility: facilityId,
        metricKey,
        notes,
      },
      depth: 1,
      overrideAccess: true,
    });

    return NextResponse.json({ project: docToReductionProject(updated) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Reduction project update error:", error);
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
    const existing = await getOrgReductionProject(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await payload.delete({
      collection: REDUCTION_PROJECTS_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Reduction project delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
