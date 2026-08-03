import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  assertCascadeFacilitiesInOrg,
  assertCascadeOwnersInOrg,
  assertSbtiTargetInOrg,
  buildCascadeProgress,
  createCascadedTarget,
  listOrgCascadedTargets,
  parseCascadeWriteBody,
} from "@/lib/analytics/targetCascadeService";
import { listOrgFacilities } from "@/lib/facilities";
import { listOrgSbtiTargets } from "@/lib/compliance/sbtiService";
import config from "@/payload.config";

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

/**
 * GET /api/app/analytics/target-cascade — list cascades + facilities + SBTi refs
 * POST — create cascade
 */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getPayload({ config });
    const [cascades, facilities, sbtiTargets] = await Promise.all([
      listOrgCascadedTargets(payload, ctx.activeOrg.id),
      listOrgFacilities(payload, ctx.activeOrg.id),
      listOrgSbtiTargets(payload, ctx.activeOrg.id),
    ]);

    const withProgress = cascades.map((c) => ({
      cascade: c,
      progress: buildCascadeProgress(c),
    }));

    return NextResponse.json({
      cascades: withProgress,
      facilities: facilities.map((f) => ({
        id: f.id,
        name: f.name,
        code: f.code,
        active: f.active,
        parentId: f.parentId,
      })),
      sbtiTargets: sbtiTargets.map((t) => ({
        id: t.id,
        name: t.name,
        baselineYear: t.baselineYear,
        targetYear: t.targetYear,
        baselineEmissions: t.baselineEmissions,
        targetEmissions: t.targetEmissions,
        reductionPercent: t.reductionPercent,
        status: t.status,
      })),
      canWrite: canWrite(ctx.role),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Target cascade list error:", error);
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
    const parsed = parseCascadeWriteBody(body);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error, details: parsed.details },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

    const facilityOk = await assertCascadeFacilitiesInOrg(
      payload,
      ctx.activeOrg.id,
      parsed.data.allocations.map((a) => a.facilityId),
    );
    if (!facilityOk.ok) {
      return NextResponse.json({ error: facilityOk.error }, { status: 400 });
    }

    const ownerIds = parsed.data.allocations
      .map((a) => a.ownerId)
      .filter((id): id is string => Boolean(id));
    const ownerOk = await assertCascadeOwnersInOrg(payload, ctx.activeOrg.id, ownerIds);
    if (!ownerOk.ok) {
      return NextResponse.json({ error: ownerOk.error }, { status: 400 });
    }

    const sbtiOk = await assertSbtiTargetInOrg(
      payload,
      ctx.activeOrg.id,
      parsed.data.sbtiTargetId,
    );
    if (!sbtiOk.ok) {
      return NextResponse.json({ error: sbtiOk.error }, { status: 400 });
    }

    const cascade = await createCascadedTarget(payload, ctx.activeOrg.id, parsed.data);

    return NextResponse.json(
      { cascade, progress: buildCascadeProgress(cascade) },
      { status: 201 },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Target cascade create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
