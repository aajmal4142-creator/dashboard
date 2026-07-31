import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { defaultExportPeriod, parseExportFormat } from "@/lib/compliance/checklistExport";
import { buildObligationChecklistExport } from "@/lib/compliance/checklistExportService";
import { requirePermission } from "@/lib/policy/protect";

/**
 * GET /api/app/compliance/obligations/export?format=pdf|excel&period=YYYY-MM
 * Confirmed obligations only (confirmedAt set). ABAC via active org + Membership.
 */
export async function GET(request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "compliance",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = parseExportFormat(url.searchParams.get("format"));
  if (!format) {
    return NextResponse.json({ error: "format must be pdf or excel" }, { status: 400 });
  }

  const period = url.searchParams.get("period") || defaultExportPeriod();

  try {
    const result = await buildObligationChecklistExport({
      organisationId: ctx.activeOrg.id,
      organisationName: ctx.activeOrg.name || "ClearESG",
      period,
      format,
      confirmedOnly: true,
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Compliance checklist export failed:", error);
    return NextResponse.json(
      { error: "Failed to export compliance checklist" },
      { status: 500 },
    );
  }
}
