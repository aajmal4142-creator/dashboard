import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { regulatoryDeadlinesService } from "@/lib/compliance/regulatoryDeadlines";

/**
 * GET /api/app/compliance/deadlines — list applicable deadlines for active org.
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
  const listView = (url.searchParams.get("view") || "all") as
    "upcoming" | "overdue" | "all" | "today";

  try {
    const deadlines = await regulatoryDeadlinesService.getFilteredDeadlines(
      ctx.activeOrg.id,
      {
        view: listView,
        jurisdiction: url.searchParams.get("jurisdiction") || undefined,
        framework: url.searchParams.get("framework") || undefined,
        status: url.searchParams.get("status") || undefined,
        searchQuery: url.searchParams.get("search") || undefined,
      },
    );

    return NextResponse.json({
      deadlines,
      count: deadlines.length,
    });
  } catch (error) {
    console.error("Error listing deadlines:", error);
    return NextResponse.json({ error: "Failed to list deadlines" }, { status: 500 });
  }
}
