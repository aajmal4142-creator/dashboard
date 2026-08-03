import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  assertPeriodInOrg,
  createRestatement,
  isRestatementReason,
  listOrgPeriods,
  listOrgRestatements,
  loadBaseYearInventorySnapshot,
  RESTATEMENT_REASONS,
  type RestatementReason,
} from "@/lib/compliance/ghg";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

import { parseInventoryBody } from "./parse";

/**
 * GET /api/app/compliance/ghg/restatements — list + periods (+ optional inventory preview)
 * POST — create draft restatement
 */
export async function GET(req: Request) {
  try {
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
    const url = new URL(req.url);
    const inventoryPeriodId = url.searchParams.get("inventoryPeriodId");

    const [restatements, periods] = await Promise.all([
      listOrgRestatements(payload, ctx.activeOrg.id),
      listOrgPeriods(payload, ctx.activeOrg.id),
    ]);

    let inventoryPreview = null;
    if (inventoryPeriodId) {
      inventoryPreview = await loadBaseYearInventorySnapshot(
        payload,
        ctx.activeOrg.id,
        inventoryPeriodId,
      );
    }

    return NextResponse.json({
      restatements,
      periods,
      reasons: RESTATEMENT_REASONS,
      inventoryPreview,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GHG restatements list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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

    const body = (await req.json()) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const reason = body.reason;
    const reasonDetail =
      typeof body.reasonDetail === "string" ? body.reasonDetail.trim() : "";
    const methodologyNote =
      typeof body.methodologyNote === "string" ? body.methodologyNote.trim() : "";
    const effectivePeriodId =
      typeof body.effectivePeriodId === "string" ? body.effectivePeriodId.trim() : "";
    const baseYearPeriodId =
      typeof body.baseYearPeriodId === "string" ? body.baseYearPeriodId.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!isRestatementReason(reason)) {
      return NextResponse.json(
        { error: `reason must be one of: ${RESTATEMENT_REASONS.join(", ")}` },
        { status: 400 },
      );
    }
    if (!reasonDetail) {
      return NextResponse.json({ error: "reasonDetail is required" }, { status: 400 });
    }
    if (!methodologyNote) {
      return NextResponse.json({ error: "methodologyNote is required" }, { status: 400 });
    }
    if (!effectivePeriodId) {
      return NextResponse.json(
        { error: "effectivePeriodId is required" },
        { status: 400 },
      );
    }
    if (!baseYearPeriodId) {
      return NextResponse.json(
        { error: "baseYearPeriodId is required" },
        { status: 400 },
      );
    }

    const priorParsed = parseInventoryBody(body.priorInventory);
    if (priorParsed === "invalid") {
      return NextResponse.json(
        { error: "priorInventory scopes must be numbers or null" },
        { status: 400 },
      );
    }
    const restatedParsed = parseInventoryBody(body.restatedInventory);
    if (restatedParsed === "invalid") {
      return NextResponse.json(
        { error: "restatedInventory scopes must be numbers or null" },
        { status: 400 },
      );
    }

    const hasAnyScope = (snap: {
      scope1: number | null;
      scope2: number | null;
      scope3: number | null;
    }) => snap.scope1 !== null || snap.scope2 !== null || snap.scope3 !== null;

    // All-empty prior → let the service load from published report / GHG compliance.
    const priorInventory = priorParsed && hasAnyScope(priorParsed) ? priorParsed : null;
    const restatedInventory =
      restatedParsed && hasAnyScope(restatedParsed) ? restatedParsed : null;

    const payload = await getPayload({ config });
    const [effectiveOk, baseOk] = await Promise.all([
      assertPeriodInOrg(payload, ctx.activeOrg.id, effectivePeriodId),
      assertPeriodInOrg(payload, ctx.activeOrg.id, baseYearPeriodId),
    ]);
    if (!effectiveOk) {
      return NextResponse.json(
        {
          error:
            "effectivePeriodId must reference a reporting period in this organisation",
        },
        { status: 400 },
      );
    }
    if (!baseOk) {
      return NextResponse.json(
        {
          error:
            "baseYearPeriodId must reference a reporting period in this organisation",
        },
        { status: 400 },
      );
    }

    const restatement = await createRestatement(payload, ctx.activeOrg.id, {
      title,
      reason: reason as RestatementReason,
      reasonDetail,
      methodologyNote,
      effectivePeriodId,
      baseYearPeriodId,
      priorInventory,
      restatedInventory,
      createdBy: ctx.user.id,
    });

    return NextResponse.json({ restatement }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GHG restatements create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
