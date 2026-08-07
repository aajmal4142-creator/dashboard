import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { FINANCED_EMISSIONS_SLUG } from "@/collections/FinancedEmissions";
import {
  docToFinancedEmission,
  getOrgFinancedEmission,
  isPcafAssetClass,
  isPcafCurrency,
  isPcafDataSource,
} from "@/lib/pcaf";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function GET(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const exposure = await getOrgFinancedEmission(payload, ctx.activeOrg.id, id);
    if (!exposure) {
      return NextResponse.json({ error: "Exposure not found" }, { status: 404 });
    }

    return NextResponse.json({
      exposure,
      canWrite: canWrite(ctx.role),
      canDelete: canDelete(ctx.role),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PCAF get error:", error);
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
    const payload = await getPayload({ config });
    const existing = await getOrgFinancedEmission(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Exposure not found" }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const counterparty =
      typeof body.counterparty === "string" && body.counterparty.trim()
        ? body.counterparty.trim()
        : existing.counterparty;

    const assetClass =
      body.assetClass !== undefined ? body.assetClass : existing.assetClass;
    if (!isPcafAssetClass(assetClass)) {
      return NextResponse.json({ error: "assetClass is invalid" }, { status: 400 });
    }

    const dataSource =
      body.dataSource !== undefined ? body.dataSource : existing.dataSource;
    if (!isPcafDataSource(dataSource)) {
      return NextResponse.json({ error: "dataSource is invalid" }, { status: 400 });
    }

    let outstandingAmount = existing.outstandingAmount;
    if (body.outstandingAmount !== undefined) {
      const n = Number(body.outstandingAmount);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "outstandingAmount must be a non-negative number" },
          { status: 400 },
        );
      }
      outstandingAmount = n;
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

    const currency = isPcafCurrency(body.currency)
      ? body.currency
      : isPcafCurrency(existing.currency)
        ? existing.currency
        : "USD";

    let notes = existing.notes;
    if (body.notes !== undefined) {
      if (body.notes === null || body.notes === "") {
        notes = null;
      } else if (typeof body.notes === "string") {
        notes = body.notes.trim() || null;
      } else {
        return NextResponse.json(
          { error: "notes must be a string or null" },
          { status: 400 },
        );
      }
    }

    const updated = await payload.update({
      collection: FINANCED_EMISSIONS_SLUG,
      id,
      data: {
        counterparty,
        assetClass,
        outstandingAmount,
        evic: evicParsed.value === undefined ? existing.evic : evicParsed.value,
        currency,
        borrowerScope1Tco2e:
          s1Parsed.value === undefined ? existing.borrowerScope1Tco2e : s1Parsed.value,
        borrowerScope2Tco2e:
          s2Parsed.value === undefined ? existing.borrowerScope2Tco2e : s2Parsed.value,
        borrowerScope3Tco2e:
          s3Parsed.value === undefined ? existing.borrowerScope3Tco2e : s3Parsed.value,
        dataSource,
        notes,
      },
      depth: 0,
      overrideAccess: true,
    });

    return NextResponse.json({ exposure: docToFinancedEmission(updated) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PCAF update error:", error);
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
    const existing = await getOrgFinancedEmission(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Exposure not found" }, { status: 404 });
    }

    await payload.delete({
      collection: FINANCED_EMISSIONS_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PCAF delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
