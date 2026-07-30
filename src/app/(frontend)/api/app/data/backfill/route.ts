import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import type { HistoricalDataRow, BackfillResult } from "@/lib/data/historicalBackfill";
import {
  validateHistoricalBackfill,
  calculateBackfillSummary,
} from "@/lib/data/historicalBackfill";

const BATCH_SIZE = 100;

function toDatapointQuality(
  quality: string | undefined,
): "measured" | "calculated" | "estimated" | "missing" {
  const q = (quality || "estimated").toLowerCase();
  if (q === "measured" || q === "metered") return "measured";
  if (q === "calculated") return "calculated";
  if (q === "missing") return "missing";
  return "estimated";
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await getPayload({ config });

    const body = (await req.json()) as {
      rows: HistoricalDataRow[];
      periodId: string;
      dryRun?: boolean;
    };

    const { rows, periodId, dryRun = true } = body;

    if (!periodId) {
      return NextResponse.json({ error: "periodId is required" }, { status: 400 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "rows must be a non-empty array" },
        { status: 400 },
      );
    }

    // Get valid metrics
    const metrics = await payload.find({
      collection: "metric-definitions",
      limit: 1000,
      overrideAccess: true,
    });
    const validMetrics = new Set(metrics.docs.map((m) => m.key));

    // Validate all rows
    const { isValid, errors } = await validateHistoricalBackfill(rows, validMetrics);

    if (!isValid && !dryRun) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    if (!isValid) {
      const summary = calculateBackfillSummary(rows);
      return NextResponse.json({
        success: true,
        dryRun: true,
        imported: 0,
        errors,
        yearRange: summary.yearRange,
        summary: summary.summary,
        message: "Validation found errors. Run without dryRun to attempt import anyway.",
      } as BackfillResult);
    }

    if (dryRun) {
      const summary = calculateBackfillSummary(rows.filter((r) => r.value >= 0));
      return NextResponse.json({
        success: true,
        dryRun: true,
        imported: rows.filter((r) => r.value >= 0).length,
        errors: [],
        yearRange: summary.yearRange,
        summary: summary.summary,
        message: `Preview: ${rows.length} records ready to import`,
      } as BackfillResult);
    }

    // Import rows in batches
    let imported = 0;
    const importErrors: typeof errors = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        try {
          // Skip if validation failed for this row
          if (errors.some((e) => e.row === i + batch.indexOf(row) + 2)) {
            continue;
          }

          await payload.create({
            collection: "datapoints",
            data: {
              organisation: ctx.activeOrg.id,
              period: periodId,
              metricKey: row.metricKey,
              value: row.value,
              quality: toDatapointQuality(row.quality),
              supplier: row.supplier || null,
              note: row.notes || `Historical backfill from ${row.year}`,
              enteredBy: ctx.user.id,
              source: "import",
              approvalState: "pending",
            },
            overrideAccess: true,
          });
          imported++;
        } catch (error) {
          importErrors.push({
            row: i + batch.indexOf(row) + 2,
            field: "datapoint",
            value: row.metricKey,
            message: error instanceof Error ? error.message : "Import failed",
          });
        }
      }
    }

    const summary = calculateBackfillSummary(rows);

    return NextResponse.json({
      success: true,
      dryRun: false,
      imported,
      errors: importErrors,
      yearRange: summary.yearRange,
      summary: summary.summary,
    } as BackfillResult);
  } catch (error) {
    console.error("Historical backfill error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET(_req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await getPayload({ config });

    // Get list of available periods for backfill
    const periods = await payload.find({
      collection: "reporting-periods",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 100,
      overrideAccess: true,
    });

    // Get available metrics
    const metrics = await payload.find({
      collection: "metric-definitions",
      limit: 1000,
      overrideAccess: true,
    });

    return NextResponse.json({
      periods: periods.docs.map((p) => ({
        id: p.id,
        year: new Date(p.startDate).getFullYear(),
        status: p.status,
      })),
      metrics: metrics.docs.map((m) => ({
        key: m.key,
        label: m.label,
      })),
      supportedYears: [2020, 2021, 2022, 2023, 2024, 2025],
    });
  } catch (error) {
    console.error("Backfill info error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
