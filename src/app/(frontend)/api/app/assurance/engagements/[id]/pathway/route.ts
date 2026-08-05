import { NextResponse } from "next/server";
import { getPayload } from "payload";

import {
  coverageForPathway,
  getPathway,
  isAssuranceLevel,
} from "@/lib/assurance/pathways";
import type { AssuranceLevel } from "@/lib/assurance/types";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

type CheckpointRow = {
  checkpointId: string;
  completedAt?: string | null;
  notes?: string | null;
  evidenceIds?: string[] | null;
  id?: string | null;
};

function orgIdOf(organisation: string | { id: string }): string {
  return typeof organisation === "object" ? organisation.id : String(organisation);
}

function completedIdsFrom(rows: CheckpointRow[] | null | undefined): string[] {
  if (!rows) return [];
  return rows.map((r) => r.checkpointId).filter(Boolean);
}

function resolveLevel(value: unknown): AssuranceLevel {
  return isAssuranceLevel(value) ? value : "limited";
}

async function loadEngagementForOrg(id: string, organisationId: string) {
  const payload = await getPayload({ config });
  const engagement = await payload.findByID({
    collection: "assurance-engagements",
    id,
    overrideAccess: true,
  });
  if (orgIdOf(engagement.organisation) !== organisationId) {
    return null;
  }
  return { payload, engagement };
}

type SamplingFields = {
  materialityThresholdTco2e: number | null;
  samplingMethod: string | null;
  samplingPopulationSize: number | null;
  samplingSampleSize: number | null;
  samplingNotes: string | null;
};

function samplingFieldsOf(engagement: Record<string, unknown>): SamplingFields {
  return {
    materialityThresholdTco2e:
      typeof engagement.materialityThresholdTco2e === "number"
        ? engagement.materialityThresholdTco2e
        : null,
    samplingMethod:
      typeof engagement.samplingMethod === "string" ? engagement.samplingMethod : null,
    samplingPopulationSize:
      typeof engagement.samplingPopulationSize === "number"
        ? engagement.samplingPopulationSize
        : null,
    samplingSampleSize:
      typeof engagement.samplingSampleSize === "number"
        ? engagement.samplingSampleSize
        : null,
    samplingNotes:
      typeof engagement.samplingNotes === "string" ? engagement.samplingNotes : null,
  };
}

function pathwayPayload(
  level: AssuranceLevel,
  rows: CheckpointRow[] | null | undefined,
  sampling: SamplingFields,
) {
  const pathway = getPathway(level);
  const completedIds = completedIdsFrom(rows);
  const coverage = coverageForPathway(level, completedIds);
  return {
    level,
    pathway,
    completedIds,
    checkpoints: rows ?? [],
    coverage,
    ...sampling,
  };
}

/**
 * GET /api/app/assurance/engagements/[id]/pathway
 */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const loaded = await loadEngagementForOrg(id, auth.activeOrg.id);
    if (!loaded) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const level = resolveLevel(loaded.engagement.assuranceLevel);
    const rows = (loaded.engagement.pathwayCheckpoints ?? []) as CheckpointRow[];

    return NextResponse.json({
      engagementId: id,
      ...pathwayPayload(
        level,
        rows,
        samplingFieldsOf(loaded.engagement as unknown as Record<string, unknown>),
      ),
    });
  } catch (error) {
    console.error("Error loading pathway progress:", error);
    return NextResponse.json(
      { error: "Failed to load pathway progress" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/app/assurance/engagements/[id]/pathway
 * Body: { assuranceLevel?, mark?: { checkpointId, completed, notes? }, completedIds? }
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canWrite =
    auth.role === "owner" || auth.role === "admin" || auth.role === "contributor";
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      assuranceLevel?: unknown;
      mark?: {
        checkpointId?: unknown;
        completed?: unknown;
        notes?: unknown;
        evidenceIds?: unknown;
      };
      completedIds?: unknown;
      materialityThresholdTco2e?: unknown;
      samplingMethod?: unknown;
      samplingPopulationSize?: unknown;
      samplingSampleSize?: unknown;
      samplingNotes?: unknown;
    };

    const loaded = await loadEngagementForOrg(id, auth.activeOrg.id);
    if (!loaded) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let level = resolveLevel(loaded.engagement.assuranceLevel);
    if (body.assuranceLevel !== undefined) {
      if (!isAssuranceLevel(body.assuranceLevel)) {
        return NextResponse.json(
          { error: "assuranceLevel must be limited or reasonable" },
          { status: 400 },
        );
      }
      level = body.assuranceLevel;
    }

    const pathway = getPathway(level);
    const validIds = new Set(pathway.checkpoints.map((c) => c.id));

    let rows: CheckpointRow[] = [
      ...((loaded.engagement.pathwayCheckpoints ?? []) as CheckpointRow[]),
    ];

    // Switching level drops completions that are not on the new pathway.
    if (body.assuranceLevel !== undefined) {
      rows = rows.filter((r) => validIds.has(r.checkpointId));
    }

    if (Array.isArray(body.completedIds)) {
      const nextIds = body.completedIds.filter(
        (v): v is string => typeof v === "string" && validIds.has(v),
      );
      const now = new Date().toISOString();
      const prevNotes = new Map(
        rows.map((r) => [r.checkpointId, r.notes ?? null] as const),
      );
      rows = nextIds.map((checkpointId) => ({
        checkpointId,
        completedAt: now,
        notes: prevNotes.get(checkpointId) ?? null,
      }));
    }

    if (body.mark) {
      const checkpointId =
        typeof body.mark.checkpointId === "string" ? body.mark.checkpointId : "";
      if (!validIds.has(checkpointId)) {
        return NextResponse.json(
          { error: "Unknown checkpointId for the selected pathway" },
          { status: 400 },
        );
      }
      const completed = body.mark.completed === true;
      const notes = typeof body.mark.notes === "string" ? body.mark.notes : undefined;
      const evidenceIds = Array.isArray(body.mark.evidenceIds)
        ? body.mark.evidenceIds.filter((v): v is string => typeof v === "string")
        : undefined;

      if (completed) {
        const existing = rows.find((r) => r.checkpointId === checkpointId);
        const entry: CheckpointRow = {
          checkpointId,
          completedAt: new Date().toISOString(),
          notes: notes ?? existing?.notes ?? null,
          evidenceIds: evidenceIds ?? existing?.evidenceIds ?? [],
        };
        rows = [...rows.filter((r) => r.checkpointId !== checkpointId), entry];
      } else {
        rows = rows.filter((r) => r.checkpointId !== checkpointId);
      }
    }

    const materialityThresholdTco2e =
      body.materialityThresholdTco2e !== undefined
        ? typeof body.materialityThresholdTco2e === "number" &&
          Number.isFinite(body.materialityThresholdTco2e) &&
          body.materialityThresholdTco2e >= 0
          ? body.materialityThresholdTco2e
          : null
        : undefined;
    const samplingMethod =
      body.samplingMethod !== undefined
        ? typeof body.samplingMethod === "string" && body.samplingMethod.trim()
          ? body.samplingMethod.trim()
          : null
        : undefined;
    const samplingPopulationSize =
      body.samplingPopulationSize !== undefined
        ? typeof body.samplingPopulationSize === "number" &&
          Number.isFinite(body.samplingPopulationSize) &&
          body.samplingPopulationSize >= 0
          ? body.samplingPopulationSize
          : null
        : undefined;
    const samplingSampleSize =
      body.samplingSampleSize !== undefined
        ? typeof body.samplingSampleSize === "number" &&
          Number.isFinite(body.samplingSampleSize) &&
          body.samplingSampleSize >= 0
          ? body.samplingSampleSize
          : null
        : undefined;
    const samplingNotes =
      body.samplingNotes !== undefined
        ? typeof body.samplingNotes === "string" && body.samplingNotes.trim()
          ? body.samplingNotes.trim()
          : null
        : undefined;

    const updated = await loaded.payload.update({
      collection: "assurance-engagements",
      id,
      data: {
        assuranceLevel: level,
        pathwayCheckpoints: rows,
        materialityThresholdTco2e,
        samplingMethod,
        samplingPopulationSize,
        samplingSampleSize,
        samplingNotes,
      },
      overrideAccess: true,
    });

    return NextResponse.json({
      engagementId: id,
      engagement: updated,
      ...pathwayPayload(
        level,
        rows,
        samplingFieldsOf(updated as unknown as Record<string, unknown>),
      ),
    });
  } catch (error) {
    console.error("Error updating pathway progress:", error);
    return NextResponse.json(
      { error: "Failed to update pathway progress" },
      { status: 500 },
    );
  }
}
