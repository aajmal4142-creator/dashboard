import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  assertPeriodInOrg,
  deleteRestatement,
  getOrgRestatement,
  isRestatementReason,
  RESTATEMENT_REASONS,
  updateRestatement,
  type RestatementReason,
} from "@/lib/compliance/ghg";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

import { parseInventoryBody } from "../parse";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/app/compliance/ghg/restatements/[id]
 * PUT — update draft
 * DELETE — delete draft
 */
export async function GET(_req: Request, context: RouteContext) {
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

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const restatement = await getOrgRestatement(payload, ctx.activeOrg.id, id);
    if (!restatement) {
      return NextResponse.json({ error: "Restatement not found" }, { status: 404 });
    }

    return NextResponse.json({ restatement });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GHG restatement get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  try {
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
    const body = (await req.json()) as Record<string, unknown>;
    const payload = await getPayload({ config });

    if (body.reason !== undefined && !isRestatementReason(body.reason)) {
      return NextResponse.json(
        { error: `reason must be one of: ${RESTATEMENT_REASONS.join(", ")}` },
        { status: 400 },
      );
    }

    const priorParsed =
      body.priorInventory !== undefined
        ? parseInventoryBody(body.priorInventory)
        : undefined;
    if (priorParsed === "invalid") {
      return NextResponse.json(
        { error: "priorInventory scopes must be numbers or null" },
        { status: 400 },
      );
    }
    const restatedParsed =
      body.restatedInventory !== undefined
        ? parseInventoryBody(body.restatedInventory)
        : undefined;
    if (restatedParsed === "invalid") {
      return NextResponse.json(
        { error: "restatedInventory scopes must be numbers or null" },
        { status: 400 },
      );
    }

    const effectivePeriodId =
      typeof body.effectivePeriodId === "string"
        ? body.effectivePeriodId.trim()
        : undefined;
    const baseYearPeriodId =
      typeof body.baseYearPeriodId === "string"
        ? body.baseYearPeriodId.trim()
        : undefined;

    if (effectivePeriodId) {
      const ok = await assertPeriodInOrg(payload, ctx.activeOrg.id, effectivePeriodId);
      if (!ok) {
        return NextResponse.json(
          {
            error:
              "effectivePeriodId must reference a reporting period in this organisation",
          },
          { status: 400 },
        );
      }
    }
    if (baseYearPeriodId) {
      const ok = await assertPeriodInOrg(payload, ctx.activeOrg.id, baseYearPeriodId);
      if (!ok) {
        return NextResponse.json(
          {
            error:
              "baseYearPeriodId must reference a reporting period in this organisation",
          },
          { status: 400 },
        );
      }
    }

    try {
      const restatement = await updateRestatement(payload, ctx.activeOrg.id, id, {
        title: typeof body.title === "string" ? body.title.trim() : undefined,
        reason: isRestatementReason(body.reason)
          ? (body.reason as RestatementReason)
          : undefined,
        reasonDetail:
          typeof body.reasonDetail === "string" ? body.reasonDetail.trim() : undefined,
        methodologyNote:
          typeof body.methodologyNote === "string"
            ? body.methodologyNote.trim()
            : undefined,
        effectivePeriodId,
        baseYearPeriodId,
        priorInventory: priorParsed ?? undefined,
        restatedInventory: restatedParsed ?? undefined,
        auditNarrative:
          body.auditNarrative === null
            ? null
            : typeof body.auditNarrative === "string"
              ? body.auditNarrative
              : undefined,
        disclosureNote:
          body.disclosureNote === null
            ? null
            : typeof body.disclosureNote === "string"
              ? body.disclosureNote
              : undefined,
      });

      if (!restatement) {
        return NextResponse.json({ error: "Restatement not found" }, { status: 404 });
      }

      return NextResponse.json({ restatement });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      if (message.includes("Final restatements")) {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GHG restatement update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
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

    try {
      const ok = await deleteRestatement(payload, ctx.activeOrg.id, id);
      if (!ok) {
        return NextResponse.json({ error: "Restatement not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      if (message.includes("Final restatements")) {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GHG restatement delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
