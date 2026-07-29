import { NextResponse, type NextRequest } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { verifyCheckpoint } from "@/lib/compliance/checklistService";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (!checkpointId) {
    return NextResponse.json(
      { error: "Checkpoint ID required" },
      { status: 400 }
    );
  }

  try {
    await verifyCheckpoint(ctx.activeOrg.id, checkpointId, ctx.user.id);
    return NextResponse.json({
      message: "Checkpoint verified",
      verifiedBy: ctx.user.id,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error verifying checkpoint:", error);
    return NextResponse.json(
      { error: "Failed to verify checkpoint" },
      { status: 500 }
    );
  }
}
