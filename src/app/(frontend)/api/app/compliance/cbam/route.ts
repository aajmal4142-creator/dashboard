import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { CBAM_GOODS_SLUG } from "@/collections/CbamGoods";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  docToCbamGood,
  listOrgCbamGoods,
  searchCnHints,
  type CbamQuarter,
  type CbamQuantityUnit,
} from "@/lib/cbam";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

function parseQuarter(value: unknown): CbamQuarter | null {
  const v = String(value ?? "").replace(/^q/i, "");
  if (v === "1" || v === "2" || v === "3" || v === "4") return v;
  return null;
}

function parseUnit(value: unknown): CbamQuantityUnit | null {
  if (value === "t" || value === "kg" || value === "mwh") return value;
  if (value === undefined || value === null || value === "") return "t";
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
 * GET /api/app/compliance/cbam — list goods (+ optional year/quarter, CN catalog)
 * POST — create goods line
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
    if (url.searchParams.get("catalog") === "true") {
      const q = url.searchParams.get("q") ?? "";
      return NextResponse.json({ cnHints: searchCnHints(q, 30) });
    }

    const yearParam = url.searchParams.get("year");
    const quarterParam = url.searchParams.get("quarter");
    const year = yearParam ? Number(yearParam) : undefined;
    const quarter = quarterParam ? parseQuarter(quarterParam) : undefined;

    if (yearParam && (!Number.isInteger(year) || (year as number) < 2023)) {
      return NextResponse.json(
        { error: "year must be an integer ≥ 2023" },
        { status: 400 },
      );
    }
    if (quarterParam && !quarter) {
      return NextResponse.json({ error: "quarter must be 1–4" }, { status: 400 });
    }

    const payload = await getPayload({ config });
    const goods = await listOrgCbamGoods(payload, ctx.activeOrg.id, {
      year: year as number | undefined,
      quarter: quarter ?? undefined,
    });

    return NextResponse.json({ goods, total: goods.length });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("CBAM list error:", error);
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
    const cnCode = typeof body.cnCode === "string" ? body.cnCode.trim() : "";
    const quantity = Number(body.quantity);
    const quantityUnit = parseUnit(body.quantityUnit);
    const installationCountry =
      typeof body.installationCountry === "string"
        ? body.installationCountry.trim().toUpperCase()
        : "";
    const reportingYear = Number(body.reportingYear);
    const reportingQuarter = parseQuarter(body.reportingQuarter);
    const directEmissions = optionalNumber(body.directEmissions);
    const indirectEmissions = optionalNumber(body.indirectEmissions);

    if (!cnCode) {
      return NextResponse.json({ error: "cnCode is required" }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
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

    const payload = await getPayload({ config });
    const created = await payload.create({
      collection: CBAM_GOODS_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        cnCode,
        description:
          typeof body.description === "string" && body.description.trim()
            ? body.description.trim()
            : undefined,
        quantity,
        quantityUnit,
        directEmissions: directEmissions === undefined ? undefined : directEmissions,
        indirectEmissions:
          indirectEmissions === undefined ? undefined : indirectEmissions,
        usesDefaultValues: body.usesDefaultValues === true,
        installationCountry,
        reportingYear,
        reportingQuarter,
        notes:
          typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : undefined,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ good: docToCbamGood(created) }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("CBAM create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
