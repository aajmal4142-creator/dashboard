import { NextResponse, type NextRequest } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  generateComplianceReport,
  exportReportAsHTML,
} from "@/lib/compliance/reportGenerator";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    "organisation"
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: complianceId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "markdown";

  if (!complianceId) {
    return NextResponse.json(
      { error: "Compliance ID required" },
      { status: 400 }
    );
  }

  try {
    if (format === "html") {
      const html = await exportReportAsHTML(ctx.activeOrg.id, complianceId);
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="compliance-report-${complianceId}.html"`,
        },
      });
    } else {
      const markdown = await generateComplianceReport(
        ctx.activeOrg.id,
        complianceId
      );
      return NextResponse.json({
        format: "markdown",
        content: markdown,
        complianceId,
      });
    }
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
