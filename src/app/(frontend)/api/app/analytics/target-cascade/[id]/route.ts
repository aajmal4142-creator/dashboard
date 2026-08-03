import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  assertCascadeFacilitiesInOrg,
  assertCascadeOwnersInOrg,
  assertSbtiTargetInOrg,
  buildCascadeProgress,
  deleteCascadedTarget,
  getOrgCascadedTarget,
  parseCascadeWriteBody,
  updateCascadedTarget,
} from "@/lib/analytics/targetCascadeService";
import config from "@/payload.config";

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

function canDelete(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/app/analytics/target-cascade/[id]
 * PUT — update
 * DELETE — remove (owner/admin)
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const cascade = await getOrgCascadedTarget(payload, ctx.activeOrg.id, id);
    if (!cascade) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      cascade,
      progress: buildCascadeProgress(cascade),
      canWrite: canWrite(ctx.role),
      canDelete: canDelete(ctx.role),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Target cascade get error:", error);
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
      .filter((oid): oid is string => Boolean(oid));
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

    const cascade = await updateCascadedTarget(
      payload,
      ctx.activeOrg.id,
      id,
      parsed.data,
    );
    if (!cascade) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      cascade,
      progress: buildCascadeProgress(cascade),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Target cascade update error:", error);
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
    const ok = await deleteCascadedTarget(payload, ctx.activeOrg.id, id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Target cascade delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
