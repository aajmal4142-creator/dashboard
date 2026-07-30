import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  commitSpendBatch,
  parseAndValidateSpendCsv,
  previewSpendBatch,
} from "@/lib/emissions/spendBasedService";
import { incrementApiUsage } from "@/lib/billing/freeTierGates";

/**
 * POST /api/app/emissions/spend-import
 * CSV batch: preview (dryRun=true, default) or commit (dryRun=false).
 *
 * Body: { csvData: string, dryRun?: boolean, periodId?: string, writeDatapoints?: boolean }
 *    or { rows: SpendEmissionsInput[], dryRun?: boolean, ... }
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as {
      csvData?: string;
      rows?: Array<{
        category: string;
        totalSpend: number;
        currency: string;
        region?: string;
        periodStart?: string;
        periodEnd?: string;
        industryCode?: string;
        subcategory?: string;
        glCodeRange?: string[];
      }>;
      dryRun?: boolean;
      periodId?: string;
      writeDatapoints?: boolean;
    };

    const dryRun = body.dryRun !== false;

    let rows = body.rows;
    if (!rows && body.csvData) {
      const parsed = parseAndValidateSpendCsv(body.csvData);
      if (!parsed.valid) {
        return NextResponse.json(
          {
            error: "Validation failed",
            errors: parsed.errors,
          },
          { status: 400 },
        );
      }
      rows = parsed.rows;
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "csvData or rows is required" }, { status: 400 });
    }

    if (dryRun) {
      const preview = await previewSpendBatch(ctx.activeOrg.id, rows);
      await incrementApiUsage(ctx.activeOrg.id);
      return NextResponse.json({
        mode: "preview",
        count: preview.length,
        preview: preview.map((line) => ({
          rowNumber: line.rowNumber,
          category: line.input.category,
          totalSpend: line.input.totalSpend,
          currency: line.input.currency,
          region: line.input.region ?? null,
          calculatedEmissions: line.result.calculatedEmissions,
          emissionsFactor: line.result.emissionsFactor,
          confidence: line.result.confidence,
          uncertainty: line.result.uncertainty,
          factorSource: line.result.factorSource,
          factorRegion: line.factorRegion,
          regionalAdjusted: line.regionalAdjusted,
          quality: line.result.quality,
        })),
      });
    }

    const committed = await commitSpendBatch(ctx.activeOrg.id, rows, {
      actorId: ctx.user.id,
      periodId: body.periodId,
      writeDatapoints: Boolean(body.writeDatapoints && body.periodId),
    });

    await incrementApiUsage(ctx.activeOrg.id);

    return NextResponse.json({
      mode: "commit",
      count: committed.createdIds.length,
      createdIds: committed.createdIds,
      datapointIds: committed.datapointIds,
      aggregate: committed.aggregate,
      preview: committed.preview.map((line) => ({
        rowNumber: line.rowNumber,
        category: line.result.category,
        calculatedEmissions: line.result.calculatedEmissions,
        uncertainty: line.result.uncertainty,
        quality: line.result.quality,
      })),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error importing spend emissions:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
