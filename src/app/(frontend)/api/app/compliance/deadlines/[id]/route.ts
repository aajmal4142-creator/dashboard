import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { deadlineStatusTracker } from "@/lib/compliance/statusTracker";
import { getPayload } from "payload";
import config from "@/payload.config";

export async function PATCH(
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

  const body = await request.json();
  const { status, linkedReportId } = body;

  if (!status) {
    return NextResponse.json({ error: "Status is required" }, { status: 400 });
  }

  try {
    const payload = await getPayload({ config });

    // Verify deadline belongs to org
    const deadline = await payload.findByID({
      collection: "regulatory-deadlines",
      id,
      depth: 1,
    });

    if (!deadline) {
      return NextResponse.json({ error: "Deadline not found" }, { status: 404 });
    }

    const orgId =
      typeof deadline.organisation === "string"
        ? deadline.organisation
        : deadline.organisation?.id;

    if (orgId !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update status
    const event = await deadlineStatusTracker.updateStatus(
      id,
      status,
      ctx.user.id,
      linkedReportId,
    );

    if (!event) {
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error updating deadline:", error);
    return NextResponse.json({ error: "Failed to update deadline" }, { status: 500 });
  }
}
