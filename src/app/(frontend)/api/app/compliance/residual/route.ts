import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { CARBON_CREDITS_SLUG } from "@/collections/CarbonCredits";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  docToCarbonCredit,
  isCreditStatus,
  isCreditType,
  listOrgCredits,
  listOrgPeriods,
} from "@/lib/offsets";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/residual — list carbon credit lots (+ periods)
 * POST — create offset lot
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

    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId") ?? undefined;
    const statusParam = url.searchParams.get("status");
    const status = statusParam && isCreditStatus(statusParam) ? statusParam : undefined;

    if (statusParam && !status) {
      return NextResponse.json(
        { error: "status must be held or retired" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const [credits, periods] = await Promise.all([
      listOrgCredits(payload, ctx.activeOrg.id, { periodId, status }),
      listOrgPeriods(payload, ctx.activeOrg.id),
    ]);

    return NextResponse.json({
      credits,
      total: credits.length,
      periods,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Residual credits list error:", error);
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
    const creditType = body.creditType;
    const volumeTco2e = Number(body.volumeTco2e);
    const vintageYear = Number(body.vintageYear);
    const registryName =
      typeof body.registryName === "string" ? body.registryName.trim() : "";
    const status = body.status === undefined ? "held" : body.status;
    const periodId =
      typeof body.periodId === "string" && body.periodId.trim()
        ? body.periodId.trim()
        : null;

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
    if (!registryName) {
      return NextResponse.json(
        { error: "registryName is required (free-text; no registry sync)" },
        { status: 400 },
      );
    }
    if (!isCreditStatus(status)) {
      return NextResponse.json(
        { error: "status must be held or retired" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

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

    const created = await payload.create({
      collection: CARBON_CREDITS_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        label:
          typeof body.label === "string" && body.label.trim()
            ? body.label.trim()
            : undefined,
        creditType,
        volumeTco2e,
        vintageYear,
        status,
        registryName,
        serial:
          typeof body.serial === "string" && body.serial.trim()
            ? body.serial.trim()
            : undefined,
        period: periodId ?? undefined,
        retiredAt:
          typeof body.retiredAt === "string" && body.retiredAt.trim()
            ? body.retiredAt.trim()
            : undefined,
        notes:
          typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : undefined,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ credit: docToCarbonCredit(created) }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Residual credits create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
