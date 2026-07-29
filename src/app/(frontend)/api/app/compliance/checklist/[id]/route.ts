import { NextResponse, type NextRequest } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  updateCheckpoint,
  calculateComplianceScore,
} from "@/lib/compliance/checklistService";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    "organisation"
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: checkpointId } = await params;
  const body = await request.json();
  const { status, notes, evidenceLinks, complianceId } = body;

  if (!checkpointId || !complianceId) {
    return NextResponse.json(
      { error: "Checkpoint ID and Compliance ID required" },
      { status: 400 }
    );
  }

  try {
    await updateCheckpoint(ctx.activeOrg.id, checkpointId, {
      status,
      notes,
      evidenceLinks,
    });

    // Recalculate compliance score
    const newScore = await calculateComplianceScore(
      ctx.activeOrg.id,
      complianceId
    );

    return NextResponse.json({
      message: "Checkpoint updated",
      newComplianceScore: newScore,
    });
  } catch (error) {
    console.error("Error updating checkpoint:", error);
    return NextResponse.json(
      { error: "Failed to update checkpoint" },
      { status: 500 }
    );
  }
}
