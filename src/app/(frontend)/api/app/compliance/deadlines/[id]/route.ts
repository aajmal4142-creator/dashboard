import { NextResponse } from "next/server";
import { getPayload } from "payload";

import config from "@/payload.config";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { regulatoryDeadlinesService } from "@/lib/compliance/regulatoryDeadlines";

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

  const body = (await request.json()) as {
    status?: string;
    linkedReportId?: string;
  };
  const { status } = body;

  if (!status) {
    return NextResponse.json({ error: "Status is required" }, { status: 400 });
  }

  try {
    const payload = await getPayload({ config });

    const deadline = await payload.findByID({
      collection: "regulatory-deadlines",
      id,
      depth: 0,
      overrideAccess: true,
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

    const updated = await regulatoryDeadlinesService.updateDeadlineStatus(
      ctx.activeOrg.id,
      id,
      status,
      ctx.user.id,
    );

    if (!updated) {
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }

    return NextResponse.json({ deadline: updated });
  } catch (error) {
    console.error("Error updating deadline:", error);
    return NextResponse.json({ error: "Failed to update deadline" }, { status: 500 });
  }
}
