import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { SBTI_TARGETS_SLUG } from "@/collections/SbtiTargets";
import { getCurrentContext } from "@/lib/auth";
import {
  buildTargetProgress,
  docToSbtiTarget,
  listOrgSbtiTargets,
  parseCreateStatus,
  parseScopesCovered,
  resolveTargetLevels,
} from "@/lib/compliance";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/sbti — list targets for active org (with progress)
 * POST — create draft/submitted target via wizard
 */
export async function GET() {
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

  const payload = await getPayload({ config });
  const targets = await listOrgSbtiTargets(payload, ctx.activeOrg.id);

  const withProgress = await Promise.all(
    targets.map((target) =>
      buildTargetProgress({
        payload,
        organisationId: ctx.activeOrg!.id,
        orgName: ctx.activeOrg!.name,
        target,
        includeScenarios: false,
      }),
    ),
  );

  return NextResponse.json({
    targets: withProgress.map((row) => ({
      ...row.target,
      progress: row.progress,
      asOfYear: row.asOfYear,
      currentQuality: row.currentQuality,
      currentMessage: row.currentMessage ?? null,
      alignment: row.alignment,
      registrySearchUrl: row.registrySearchUrl,
    })),
    total: withProgress.length,
  });
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "compliance",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  const status = parseCreateStatus(body.status);
  if (!status) {
    return NextResponse.json(
      {
        error:
          "status must be draft or submitted. Validated/approved targets require prior draft/submitted discipline.",
      },
      { status: 400 },
    );
  }

  if (body.targetType !== "absolute" && body.targetType !== "intensity") {
    return NextResponse.json(
      { error: "targetType must be absolute or intensity" },
      { status: 400 },
    );
  }

  const baselineYear = Number(body.baselineYear);
  const targetYear = Number(body.targetYear);
  const baselineEmissions = Number(body.baselineEmissions);

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

  const scopesCovered = parseScopesCovered(body.scopesCovered);
  if (!scopesCovered) {
    return NextResponse.json(
      { error: "scopesCovered must include at least one of Scope1, Scope2, Scope3" },
      { status: 400 },
    );
  }

  let levels;
  try {
    levels = resolveTargetLevels({
      baselineEmissions,
      targetEmissions: body.targetEmissions,
      reductionPercent: body.reductionPercent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid target levels";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : `${body.targetType === "intensity" ? "Intensity" : "Absolute"} ${baselineYear}→${targetYear}`;

  const payload = await getPayload({ config });

  const created = await payload.create({
    collection: SBTI_TARGETS_SLUG,
    data: {
      organisation: ctx.activeOrg.id,
      name,
      targetType: body.targetType,
      baselineYear,
      baselineEmissions,
      targetYear,
      targetEmissions: levels.targetEmissions,
      reductionPercent: levels.reductionPercent,
      scopesCovered,
      status,
      validationUrl:
        typeof body.validationUrl === "string" && body.validationUrl.trim()
          ? body.validationUrl.trim()
          : undefined,
      notes:
        typeof body.notes === "string" && body.notes.trim()
          ? body.notes.trim()
          : undefined,
    },
    overrideAccess: true,
  });

  // Mirror commitment onto organisation SBTi group
  await payload.update({
    collection: "organisations",
    id: ctx.activeOrg.id,
    data: {
      sbti: {
        hasCommitment: true,
        commitmentStatus: status,
        activeTarget: created.id,
        registryUrl:
          typeof body.validationUrl === "string" && body.validationUrl.trim()
            ? body.validationUrl.trim()
            : undefined,
      },
    },
    overrideAccess: true,
  });

  const target = docToSbtiTarget(created);
  const withProgress = await buildTargetProgress({
    payload,
    organisationId: ctx.activeOrg.id,
    orgName: ctx.activeOrg.name,
    target,
  });

  return NextResponse.json(
    {
      target: withProgress.target,
      progress: withProgress.progress,
      asOfYear: withProgress.asOfYear,
      currentQuality: withProgress.currentQuality,
      currentMessage: withProgress.currentMessage ?? null,
      alignment: withProgress.alignment,
      registrySearchUrl: withProgress.registrySearchUrl,
      scenarios: withProgress.scenarios,
    },
    { status: 201 },
  );
}
