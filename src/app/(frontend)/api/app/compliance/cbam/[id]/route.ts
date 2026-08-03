import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { CBAM_GOODS_SLUG } from "@/collections/CbamGoods";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  docToCbamGood,
  getOrgCbamGood,
  type CbamQuarter,
  type CbamQuantityUnit,
} from "@/lib/cbam";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function parseQuarter(value: unknown): CbamQuarter | null {
  const v = String(value ?? "").replace(/^q/i, "");
  if (v === "1" || v === "2" || v === "3" || v === "4") return v;
  return null;
}

function parseUnit(value: unknown): CbamQuantityUnit | null {
  if (value === "t" || value === "kg" || value === "mwh") return value;
  return null;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return Number.NaN;
  return n;
}

/**
 * GET /api/app/compliance/cbam/[id]
 * PUT — update goods line
 * DELETE — remove goods line
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
    const good = await getOrgCbamGood(payload, ctx.activeOrg.id, id);
    if (!good)
      return NextResponse.json({ error: "Goods line not found" }, { status: 404 });

    return NextResponse.json({ good });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("CBAM get error:", error);
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
    const existing = await getOrgCbamGood(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Goods line not found" }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const cnCode =
      typeof body.cnCode === "string" && body.cnCode.trim()
        ? body.cnCode.trim()
        : existing.cnCode;
    const quantity =
      body.quantity !== undefined ? Number(body.quantity) : existing.quantity;
    const quantityUnit =
      body.quantityUnit !== undefined
        ? parseUnit(body.quantityUnit)
        : existing.quantityUnit;
    const installationCountry =
      typeof body.installationCountry === "string" && body.installationCountry.trim()
        ? body.installationCountry.trim().toUpperCase()
        : existing.installationCountry;
    const reportingYear =
      body.reportingYear !== undefined
        ? Number(body.reportingYear)
        : existing.reportingYear;
    const reportingQuarter =
      body.reportingQuarter !== undefined
        ? parseQuarter(body.reportingQuarter)
        : existing.reportingQuarter;

    const directEmissions =
      body.directEmissions !== undefined
        ? optionalNumber(body.directEmissions)
        : existing.directEmissions;
    const indirectEmissions =
      body.indirectEmissions !== undefined
        ? optionalNumber(body.indirectEmissions)
        : existing.indirectEmissions;

    if (quantity === null || !Number.isFinite(quantity) || quantity < 0) {
      return NextResponse.json(
        { error: "quantity must be a non-negative number" },
        { status: 400 },
      );
    }
    if (!quantityUnit) {
      return NextResponse.json(
        { error: "quantityUnit must be t, kg, or mwh" },
        { status: 400 },
      );
    }
    if (!/^[A-Z]{2}$/.test(installationCountry)) {
      return NextResponse.json(
        { error: "installationCountry must be ISO 3166-1 alpha-2" },
        { status: 400 },
      );
    }
    if (
      !Number.isInteger(reportingYear) ||
      reportingYear < 2023 ||
      reportingYear > 2100
    ) {
      return NextResponse.json(
        { error: "reportingYear must be an integer between 2023 and 2100" },
        { status: 400 },
      );
    }
    if (!reportingQuarter) {
      return NextResponse.json(
        { error: "reportingQuarter must be 1–4" },
        { status: 400 },
      );
    }
    if (directEmissions !== undefined && Number.isNaN(directEmissions as number)) {
      return NextResponse.json(
        { error: "directEmissions must be a number or null" },
        { status: 400 },
      );
    }
    if (indirectEmissions !== undefined && Number.isNaN(indirectEmissions as number)) {
      return NextResponse.json(
        { error: "indirectEmissions must be a number or null" },
        { status: 400 },
      );
    }

    const updated = await payload.update({
      collection: CBAM_GOODS_SLUG,
      id,
      data: {
        cnCode,
        description:
          body.description !== undefined
            ? typeof body.description === "string" && body.description.trim()
              ? body.description.trim()
              : null
            : existing.description,
        quantity,
        quantityUnit,
        directEmissions: directEmissions ?? null,
        indirectEmissions: indirectEmissions ?? null,
        usesDefaultValues:
          body.usesDefaultValues !== undefined
            ? body.usesDefaultValues === true
            : existing.usesDefaultValues,
        installationCountry,
        reportingYear,
        reportingQuarter,
        notes:
          body.notes !== undefined
            ? typeof body.notes === "string" && body.notes.trim()
              ? body.notes.trim()
              : null
            : existing.notes,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ good: docToCbamGood(updated) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("CBAM update error:", error);
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
    const existing = await getOrgCbamGood(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Goods line not found" }, { status: 404 });
    }

    await payload.delete({
      collection: CBAM_GOODS_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("CBAM delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
