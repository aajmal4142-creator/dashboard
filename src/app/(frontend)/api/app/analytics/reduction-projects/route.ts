import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { REDUCTION_PROJECTS_SLUG } from "@/collections/ReductionProjects";
import {
  assertFacilityInOrg,
  buildReductionSummary,
  docToReductionProject,
  isReductionProjectStatus,
  listOrgFacilityOptions,
  listOrgReductionProjects,
} from "@/lib/analytics/reduction";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
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
 * GET /api/app/analytics/reduction-projects — list + summary + facility options
 * POST — create project
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const status =
      statusParam && isReductionProjectStatus(statusParam) ? statusParam : undefined;
    if (statusParam && !status) {
      return NextResponse.json(
        {
          error: "status must be planned, in_progress, completed, or cancelled",
        },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const [projects, facilities] = await Promise.all([
      listOrgReductionProjects(payload, ctx.activeOrg.id, { status }),
      listOrgFacilityOptions(payload, ctx.activeOrg.id),
    ]);
    const summary = buildReductionSummary(projects);

    return NextResponse.json({
      projects,
      total: projects.length,
      summary,
      facilities,
      canWrite: canWrite(ctx.role),
      canDelete: ctx.role === "owner" || ctx.role === "admin",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Reduction projects list error:", error);
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
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const owner = typeof body.owner === "string" ? body.owner.trim() : "";
    const status = body.status === undefined ? "planned" : body.status;
    const planned = Number(body.plannedReductionTco2e);

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!owner) {
      return NextResponse.json({ error: "owner is required" }, { status: 400 });
    }
    if (!isReductionProjectStatus(status)) {
      return NextResponse.json(
        {
          error: "status must be planned, in_progress, completed, or cancelled",
        },
        { status: 400 },
      );
    }
    if (!Number.isFinite(planned) || planned < 0) {
      return NextResponse.json(
        { error: "plannedReductionTco2e must be a non-negative number" },
        { status: 400 },
      );
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

    const facilityId =
      body.facilityId === undefined || body.facilityId === null || body.facilityId === ""
        ? null
        : typeof body.facilityId === "string"
          ? body.facilityId.trim()
          : null;
    if (
      body.facilityId !== undefined &&
      body.facilityId !== null &&
      body.facilityId !== "" &&
      facilityId === null
    ) {
      return NextResponse.json(
        { error: "facilityId must be a string or null" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    if (facilityId) {
      const ok = await assertFacilityInOrg(payload, ctx.activeOrg.id, facilityId);
      if (!ok.ok) {
        return NextResponse.json({ error: ok.error }, { status: 400 });
      }
    }

    const created = await payload.create({
      collection: REDUCTION_PROJECTS_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        title,
        status,
        plannedReductionTco2e: planned,
        actualReductionTco2e:
          actualParsed.value === undefined ? undefined : actualParsed.value,
        owner,
        startDate: startParsed.value === undefined ? undefined : startParsed.value,
        endDate: endParsed.value === undefined ? undefined : endParsed.value,
        facility: facilityId ?? undefined,
        metricKey:
          typeof body.metricKey === "string" && body.metricKey.trim()
            ? body.metricKey.trim()
            : undefined,
        notes:
          typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : undefined,
      },
      depth: 1,
      overrideAccess: true,
    });

    return NextResponse.json(
      { project: docToReductionProject(created) },
      { status: 201 },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Reduction projects create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
