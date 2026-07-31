import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { regulatoryDeadlinesService } from "@/lib/compliance/regulatoryDeadlines";

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
  const view = url.searchParams.get("view") || "calendar";
  const year = parseInt(
    url.searchParams.get("year") || String(new Date().getFullYear()),
    10,
  );
  const month = parseInt(
    url.searchParams.get("month") || String(new Date().getMonth()),
    10,
  );
  const jurisdiction = url.searchParams.get("jurisdiction");
  const framework = url.searchParams.get("framework");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  try {
    if (view === "calendar") {
      const calendarView = await regulatoryDeadlinesService.getCalendarView(
        ctx.activeOrg.id,
        year,
        month,
      );
      return NextResponse.json(calendarView);
    }

    if (view === "list") {
      const deadlines = await regulatoryDeadlinesService.getFilteredDeadlines(
        ctx.activeOrg.id,
        {
          view: (url.searchParams.get("listView") || "upcoming") as
            "upcoming" | "overdue" | "all" | "today",
          jurisdiction: jurisdiction || undefined,
          framework: framework || undefined,
          status: status || undefined,
          searchQuery: search || undefined,
        },
      );
      return NextResponse.json({ deadlines });
    }

    if (view === "summary") {
      const summary = await regulatoryDeadlinesService.getSummary(ctx.activeOrg.id);
      return NextResponse.json(summary);
    }

    return NextResponse.json({ error: "Invalid view parameter" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching calendar:", error);
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}
