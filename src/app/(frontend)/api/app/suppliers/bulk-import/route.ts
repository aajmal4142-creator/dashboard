import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  parseCSV,
  performBulkImport,
  sendBulkQuestionnaires,
  generateImportPreview,
} from "@/lib/suppliers/bulkImportService";

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "supplier",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { csvData, dryRun, sendQuestionnaires, periodId } = body;

    if (!csvData) {
      return NextResponse.json({ error: "CSV data required" }, { status: 400 });
    }

    // Parse CSV
    const rows = parseCSV(csvData);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows in CSV" }, { status: 400 });
    }

    // Dry-run mode: just preview
    if (dryRun) {
      const preview = await generateImportPreview(ctx.activeOrg.id, rows);
      return NextResponse.json({ preview });
    }

    // Perform actual import
    const importResult = await performBulkImport(ctx.activeOrg.id, rows, ctx.user.id);

    // Send questionnaires if requested
    let questionnaireResult: { sent: number; failed: number; errors: string[] } = {
      sent: 0,
      failed: 0,
      errors: [],
    };
    if (sendQuestionnaires && importResult.created > 0) {
      const newSupplierIds = importResult.results
        .filter((r) => r.status === "created")
        .map((r) => r.supplierId!)
        .filter(Boolean);

      questionnaireResult = await sendBulkQuestionnaires(
        ctx.activeOrg.id,
        newSupplierIds,
        periodId,
      );
    }

    return NextResponse.json({
      importResult,
      questionnaireResult,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed",
      },
      { status: 500 },
    );
  }
}
