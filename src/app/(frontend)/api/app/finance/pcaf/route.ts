import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { FINANCED_EMISSIONS_SLUG } from "@/collections/FinancedEmissions";
import {
  buildPcafSummary,
  docToFinancedEmission,
  isPcafAssetClass,
  isPcafCurrency,
  isPcafDataSource,
  listOrgFinancedEmissions,
  PCAF_DISCLAIMER,
} from "@/lib/pcaf";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

function canDelete(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

function parseOptionalNumber(
  value: unknown,
  field: string,
): { ok: true; value: number | null | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === "") return { ok: true, value: null };
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: `${field} must be a non-negative number or null` };
  }
  return { ok: true, value: n };
}

/**
 * GET /api/app/finance/pcaf?periodId= — list exposures + PCAF portfolio summary.
 * POST — create an exposure.
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId") ?? undefined;

    const payload = await getPayload({ config });
    const exposures = await listOrgFinancedEmissions(payload, ctx.activeOrg.id, {
      periodId,
    });
    const summary = buildPcafSummary(exposures);

    return NextResponse.json({
      exposures,
      total: exposures.length,
      summary,
      disclaimer: PCAF_DISCLAIMER,
      canWrite: canWrite(ctx.role),
      canDelete: canDelete(ctx.role),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PCAF list error:", error);
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
    const counterparty =
      typeof body.counterparty === "string" ? body.counterparty.trim() : "";
    if (!counterparty) {
      return NextResponse.json({ error: "counterparty is required" }, { status: 400 });
    }

    const assetClass =
      body.assetClass === undefined ? "listed_equity_corporate_bonds" : body.assetClass;
    if (!isPcafAssetClass(assetClass)) {
      return NextResponse.json({ error: "assetClass is invalid" }, { status: 400 });
    }

    const dataSource =
      body.dataSource === undefined ? "economic_activity_proxy" : body.dataSource;
    if (!isPcafDataSource(dataSource)) {
      return NextResponse.json({ error: "dataSource is invalid" }, { status: 400 });
    }

    const outstandingAmount = Number(body.outstandingAmount);
    if (!Number.isFinite(outstandingAmount) || outstandingAmount < 0) {
      return NextResponse.json(
        { error: "outstandingAmount must be a non-negative number" },
        { status: 400 },
      );
    }

    const evicParsed = parseOptionalNumber(body.evic, "evic");
    if (!evicParsed.ok)
      return NextResponse.json({ error: evicParsed.error }, { status: 400 });
    const s1Parsed = parseOptionalNumber(body.borrowerScope1Tco2e, "borrowerScope1Tco2e");
    if (!s1Parsed.ok)
      return NextResponse.json({ error: s1Parsed.error }, { status: 400 });
    const s2Parsed = parseOptionalNumber(body.borrowerScope2Tco2e, "borrowerScope2Tco2e");
    if (!s2Parsed.ok)
      return NextResponse.json({ error: s2Parsed.error }, { status: 400 });
    const s3Parsed = parseOptionalNumber(body.borrowerScope3Tco2e, "borrowerScope3Tco2e");
    if (!s3Parsed.ok)
      return NextResponse.json({ error: s3Parsed.error }, { status: 400 });

    const currency = isPcafCurrency(body.currency) ? body.currency : "USD";
    const periodId =
      typeof body.periodId === "string" && body.periodId.trim()
        ? body.periodId.trim()
        : undefined;
    const notes =
      typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined;

    const payload = await getPayload({ config });
    const created = await payload.create({
      collection: FINANCED_EMISSIONS_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        period: periodId,
        counterparty,
        assetClass,
        outstandingAmount,
        evic: evicParsed.value === undefined ? undefined : evicParsed.value,
        currency,
        borrowerScope1Tco2e: s1Parsed.value === undefined ? undefined : s1Parsed.value,
        borrowerScope2Tco2e: s2Parsed.value === undefined ? undefined : s2Parsed.value,
        borrowerScope3Tco2e: s3Parsed.value === undefined ? undefined : s3Parsed.value,
        dataSource,
        notes,
      },
      depth: 0,
      overrideAccess: true,
    });

    return NextResponse.json(
      { exposure: docToFinancedEmission(created) },
      { status: 201 },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PCAF create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
