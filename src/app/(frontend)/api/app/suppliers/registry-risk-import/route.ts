import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  parseRegistryRiskCsv,
  serializeEnforcementFlag,
  sourcesToText,
  type RegistryRiskCsvRow,
} from "@/lib/suppliers";
import config from "@/payload.config";

type ImportRowResult = {
  rowNumber: number;
  status: "updated" | "not_found" | "ambiguous" | "error";
  supplierId?: string;
  supplierName?: string;
  message?: string;
};

/**
 * POST /api/app/suppliers/registry-risk-import
 * Optional CSV import of Y08 public-registry flags (sbti_status, enforcement_flag,
 * sources, notes) matched to existing suppliers by supplier_id or supplier_name.
 * Body: { csv: string, dryRun?: boolean }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "supplier",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      csv?: string;
      dryRun?: boolean;
    };
    const csv = typeof body.csv === "string" ? body.csv : "";
    if (!csv.trim()) {
      return NextResponse.json({ error: "csv is required" }, { status: 400 });
    }

    const parsed = parseRegistryRiskCsv(csv);
    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "No importable rows found", errors: parsed.errors },
        { status: 400 },
      );
    }

    const dryRun = body.dryRun !== false;
    const payload = await getPayload({ config });

    const orgSuppliers = await payload.find({
      collection: "suppliers",
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    });

    const byId = new Map(orgSuppliers.docs.map((s) => [String(s.id), s]));
    const byName = new Map<string, typeof orgSuppliers.docs>();
    for (const s of orgSuppliers.docs) {
      const key = s.name.trim().toLowerCase();
      byName.set(key, [...(byName.get(key) ?? []), s]);
    }

    function resolveSupplier(row: RegistryRiskCsvRow) {
      if (row.supplierId && byId.has(row.supplierId)) {
        return { match: byId.get(row.supplierId)!, ambiguous: false };
      }
      if (row.supplierName) {
        const matches = byName.get(row.supplierName.trim().toLowerCase()) ?? [];
        if (matches.length === 1) return { match: matches[0]!, ambiguous: false };
        if (matches.length > 1) return { match: null, ambiguous: true };
      }
      return { match: null, ambiguous: false };
    }

    const results: ImportRowResult[] = [];
    let updated = 0;

    for (const row of parsed.rows) {
      const { match, ambiguous } = resolveSupplier(row);
      if (ambiguous) {
        results.push({
          rowNumber: row.rowNumber,
          status: "ambiguous",
          supplierName: row.supplierName ?? undefined,
          message: "Multiple suppliers share this name — use supplier_id instead.",
        });
        continue;
      }
      if (!match) {
        results.push({
          rowNumber: row.rowNumber,
          status: "not_found",
          supplierId: row.supplierId ?? undefined,
          supplierName: row.supplierName ?? undefined,
          message: "No matching supplier in this organisation.",
        });
        continue;
      }

      if (!dryRun) {
        try {
          await payload.update({
            collection: "suppliers",
            id: match.id,
            data: {
              registryRisk: {
                sbtiStatus: row.sbtiStatus,
                enforcementFlag: serializeEnforcementFlag(row.enforcementFlag),
                sources: sourcesToText(row.sources),
                notes: row.notes,
                lastReviewedAt: new Date().toISOString(),
              },
            },
            overrideAccess: true,
          });
        } catch (err) {
          results.push({
            rowNumber: row.rowNumber,
            status: "error",
            supplierId: String(match.id),
            message: err instanceof Error ? err.message : "Update failed",
          });
          continue;
        }
      }

      updated += 1;
      results.push({
        rowNumber: row.rowNumber,
        status: "updated",
        supplierId: String(match.id),
        supplierName: match.name,
      });
    }

    return NextResponse.json({
      mode: dryRun ? "preview" : "commit",
      matched: updated,
      totalRows: parsed.rows.length,
      results,
      csvErrors: parsed.errors,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Registry risk CSV import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
