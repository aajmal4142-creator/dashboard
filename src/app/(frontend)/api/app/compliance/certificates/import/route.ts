import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ENERGY_CERTIFICATES_SLUG } from "@/collections/EnergyCertificates";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  CERTIFICATE_CSV_TEMPLATE,
  docToEnergyCertificate,
  parseCertificateImportCsv,
  resolveOrgPeriodId,
} from "@/lib/certificates";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/certificates/import — CSV template
 * POST — dry-run (default) or apply CSV import
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
      template: CERTIFICATE_CSV_TEMPLATE,
      filename: "energy-certificates-template.csv",
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

    const parsed = parseCertificateImportCsv(body.csv);
    const payload = await getPayload({ config });

    const resolutionErrors: Array<{
      rowNumber: number;
      field: string;
      value: unknown;
      error: string;
    }> = [...parsed.errors];
    const resolvedRows: Array<
      (typeof parsed.rows)[number] & { periodId: string; periodLabel: string }
    > = [];

    for (const row of parsed.rows) {
      const period = await resolveOrgPeriodId(payload, ctx.activeOrg.id, row.periodRef);
      if (!period) {
        resolutionErrors.push({
          rowNumber: row.rowNumber,
          field: "period",
          value: row.periodRef,
          error: `No reporting period matching "${row.periodRef}" in this organisation`,
        });
        continue;
      }
      resolvedRows.push({
        ...row,
        periodId: period.id,
        periodLabel: period.label,
      });
    }

    const valid = resolutionErrors.length === 0 && parsed.valid;

    if (mode === "dry-run" || !valid) {
      return NextResponse.json({
        mode: "dry-run",
        valid,
        rows: resolvedRows,
        errors: resolutionErrors,
        wouldImport: valid ? resolvedRows.length : 0,
      });
    }

    const created = [];
    for (const row of resolvedRows) {
      const doc = await payload.create({
        collection: ENERGY_CERTIFICATES_SLUG,
        data: {
          organisation: ctx.activeOrg.id,
          label: row.label ?? undefined,
          certificateType: row.certificateType,
          volumeKwh: row.volumeKwh,
          vintageYear: row.vintageYear,
          region: row.region,
          country: row.country ?? undefined,
          status: row.status,
          period: row.periodId,
          supplier: row.supplier ?? undefined,
          notes: row.notes ?? undefined,
        },
        overrideAccess: true,
      });
      created.push(docToEnergyCertificate(doc));
    }

    return NextResponse.json({
      mode: "apply",
      valid: true,
      imported: created.length,
      certificates: created,
      errors: [],
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Certificates import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
