import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { CARBON_CREDITS_SLUG } from "@/collections/CarbonCredits";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  docToCarbonCredit,
  getOrgCredit,
  isCreditStatus,
  isCreditType,
} from "@/lib/offsets";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/app/compliance/residual/[id]
 * PUT — update
 * DELETE — remove
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
    const credit = await getOrgCredit(payload, ctx.activeOrg.id, id);
    if (!credit) {
      return NextResponse.json({ error: "Credit lot not found" }, { status: 404 });
    }

    return NextResponse.json({ credit });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Residual credit get error:", error);
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
    const payload = await getPayload({ config });
    const existing = await getOrgCredit(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Credit lot not found" }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const creditType =
      body.creditType !== undefined ? body.creditType : existing.creditType;
    const volumeTco2e =
      body.volumeTco2e !== undefined ? Number(body.volumeTco2e) : existing.volumeTco2e;
    const vintageYear =
      body.vintageYear !== undefined ? Number(body.vintageYear) : existing.vintageYear;
    const registryName =
      typeof body.registryName === "string" && body.registryName.trim()
        ? body.registryName.trim()
        : existing.registryName;
    const status = body.status !== undefined ? body.status : existing.status;
    const periodId =
      body.periodId !== undefined
        ? typeof body.periodId === "string" && body.periodId.trim()
          ? body.periodId.trim()
          : null
        : existing.periodId;

    if (!isCreditType(creditType)) {
      return NextResponse.json(
        {
          error:
            "creditType must be avoidance, removal, mixed, or other (not an energy certificate)",
        },
        { status: 400 },
      );
    }
    if (!Number.isFinite(volumeTco2e) || volumeTco2e < 0) {
      return NextResponse.json(
        { error: "volumeTco2e must be a non-negative number" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(vintageYear) || vintageYear < 1990 || vintageYear > 2100) {
      return NextResponse.json(
        { error: "vintageYear must be an integer between 1990 and 2100" },
        { status: 400 },
      );
    }
    if (!isCreditStatus(status)) {
      return NextResponse.json(
        { error: "status must be held or retired" },
        { status: 400 },
      );
    }

    if (periodId) {
      const period = await payload
        .findByID({
          collection: "reporting-periods",
          id: periodId,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null);
      const periodOrg =
        period &&
        (typeof period.organisation === "string"
          ? period.organisation
          : period.organisation?.id);
      if (!period || periodOrg !== ctx.activeOrg.id) {
        return NextResponse.json(
          { error: "periodId must reference a reporting period in this organisation" },
          { status: 400 },
        );
      }
    }

    const updated = await payload.update({
      collection: CARBON_CREDITS_SLUG,
      id,
      data: {
        label:
          body.label !== undefined
            ? typeof body.label === "string" && body.label.trim()
              ? body.label.trim()
              : null
            : existing.label,
        creditType,
        volumeTco2e,
        vintageYear,
        status,
        registryName,
        serial:
          body.serial !== undefined
            ? typeof body.serial === "string" && body.serial.trim()
              ? body.serial.trim()
              : null
            : existing.serial,
        period: periodId,
        retiredAt:
          body.retiredAt !== undefined
            ? typeof body.retiredAt === "string" && body.retiredAt.trim()
              ? body.retiredAt.trim()
              : null
            : existing.retiredAt,
        notes:
          body.notes !== undefined
            ? typeof body.notes === "string" && body.notes.trim()
              ? body.notes.trim()
              : null
            : existing.notes,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ credit: docToCarbonCredit(updated) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Residual credit update error:", error);
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
    const existing = await getOrgCredit(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Credit lot not found" }, { status: 404 });
    }

    await payload.delete({
      collection: CARBON_CREDITS_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Residual credit delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
