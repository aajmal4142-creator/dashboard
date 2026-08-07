import { NextResponse } from "next/server";
import { getPayload } from "payload";

import config from "@/payload.config";
import { SPEND_BASED_EMISSIONS_SLUG } from "@/collections/SpendBasedEmissions";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { incrementApiUsage } from "@/lib/billing/freeTierGates";
import { commitSpendBatch, previewSpendBatch } from "@/lib/emissions/spendBasedService";
import type { SpendEmissionsInput } from "@/lib/calc/spendBasedEmissions";
import {
  mapGstInvoiceLine,
  parseGstInvoiceCsv,
  type GstInvoiceLine,
} from "@/lib/scope3/gstHsn";

type GstEmissionsPreview = {
  calculatedEmissions: number;
  emissionsFactor: number;
  confidence: "low" | "medium" | "high";
  uncertainty: number;
  factorSource: string;
  factorRegion: string;
};

type GstPreviewRow = {
  hsnCode: string;
  amount: number;
  description: string | null;
  mapped: boolean;
  scope3Category: number | null;
  spendLedgerCategory: string | null;
  metricKey: string | null;
  confidence: "high" | "medium" | "low" | null;
  note: string | null;
  quality: "estimated" | "unmapped";
  emissionsPreview: GstEmissionsPreview | null;
  emissionsError: string | null;
};

function isValidGstLine(value: unknown): value is GstInvoiceLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.hsnCode === "string" &&
    line.hsnCode.trim().length > 0 &&
    typeof line.amount === "number" &&
    Number.isFinite(line.amount) &&
    line.amount > 0
  );
}

/**
 * POST /api/app/scope3/gst-hsn-import
 * Preview (default) or commit a batch of India GST invoice lines (HSN/SAC +
 * taxable amount) mapped to Scope 3 categories via lib/scope3/gstHsn.ts, and
 * priced through the existing spend-based emissions factor registry.
 *
 * Body: { csvData?: string, lines?: GstInvoiceLine[], dryRun?: boolean,
 *          currency?: string, region?: string, periodId?: string,
 *          writeDatapoints?: boolean }
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
      lines?: unknown[];
      dryRun?: boolean;
      currency?: string;
      region?: string;
      periodId?: string;
      writeDatapoints?: boolean;
    };

    const dryRun = body.dryRun !== false;
    const currency = (body.currency || "INR").toUpperCase();
    const region = body.region || "India";

    let lines: GstInvoiceLine[] = [];

    if (body.csvData) {
      const parsed = parseGstInvoiceCsv(body.csvData);
      if (!parsed.valid) {
        return NextResponse.json(
          { error: "Validation failed", errors: parsed.errors },
          { status: 400 },
        );
      }
      lines = parsed.lines;
    } else if (Array.isArray(body.lines)) {
      const rejected: Array<{ index: number; value: unknown }> = [];
      for (let i = 0; i < body.lines.length; i++) {
        const raw = body.lines[i];
        if (isValidGstLine(raw)) {
          lines.push(raw);
        } else {
          rejected.push({ index: i, value: raw });
        }
      }
      if (rejected.length > 0 && lines.length === 0) {
        return NextResponse.json(
          {
            error: "No valid lines provided",
            errors: rejected.map((r) => ({
              rowNumber: r.index + 1,
              field: "line",
              value: r.value,
              error:
                "Each line requires a non-empty hsnCode and a positive numeric amount",
            })),
          },
          { status: 400 },
        );
      }
    }

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "csvData or lines is required" },
        { status: 400 },
      );
    }

    const mappings = lines.map((line) => mapGstInvoiceLine(line));

    const rows: GstPreviewRow[] = [];
    for (const mapping of mappings) {
      let emissionsPreview: GstEmissionsPreview | null = null;
      let emissionsError: string | null = null;

      if (mapping.mapped && mapping.spendLedgerCategory) {
        const input: SpendEmissionsInput = {
          category: mapping.spendLedgerCategory,
          totalSpend: mapping.amount,
          currency,
          region,
          subcategory: `GST HSN ${mapping.hsnCode}`,
        };
        try {
          const [preview] = await previewSpendBatch(ctx.activeOrg.id, [input]);
          if (preview) {
            emissionsPreview = {
              calculatedEmissions: preview.result.calculatedEmissions,
              emissionsFactor: preview.result.emissionsFactor,
              confidence: preview.result.confidence,
              uncertainty: preview.result.uncertainty,
              factorSource: preview.result.factorSource,
              factorRegion: preview.factorRegion,
            };
          }
        } catch (err) {
          // Missing factor for this category/region — never invent a number,
          // just surface why this line couldn't be priced.
          emissionsError =
            err instanceof Error ? err.message : "No emissions factor available";
        }
      }

      rows.push({
        hsnCode: mapping.hsnCode,
        amount: mapping.amount,
        description: mapping.description,
        mapped: mapping.mapped,
        scope3Category: mapping.scope3Category,
        spendLedgerCategory: mapping.spendLedgerCategory,
        metricKey: mapping.metricKey,
        confidence: mapping.confidence,
        note: mapping.note,
        quality: mapping.quality,
        emissionsPreview,
        emissionsError,
      });
    }

    if (dryRun) {
      await incrementApiUsage(ctx.activeOrg.id);
      return NextResponse.json({
        mode: "preview",
        count: rows.length,
        mappedCount: rows.filter((r) => r.mapped).length,
        pricedCount: rows.filter((r) => r.emissionsPreview !== null).length,
        rows,
      });
    }

    const committable = rows
      .map((row, idx) => ({ row, mapping: mappings[idx]! }))
      .filter(
        ({ row }) =>
          row.mapped && row.emissionsPreview !== null && row.spendLedgerCategory,
      );

    if (committable.length === 0) {
      return NextResponse.json(
        {
          error:
            "No mapped and priced lines to commit — check unmapped rows or missing factors",
          rows,
        },
        { status: 400 },
      );
    }

    const commitInputs: SpendEmissionsInput[] = committable.map(({ mapping }) => ({
      category: mapping.spendLedgerCategory!,
      totalSpend: mapping.amount,
      currency,
      region,
      subcategory: `GST HSN ${mapping.hsnCode}`,
    }));

    const committed = await commitSpendBatch(ctx.activeOrg.id, commitInputs, {
      actorId: ctx.user.id,
      periodId: body.periodId,
      writeDatapoints: Boolean(body.writeDatapoints && body.periodId),
    });

    const payload = await getPayload({ config });
    await Promise.all(
      committed.createdIds.map((id, idx) => {
        const { row, mapping } = committable[idx]!;
        const noteParts = [
          `Source: gst_hsn. HSN/SAC ${mapping.hsnCode} → Scope 3 Cat ${row.scope3Category} (${row.confidence ?? "unknown"} confidence).`,
        ];
        if (mapping.note) noteParts.push(mapping.note);
        return payload.update({
          collection: SPEND_BASED_EMISSIONS_SLUG,
          id,
          data: { notes: noteParts.join(" ") },
          overrideAccess: true,
        });
      }),
    );

    await incrementApiUsage(ctx.activeOrg.id);

    const skipped = rows.filter((r) => !(r.mapped && r.emissionsPreview !== null));

    return NextResponse.json({
      mode: "commit",
      count: committed.createdIds.length,
      createdIds: committed.createdIds,
      datapointIds: committed.datapointIds,
      aggregate: committed.aggregate,
      skipped: skipped.map((r) => ({
        hsnCode: r.hsnCode,
        reason: r.mapped ? (r.emissionsError ?? "not priced") : "unmapped",
      })),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error importing GST/HSN spend lines:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
