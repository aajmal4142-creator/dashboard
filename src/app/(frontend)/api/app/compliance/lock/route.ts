import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { lockCompliance } from "@/lib/compliance/checklistService";

export async function POST(request: Request) {
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

  const body = await request.json();
  const { complianceId, reason } = body;

  if (!complianceId) {
    return NextResponse.json(
      { error: "Compliance ID required" },
      { status: 400 }
    );
  }

  try {
    await lockCompliance(
      ctx.activeOrg.id,
      complianceId,
      ctx.user.id,
      reason || "Locked for assurance audit"
    );

    return NextResponse.json({
      message: "Compliance locked for audit",
      lockedBy: ctx.user.id,
      lockedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error locking compliance:", error);
    const message = (error as Error).message;
    return NextResponse.json(
      { error: message || "Failed to lock compliance" },
      { status: error instanceof Error && message.includes("already") ? 409 : 500 }
    );
  }
}
