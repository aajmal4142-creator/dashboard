import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { regulatoryDeadlinesService } from "@/lib/compliance/regulatoryDeadlines";
import { UPCOMING_WINDOW_DAYS } from "@/lib/compliance/deadlineApplicability";

/**
 * GET /api/app/compliance/deadlines/upcoming — next 90 days (applicable only).
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
  const windowParam = url.searchParams.get("days");
  const windowDays = windowParam
    ? Math.min(365, Math.max(1, Number.parseInt(windowParam, 10) || UPCOMING_WINDOW_DAYS))
    : UPCOMING_WINDOW_DAYS;

  try {
    const deadlines = await regulatoryDeadlinesService.getUpcoming(
      ctx.activeOrg.id,
      windowDays,
    );
    return NextResponse.json({
      deadlines,
      count: deadlines.length,
      windowDays,
    });
  } catch (error) {
    console.error("Error fetching upcoming deadlines:", error);
    return NextResponse.json(
      { error: "Failed to fetch upcoming deadlines" },
      { status: 500 },
    );
  }
}
