import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { regulatoryDeadlinesService } from "@/lib/compliance/regulatoryDeadlines";
import { toStoredStatus } from "@/lib/compliance/deadlineApplicability";

const ALLOWED = new Set([
  "pending",
  "in-progress",
  "in_progress",
  "completed",
  "missed",
  "not_started",
  "overdue",
]);

/**
 * PUT /api/app/compliance/deadlines/[id]/status — mark status (Membership ABAC).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "edit",
    "compliance",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = body.status?.trim();
  if (!status || !ALLOWED.has(status)) {
    return NextResponse.json(
      {
        error:
          "Status is required and must be pending, in-progress, completed, or missed",
      },
      { status: 400 },
    );
  }

  try {
    const deadline = await regulatoryDeadlinesService.updateDeadlineStatus(
      ctx.activeOrg.id,
      id,
      toStoredStatus(status),
      ctx.user.id,
    );

    if (!deadline) {
      return NextResponse.json(
        { error: "Deadline not found or not in your organisation" },
        { status: 404 },
      );
    }

    return NextResponse.json({ deadline });
  } catch (error) {
    console.error("Error updating deadline status:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
