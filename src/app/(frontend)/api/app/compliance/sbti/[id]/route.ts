import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { SBTI_TARGETS_SLUG } from "@/collections/SbtiTargets";
import { getCurrentContext } from "@/lib/auth";
import {
  assertStatusTransition,
  buildTargetProgress,
  docToSbtiTarget,
  parseScopesCovered,
  parseUpdateStatus,
  relationId,
  resolveTargetLevels,
  type SbtiTargetStatus,
} from "@/lib/compliance";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/app/compliance/sbti/[id] — target + progress (+ scenario projections)
 */
export async function GET(_req: Request, context: RouteContext) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "compliance",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const payload = await getPayload({ config });

  let doc;
  try {
    doc = await payload.findByID({
      collection: SBTI_TARGETS_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  const orgId = relationId(doc.organisation);
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = docToSbtiTarget(doc);
  const withProgress = await buildTargetProgress({
    payload,
    organisationId: ctx.activeOrg.id,
    orgName: ctx.activeOrg.name,
    target,
    includeScenarios: true,
  });

  return NextResponse.json({
    target: withProgress.target,
    progress: withProgress.progress,
    asOfYear: withProgress.asOfYear,
    currentByScope: withProgress.currentByScope,
    currentQuality: withProgress.currentQuality,
    currentMessage: withProgress.currentMessage ?? null,
    alignment: withProgress.alignment,
    registrySearchUrl: withProgress.registrySearchUrl,
    scenarios: withProgress.scenarios,
  });
}

/**
 * PUT /api/app/compliance/sbti/[id] — update target (status discipline enforced)
 */
export async function PUT(req: Request, context: RouteContext) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "edit",
    "compliance",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const payload = await getPayload({ config });

  let existing;
  try {
    existing = await payload.findByID({
      collection: SBTI_TARGETS_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  const orgId = relationId(existing.organisation);
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const current = docToSbtiTarget(existing);
  const body = (await req.json()) as {
    name?: string;
    targetType?: string;
    baselineYear?: number;
    baselineEmissions?: number;
    targetYear?: number;
    targetEmissions?: number | null;
    reductionPercent?: number | null;
    scopesCovered?: string[];
    status?: string;
    validationUrl?: string | null;
    notes?: string | null;
  };

  let nextStatus: SbtiTargetStatus = current.status;
  if (body.status !== undefined) {
    const parsed = parseUpdateStatus(body.status);
    if (!parsed) {
      return NextResponse.json(
        { error: "status must be draft, submitted, validated, or approved" },
        { status: 400 },
      );
    }
    const transitionError = assertStatusTransition(current.status, parsed);
    if (transitionError) {
      return NextResponse.json({ error: transitionError }, { status: 400 });
    }
    nextStatus = parsed;
  }

  const baselineYear =
    body.baselineYear !== undefined ? Number(body.baselineYear) : current.baselineYear;
  const targetYear =
    body.targetYear !== undefined ? Number(body.targetYear) : current.targetYear;
  const baselineEmissions =
    body.baselineEmissions !== undefined
      ? Number(body.baselineEmissions)
      : current.baselineEmissions;

  if (!Number.isInteger(baselineYear) || baselineYear < 1990 || baselineYear > 2100) {
    return NextResponse.json(
      { error: "baselineYear must be a user-selected year between 1990 and 2100" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(targetYear) || targetYear < baselineYear || targetYear > 2100) {
    return NextResponse.json(
      { error: "targetYear must be an integer ≥ baselineYear" },
      { status: 400 },
    );
  }
  if (!(baselineEmissions > 0) || !Number.isFinite(baselineEmissions)) {
    return NextResponse.json(
      { error: "baselineEmissions must be a positive number" },
      { status: 400 },
    );
  }

  const targetType =
    body.targetType === "absolute" || body.targetType === "intensity"
      ? body.targetType
      : current.targetType;

  const scopesCovered =
    body.scopesCovered !== undefined
      ? parseScopesCovered(body.scopesCovered)
      : current.scopesCovered;
  if (!scopesCovered) {
    return NextResponse.json(
      { error: "scopesCovered must include at least one of Scope1, Scope2, Scope3" },
      { status: 400 },
    );
  }

  const targetEmissions =
    body.targetEmissions !== undefined ? body.targetEmissions : current.targetEmissions;
  const reductionPercent =
    body.reductionPercent !== undefined
      ? body.reductionPercent
      : current.reductionPercent;

  let levels;
  try {
    levels = resolveTargetLevels({
      baselineEmissions,
      targetEmissions,
      reductionPercent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid target levels";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updated = await payload.update({
    collection: SBTI_TARGETS_SLUG,
    id,
    data: {
      name:
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : current.name,
      targetType,
      baselineYear,
      baselineEmissions,
      targetYear,
      targetEmissions: levels.targetEmissions,
      reductionPercent: levels.reductionPercent,
      scopesCovered,
      status: nextStatus,
      validationUrl:
        body.validationUrl !== undefined
          ? body.validationUrl && String(body.validationUrl).trim()
            ? String(body.validationUrl).trim()
            : null
          : current.validationUrl,
      notes:
        body.notes !== undefined
          ? body.notes && String(body.notes).trim()
            ? String(body.notes).trim()
            : null
          : current.notes,
    },
    overrideAccess: true,
  });

  await payload.update({
    collection: "organisations",
    id: ctx.activeOrg.id,
    data: {
      sbti: {
        hasCommitment: true,
        commitmentStatus: nextStatus,
        activeTarget: updated.id,
        registryUrl:
          typeof updated.validationUrl === "string" ? updated.validationUrl : undefined,
      },
    },
    overrideAccess: true,
  });

  const target = docToSbtiTarget(updated);
  const withProgress = await buildTargetProgress({
    payload,
    organisationId: ctx.activeOrg.id,
    orgName: ctx.activeOrg.name,
    target,
    includeScenarios: true,
  });

  return NextResponse.json({
    target: withProgress.target,
    progress: withProgress.progress,
    asOfYear: withProgress.asOfYear,
    currentQuality: withProgress.currentQuality,
    currentMessage: withProgress.currentMessage ?? null,
    alignment: withProgress.alignment,
    registrySearchUrl: withProgress.registrySearchUrl,
    scenarios: withProgress.scenarios,
  });
}
