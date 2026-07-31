import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  BillingDeniedError,
  billingDeniedResponse,
  can,
  normalizePlan,
} from "@/lib/billing";
import { applySnapshotPlan, planUndoApply } from "@/lib/bulk/execute";
import { buildUndoPreview, parseBulkSnapshot } from "@/lib/bulk/snapshot";
import config from "@/payload.config";

function isOpActor(
  actor: string | { id: string } | null | undefined,
  userId: string,
): boolean {
  if (!actor) return false;
  if (typeof actor === "string") return actor === userId;
  return actor.id === userId;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(ctx.activeOrg.plan, "bulk_actions")) {
    return NextResponse.json(
      billingDeniedResponse(
        new BillingDeniedError(normalizePlan(ctx.activeOrg.plan), "bulk_actions"),
      ),
      { status: 402 },
    );
  }

  const { id } = await params;
  const payload = await getPayload({ config });
  const op = await payload.findByID({
    collection: "bulk-operations",
    id,
    depth: 1,
  });

  if (!op) {
    return NextResponse.json({ error: "Operation not found" }, { status: 404 });
  }

  const orgId =
    typeof op.organisation === "object" && op.organisation
      ? op.organisation.id
      : op.organisation;
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isOpActor(op.actor, ctx.user.id) && ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!op.canUndo || op.undoneAt) {
    return NextResponse.json({ error: "Cannot undo this operation" }, { status: 400 });
  }

  const beforeSnapshot = parseBulkSnapshot(op.beforeSnapshot);
  if (!beforeSnapshot) {
    return NextResponse.json(
      { error: "No snapshot available for undo" },
      { status: 400 },
    );
  }

  const preview = buildUndoPreview({
    operationType: op.operationType,
    resourceType: op.resourceType,
    beforeSnapshot,
    afterSnapshot: parseBulkSnapshot(op.afterSnapshot),
    canUndo: true,
    undoneAt: op.undoneAt,
  });

  try {
    const plan = planUndoApply(op.operationType, beforeSnapshot);
    await applySnapshotPlan(payload, op.resourceType, plan);

    const undoRecord = await payload.update({
      collection: "bulk-operations",
      id,
      data: {
        canUndo: false,
        canRedo: true,
        undoneAt: new Date().toISOString(),
        redoneAt: null,
      },
    });

    return NextResponse.json({
      message: "Bulk operation undone successfully",
      preview,
      operation: undoRecord,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to undo operation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
