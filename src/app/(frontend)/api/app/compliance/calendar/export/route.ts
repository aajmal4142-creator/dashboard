import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { regulatoryDeadlinesService } from "@/lib/compliance/regulatoryDeadlines";

export async function GET() {
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

  try {
    const icalData = await regulatoryDeadlinesService.exportToICal(
      ctx.activeOrg.id,
      ctx.activeOrg.name || "ClearESG",
    );

    return new NextResponse(icalData, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="regulatory-deadlines-${new Date().toISOString().split("T")[0]}.ics"`,
      },
    });
  } catch (error) {
    console.error("Error exporting calendar:", error);
    return NextResponse.json({ error: "Failed to export calendar" }, { status: 500 });
  }
}
