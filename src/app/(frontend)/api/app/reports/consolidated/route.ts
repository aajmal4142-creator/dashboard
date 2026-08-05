import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getApiContext } from "@/lib/auth/apiContext";
import { buildConsolidatedReport, type ConsolidationPack } from "@/lib/consolidation";
import type { IcEliminationLine } from "@/lib/consolidation/consolidate";
import config from "@/payload.config";

function parseEliminations(raw: string | null): IcEliminationLine[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const r = row as Record<string, unknown>;
    const label = typeof r.label === "string" && r.label.trim() ? r.label.trim() : null;
    if (!label) return [];
    return [
      {
        label,
        scope1: typeof r.scope1 === "number" && Number.isFinite(r.scope1) ? r.scope1 : 0,
        scope2: typeof r.scope2 === "number" && Number.isFinite(r.scope2) ? r.scope2 : 0,
        scope3: typeof r.scope3 === "number" && Number.isFinite(r.scope3) ? r.scope3 : 0,
        note: typeof r.note === "string" && r.note.trim() ? r.note.trim() : null,
      },
    ];
  });
}

/**
 * GET /api/app/reports/consolidated?period=2026&format=json|csv&pack=management|statutory&eliminations=<json>
 * Consolidated emissions across explicitly linked subsidiaries (Membership-gated).
 * `eliminations` is a JSON-encoded array of { label, scope1, scope2, scope3, note }.
 */
export async function GET(req: Request) {
  const auth = await getApiContext();
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const activeOrg = ctx.activeOrg;

  const url = new URL(req.url);
  const periodRaw = url.searchParams.get("period");
  const format = url.searchParams.get("format") ?? "json";
  const year = periodRaw ? Number(periodRaw) : new Date().getFullYear();
  const packParam = url.searchParams.get("pack");
  const pack: ConsolidationPack = packParam === "statutory" ? "statutory" : "management";
  const eliminations = parseEliminations(url.searchParams.get("eliminations"));

  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    return NextResponse.json(
      { error: "period must be a four-digit year (e.g. 2026)." },
      { status: 400 },
    );
  }

  const accessibleOrgIds = ctx.memberships.map((m) => m.organisationId);
  const payload = await getPayload({ config });

  try {
    const report = await buildConsolidatedReport(payload, {
      parentOrganisationId: activeOrg.id,
      periodYear: year,
      accessibleOrgIds,
      pack,
      eliminations,
    });

    if (format === "csv") {
      return new NextResponse(report.csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="consolidated-${activeOrg.slug}-${year}-${report.pack}.csv"`,
        },
      });
    }

    return NextResponse.json({
      parentOrganisationId: report.parentOrganisationId,
      parentOrganisationName: report.parentOrganisationName,
      period: report.period,
      pack: report.pack,
      total: report.total,
      by_scope: report.byScope,
      by_org: report.byOrg,
      by_category: report.byCategory,
      unconsolidated_child_list: report.unconsolidatedChildList,
      methods_used: report.methodsUsed,
      warnings: report.warnings,
      footer: report.footer,
      has_subsidiaries: report.byOrg.some((r) => r.depth > 0),
      quality: report.quality,
      measured_org_count: report.measuredOrgCount,
      missing_org_count: report.missingOrgCount,
      quality_message: report.qualityMessage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Consolidation failed";
    if (message.startsWith("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
