import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { CBAM_GOODS_SLUG } from "@/collections/CbamGoods";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  calculateCbamLineEmissions,
  CBAM_CSV_TEMPLATE,
  docToCbamGood,
  parseCbamImportCsv,
} from "@/lib/cbam";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/cbam/import — CSV template
 * POST — dry-run (default) or apply CSV goods import
 *
 * Body: { csv: string, mode?: "dry-run" | "apply" }
 */
export async function GET() {
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

    return NextResponse.json({
      template: CBAM_CSV_TEMPLATE,
      filename: "cbam-goods-template.csv",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { csv?: string; mode?: string };
    const mode = body.mode === "apply" ? "apply" : "dry-run";

    const permission = mode === "apply" ? "create" : "view";
    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      permission,
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (typeof body.csv !== "string" || !body.csv.trim()) {
      return NextResponse.json({ error: "csv string is required" }, { status: 400 });
    }

    const parsed = parseCbamImportCsv(body.csv);
    const preview = parsed.rows.map((row) => ({
      ...row,
      line: calculateCbamLineEmissions(row),
    }));

    if (mode === "dry-run" || !parsed.valid) {
      return NextResponse.json({
        mode: "dry-run",
        valid: parsed.valid,
        rows: preview,
        errors: parsed.errors,
        wouldImport: parsed.valid ? parsed.rows.length : 0,
      });
    }

    const payload = await getPayload({ config });
    const created = [];
    for (const row of parsed.rows) {
      const doc = await payload.create({
        collection: CBAM_GOODS_SLUG,
        data: {
          organisation: ctx.activeOrg.id,
          cnCode: row.cnCode,
          description: row.description ?? undefined,
          quantity: row.quantity as number,
          quantityUnit: row.quantityUnit,
          directEmissions: row.directEmissions,
          indirectEmissions: row.indirectEmissions,
          usesDefaultValues: row.usesDefaultValues,
          installationCountry: row.installationCountry,
          reportingYear: row.reportingYear,
          reportingQuarter: row.reportingQuarter,
        },
        overrideAccess: true,
      });
      created.push(docToCbamGood(doc));
    }

    return NextResponse.json({
      mode: "apply",
      valid: true,
      imported: created.length,
      goods: created,
      errors: [],
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("CBAM import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
